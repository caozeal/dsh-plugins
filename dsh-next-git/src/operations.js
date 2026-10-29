/**
 * git-manager — RPC 操作实现。
 *
 * 每个操作都是一次独立的请求：解析 cwd → 找到仓库根 → 读写 git → 返回纯 JSON。
 * `exec` 由 Host 入口注入（真实子进程或单测的假实现），因此本文件没有 git 之外的 I/O；
 * 唯一的例外是 applyConflict 要把解决结果写回工作区，那一步用 `writeFile`
 *（可通过 deps.fileIO 注入假实现，单测不必碰磁盘）。
 */
import { isAbsolute, join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import {
  GitError,
  classifyEntries,
  gitFailure,
  parseBranches,
  parseBranchHeader,
  parseGraph,
  parsePorcelain,
  parseRemotes,
  parseStashes,
  parseUnifiedDiff,
} from './git.js'
import { generateCommitMessage } from './ai-commit.js'
import { hasConflictMarkers, resolveConflict } from './ai-conflict.js'

const READ_TIMEOUT = 30000
const WRITE_TIMEOUT = 30000
const NETWORK_TIMEOUT = 180000
const AI_TIMEOUT = 120000
const DIFF_MAX_CHARS = 400000

/** 支持的操作名。 */
const OPS = [
  'snapshot', 'graph', 'diff', 'stage', 'unstage', 'discard', 'switchBranch', 'deleteBranch',
  'commit', 'fetch', 'pull', 'push', 'aiCommit',
  'stashPush', 'stashPop', 'stashDrop', 'setCommitPrompt',
  'conflictInfo', 'aiConflict', 'applyConflict', 'takeSide',
]

/** 自定义提交提示词在 git config 里的键。用 git config 而不是新增工作区文件：
 *  不污染 git status、不打扰 .gitignore，且天然区分本地/全局（写入用 --local，
 *  读取走默认级联，所以用户可以先设一条全局默认再按仓库覆盖）。 */
const COMMIT_PROMPT_KEY = 'dsh.commitPrompt'
const COMMIT_PROMPT_MAX = 4000

/** 只接受安全的 ref/远程名，避免被当作命令行选项。 */
const SAFE_REF = /^[A-Za-z0-9._/-]+$/

function assertCwd(cwd) {
  if (typeof cwd !== 'string' || cwd.trim() === '') {
    throw new GitError('缺少 cwd 参数', { code: 'invalid-params' })
  }
  if (!isAbsolute(cwd)) {
    throw new GitError(`cwd 必须是绝对路径：${cwd}`, { code: 'invalid-params' })
  }
  if (cwd.includes('\0')) {
    throw new GitError('cwd 含非法字符', { code: 'invalid-params' })
  }
  return cwd
}

function assertPaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new GitError('paths 不能为空', { code: 'invalid-params' })
  }
  return paths.map((path) => {
    if (typeof path !== 'string' || path === '' || path.includes('\0')) {
      throw new GitError('paths 含非法条目', { code: 'invalid-params' })
    }
    // 以 - 开头的路径会被 git 当成选项，补 ./ 前缀。
    return path.startsWith('-') ? `./${path}` : path
  })
}

/**
 * 只接受仓库内的相对路径。
 * applyConflict 会把内容写到 `join(root, path)`，这里必须挡住
 * 绝对路径与 `..`，否则一个构造过的 path 就能写到仓库外。
 */
function assertRelPath(value) {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\0')) {
    throw new GitError('path 非法', { code: 'invalid-params' })
  }
  if (isAbsolute(value)) {
    throw new GitError(`path 必须是仓库内相对路径：${value}`, { code: 'invalid-params' })
  }
  const segments = value.split('/').filter((segment) => segment !== '' && segment !== '.')
  if (segments.includes('..')) {
    throw new GitError(`path 不能包含 ..：${value}`, { code: 'invalid-params' })
  }
  if (segments.length === 0) {
    throw new GitError('path 非法', { code: 'invalid-params' })
  }
  return segments.join('/')
}

function assertRef(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new GitError(`缺少 ${label} 参数`, { code: 'invalid-params' })
  }
  // 前导 '-' 会被 git 当成选项（如 remote='--upload-pack'），必须拒绝，
  // 否则可构造 git 选项注入。git 本身也不允许分支/远端名以 '-' 开头。
  if (value.startsWith('-')) {
    throw new GitError(`${label} 不能以 - 开头：${value}`, { code: 'invalid-params' })
  }
  if (!SAFE_REF.test(value)) {
    throw new GitError(`${label} 含非法字符：${value}`, { code: 'invalid-params' })
  }
  return value
}

function assertHash(hash) {
  if (typeof hash !== 'string' || !/^[0-9a-f]{4,40}$/.test(hash)) {
    throw new GitError(`hash 非法：${String(hash)}`, { code: 'invalid-params' })
  }
  return hash
}

function joinOutput(stdout, stderr) {
  return [String(stdout || '').trim(), String(stderr || '').trim()].filter(Boolean).join('\n')
}

/**
 * @param {{
 *   exec: (argv: string[], options: {cwd: string, signal?: AbortSignal, timeoutMs?: number}) => Promise<{code: number|null, stdout: string, stderr: string}>,
 *   ai?: () => ({llm?: unknown, selection?: object} | null),
 *   generateCommitMessage?: typeof generateCommitMessage,
 * }} deps
 */
export function createOperations(deps) {
  const { exec } = deps
  const ai = deps.ai ?? (() => null)
  const generate = deps.generateCommitMessage ?? generateCommitMessage
  const writeFileImpl = (deps.fileIO && deps.fileIO.writeFile) ?? writeFile
  const timeouts = {
    read: READ_TIMEOUT,
    write: WRITE_TIMEOUT,
    network: NETWORK_TIMEOUT,
    ai: AI_TIMEOUT,
    ...(deps.timeouts ?? {}),
  }

  /**
   * 运行一条 git 命令。
   * @param {string[]} args 不含 `git` 本身的参数。
   * @param {{cwd: string, signal?: AbortSignal, timeoutMs?: number, allowFailure?: boolean}} options
   */
  async function runGit(args, options) {
    const { cwd, signal, timeoutMs = timeouts.read, allowFailure = false } = options
    const argv = ['git', ...args]
    const result = await exec(argv, { cwd, signal, timeoutMs })
    if (result.code !== 0 && !allowFailure) {
      throw gitFailure(argv, result)
    }
    return result
  }

  /**
   * 解析仓库根。
   * @returns {Promise<{root: string|null, error: string|null}>} 非仓库时 root 为 null，
   *   error 带 git 的 stderr（面板用它说明「为什么不是仓库」，例如权限/所有权问题）。
   */
  async function repoRoot(cwd, signal) {
    const result = await runGit(['rev-parse', '--show-toplevel'], {
      cwd,
      signal,
      allowFailure: true,
    })
    if (result.code === 0) {
      const root = result.stdout.trim()
      return { root: root === '' ? null : root, error: null }
    }
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
    return {
      root: null,
      error: detail || `git rev-parse --show-toplevel 退出码 ${result.code}`,
    }
  }

  /** 当前分支名；detached 时返回 null。 */
  async function currentBranch(root, signal) {
    const result = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      signal,
      allowFailure: true,
    })
    if (result.code !== 0) return null
    const name = result.stdout.trim()
    if (name === '' || name === 'HEAD') return null
    return name
  }

  async function snapshot(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    if (!resolved.root) {
      return {
        repo: { isRepo: false, error: resolved.error },
        branches: [],
        remotes: [],
        status: { clean: true, staged: [], unstaged: [], untracked: [], conflicted: [] },
        stashes: [],
        commitPrompt: '',
      }
    }
    const root = resolved.root
    const [statusRes, branchesRes, remotesRes, stashRes, headRes, urlRes, promptRes] = await Promise.all([
      runGit(['status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all'], {
        cwd: root,
        signal,
      }),
      runGit([
        'for-each-ref',
        'refs/heads',
        'refs/remotes',
        '--format=%(refname)%00%(refname:short)%00%(objectname:short)%00%(upstream:short)%00%(upstream:track)%00%(committerdate:iso8601)%00%(subject)',
      ], { cwd: root, signal, allowFailure: true }),
      runGit(['remote', '-v'], { cwd: root, signal, allowFailure: true }),
      runGit(['stash', 'list', '--format=%gd%x00%s'], { cwd: root, signal, allowFailure: true }),
      runGit(['rev-parse', '--short', 'HEAD'], { cwd: root, signal, allowFailure: true }),
      runGit(['config', '--get', 'remote.origin.url'], { cwd: root, signal, allowFailure: true }),
      runGit(['config', '--get', COMMIT_PROMPT_KEY], { cwd: root, signal, allowFailure: true }),
    ])
    const parsed = parsePorcelain(statusRes.stdout)
    const head = parseBranchHeader(parsed.branchLine)
    const groups = classifyEntries(parsed.entries)
    const branches = parseBranches(branchesRes.stdout)
    for (const branch of branches) {
      if (branch.kind === 'local' && head.branch !== null && branch.name === head.branch) branch.current = true
    }
    const remotes = parseRemotes(remotesRes.stdout)
    const originUrl = headRes.code === 0 ? headRes.stdout.trim() : ''
    const configuredUrl = urlRes.code === 0 ? urlRes.stdout.trim() : ''
    const remoteUrl = configuredUrl || (remotes[0] && remotes[0].url) || ''
    const clean = parsed.entries.length === 0
    return {
      repo: {
        isRepo: true,
        root,
        name: root.split('/').filter(Boolean).pop() || root,
        branch: head.branch,
        detached: head.detached,
        head: originUrl || null,
        upstream: head.upstream,
        upstreamGone: head.upstreamGone,
        ahead: head.ahead,
        behind: head.behind,
        remoteUrl: remoteUrl || null,
      },
      branches,
      remotes,
      status: { clean, ...groups },
      stashes: parseStashes(stashRes.stdout),
      commitPrompt: promptRes.code === 0 ? promptRes.stdout.trim() : '',
    }
  }

  async function graph(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const requested = Number.isFinite(params.limit) ? Math.trunc(params.limit) : 80
    const limit = Math.min(300, Math.max(20, requested))
    const result = await runGit([
      'log',
      '--graph',
      '--date=relative',
      '--decorate=short',
      '--pretty=format:%H%x1f%h%x1f%an%x1f%ar%x1f%D%x1f%s',
      '-n', String(limit),
      '--all',
    ], { cwd: root, signal, allowFailure: true })
    if (result.code !== 0) {
      // 空仓库（无提交）不是错误。
      const message = `${result.stderr || ''}`
      if (/does not have any commits yet|unknown revision|bad default revision/i.test(message)) {
        return { lines: [], truncated: false }
      }
      throw gitFailure(['git', 'log'], result)
    }
    const lines = parseGraph(result.stdout)
    return { lines, truncated: false }
  }

  async function diff(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const mode = params.mode
    if (!['worktree', 'staged', 'commit', 'untracked'].includes(mode)) {
      throw new GitError(`未知的 diff 模式：${String(mode)}`, { code: 'invalid-params' })
    }
    const path = typeof params.path === 'string' && params.path !== '' ? params.path : ''
    const safePath = path !== '' && path.startsWith('-') ? `./${path}` : path
    // 未合并的文件不能走普通 git diff：它给的是 combined diff（diff --cc / @@@ / ++ 前缀），
    // 不是 unified diff，解析器读不出 hunk，面板会是空的。改成 diff 两个 stage 的 blob。
    if (mode === 'worktree' && safePath !== '') {
      const stages = await conflictStages(root, safePath, signal)
      if (Object.keys(stages).length > 0) {
        return await conflictDiff(root, safePath, stages, signal)
      }
    }
    /** @type {string[]} */
    let args
    if (mode === 'worktree') {
      args = ['diff', '--no-color', '--']
      if (safePath) args.push(safePath)
    } else if (mode === 'staged') {
      args = ['diff', '--no-color', '--cached', '--']
      if (safePath) args.push(safePath)
    } else if (mode === 'commit') {
      const hash = assertHash(params.hash)
      args = ['show', '--no-color', '--format=', '--patch', hash]
      if (safePath) args.push('--', safePath)
    } else {
      if (!safePath) throw new GitError('查看未跟踪文件差异需要 path', { code: 'invalid-params' })
      args = ['diff', '--no-color', '--no-index', '--', '/dev/null', safePath]
    }
    const result = await runGit(args, { cwd: root, signal, allowFailure: true })
    // git diff --no-index 有差异时退出码为 1；其它非 0 才是失败。
    if (result.code !== 0 && result.code !== 1) throw gitFailure(['git', ...args], result)
    let raw = result.stdout
    let truncated = false
    if (raw.length > DIFF_MAX_CHARS) {
      raw = raw.slice(0, DIFF_MAX_CHARS)
      truncated = true
    }
    const parsed = parseUnifiedDiff(raw)
    return {
      mode,
      path: safePath,
      binary: parsed.binary,
      additions: parsed.additions,
      deletions: parsed.deletions,
      hunks: parsed.hunks,
      truncated,
      raw,
    }
  }

  async function stage(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const args = params.all === true ? ['add', '-A'] : ['add', '--', ...assertPaths(params.paths)]
    const result = await runGit(args, { cwd: root, signal, timeoutMs: timeouts.write })
    return { output: joinOutput(result.stdout, result.stderr) }
  }

  async function unstage(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const args = params.all === true
      ? ['reset', '-q']
      : ['restore', '--staged', '--', ...assertPaths(params.paths)]
    const result = await runGit(args, { cwd: root, signal, timeoutMs: timeouts.write })
    return { output: joinOutput(result.stdout, result.stderr) }
  }

  /**
   * 丢弃改动。三种模式对应变更列表里的三个分组：
   *   worktree  —— 未暂存（git restore --worktree）
   *   untracked —— 未跟踪（git clean -f -d）
   *   all       —— 已暂存，连暂存区一起回退（git restore --staged --worktree）
   * 都不可恢复，前端必须二次确认后才调用。
   */
  async function discard(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const mode = params.mode
    if (!['worktree', 'untracked', 'all'].includes(mode)) {
      throw new GitError(`未知的丢弃模式：${String(mode)}`, { code: 'invalid-params' })
    }
    const paths = assertPaths(params.paths)
    let args
    if (mode === 'untracked') args = ['clean', '-f', '-d', '--', ...paths]
    else if (mode === 'all') args = ['restore', '--staged', '--worktree', '--', ...paths]
    else args = ['restore', '--worktree', '--', ...paths]
    const result = await runGit(args, { cwd: root, signal, timeoutMs: timeouts.write })
    return { output: joinOutput(result.stdout, result.stderr) }
  }

  async function switchBranch(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const name = assertRef(params.name, 'name')
    /** @type {{code: number|null, stdout: string, stderr: string}} */
    let result
    if (params.create === true) {
      const args = ['checkout', '-b', name]
      if (params.from !== undefined) args.push(assertRef(params.from, 'from'))
      result = await runGit(args, { cwd: root, signal, timeoutMs: timeouts.write })
    } else {
      // 远程分支：本地不存在时建立同名跟踪分支（origin/feat → feat）。
      const remoteRefs = await runGit(
        ['for-each-ref', '--format=%(refname:short)', 'refs/remotes'],
        { cwd: root, signal, allowFailure: true },
      )
      const isRemote = name.includes('/') && remoteRefs.stdout.split('\n').map((line) => line.trim()).includes(name)
      if (isRemote) {
        const local = name.split('/').slice(1).join('/')
        const created = await runGit(['checkout', '-b', local, '--track', name], {
          cwd: root,
          signal,
          timeoutMs: timeouts.write,
          allowFailure: true,
        })
        if (created.code !== 0) {
          result = await runGit(['checkout', local], { cwd: root, signal, timeoutMs: timeouts.write })
        } else {
          result = created
        }
      } else {
        result = await runGit(['checkout', name], { cwd: root, signal, timeoutMs: timeouts.write })
      }
    }
    return { branch: await currentBranch(root, signal), output: joinOutput(result.stdout, result.stderr) }
  }

  async function deleteBranch(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const name = assertRef(params.name, 'name')
    const flag = params.force === true ? '-D' : '-d'
    const result = await runGit(['branch', flag, name], { cwd: root, signal, timeoutMs: timeouts.write })
    return { output: joinOutput(result.stdout, result.stderr) }
  }

  async function commit(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const message = typeof params.message === 'string' ? params.message.trim() : ''
    if (message === '') throw new GitError('提交信息不能为空', { code: 'invalid-params' })
    if (message.length > 5000) throw new GitError('提交信息过长（上限 5000 字）', { code: 'invalid-params' })
    if (params.stageAll === true) {
      await runGit(['add', '-A'], { cwd: root, signal, timeoutMs: timeouts.write })
    }
    const result = await runGit(['commit', '-m', message], {
      cwd: root,
      signal,
      timeoutMs: timeouts.write,
    })
    const hashRes = await runGit(['rev-parse', '--short', 'HEAD'], { cwd: root, signal, allowFailure: true })
    const subjectRes = await runGit(['log', '-1', '--pretty=format:%s'], { cwd: root, signal, allowFailure: true })
    return {
      hash: hashRes.code === 0 ? hashRes.stdout.trim() : null,
      subject: subjectRes.code === 0 ? subjectRes.stdout.trim() : message,
      output: joinOutput(result.stdout, result.stderr),
    }
  }

  async function fetchRemote(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const args = params.remote !== undefined
      ? ['fetch', assertRef(params.remote, 'remote')]
      : ['fetch', '--all', '--prune']
    const result = await runGit(args, { cwd: root, signal, timeoutMs: timeouts.network })
    return { output: joinOutput(result.stdout, result.stderr) }
  }

  async function pull(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    // 默认沿用仓库配置（裸 git pull）。当 UI 引导用户选择了「远端 + 分支」时，
    // 显式拉取该远端分支；setUpstream 为真则顺带建立跟踪关系（等价 CLI 的
    // git pull --set-upstream <remote> <branch>），解决「没有 tracking information」。
    /** @type {string[]} */
    let args
    if (params.remote !== undefined || params.branch !== undefined) {
      /** @type {string} */
      let remote
      if (params.remote !== undefined) {
        remote = assertRef(params.remote, 'remote')
      } else {
        // 只给了 branch 没给 remote 时，不要硬编码 'origin'：取仓库实际配置的远端，
        // 有 origin 优先，否则用第一个远端（兼容主远端不叫 origin 的仓库）。
        const remotesRes = await runGit(['remote'], { cwd: root, signal, allowFailure: true })
        const remotes = String(remotesRes.stdout || '').split('\n').map((line) => line.trim()).filter(Boolean)
        remote = remotes.includes('origin') ? 'origin' : (remotes[0] || 'origin')
      }
      let branchName
      if (params.branch !== undefined) {
        branchName = assertRef(params.branch, 'branch')
      } else {
        branchName = await currentBranch(root, signal)
        if (!branchName) throw new GitError('当前处于 detached HEAD，无法拉取', { code: 'git-failed' })
      }
      args = params.setUpstream === true
        ? ['pull', '--set-upstream', remote, branchName]
        : ['pull', remote, branchName]
    } else {
      args = ['pull']
    }
    const result = await runGit(args, { cwd: root, signal, timeoutMs: timeouts.network })
    return {
      branch: await currentBranch(root, signal),
      output: joinOutput(result.stdout, result.stderr),
    }
  }

  async function push(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const branch = await currentBranch(root, signal)
    if (!branch) throw new GitError('当前处于 detached HEAD，无法推送', { code: 'git-failed' })
    const upstream = await runGit(
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      { cwd: root, signal, allowFailure: true },
    )
    const hasUpstream = upstream.code === 0 && upstream.stdout.trim() !== ''
    const args = (params.setUpstream === true || !hasUpstream)
      ? ['push', '-u', 'origin', branch]
      : ['push']
    const result = await runGit(args, { cwd: root, signal, timeoutMs: timeouts.network })
    return { branch, output: joinOutput(result.stdout, result.stderr) }
  }

  /** stash 索引只接受非负整数，避免拼进 stash@{...} 时被注入别的 ref。 */
  function assertStashIndex(value, fallback) {
    const raw = value === undefined || value === null ? fallback : value
    const index = Number(raw)
    if (!Number.isInteger(index) || index < 0 || index > 999) {
      throw new GitError(`stash 索引非法：${String(raw)}`, { code: 'invalid-params' })
    }
    return index
  }

  async function stashPush(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const args = ['stash', 'push']
    if (params.includeUntracked === true) args.push('-u')
    const message = typeof params.message === 'string' ? params.message.trim().slice(0, 200) : ''
    if (message !== '') args.push('-m', message)
    const result = await runGit(args, { cwd: root, signal, timeoutMs: timeouts.write })
    return { output: joinOutput(result.stdout, result.stderr) }
  }

  async function stashPop(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const index = assertStashIndex(params.index, 0)
    const result = await runGit(['stash', 'pop', `stash@{${index}}`], {
      cwd: root, signal, timeoutMs: timeouts.write,
    })
    return { output: joinOutput(result.stdout, result.stderr) }
  }

  async function stashDrop(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const index = assertStashIndex(params.index, 0)
    const result = await runGit(['stash', 'drop', `stash@{${index}}`], {
      cwd: root, signal, timeoutMs: timeouts.write,
    })
    return { output: joinOutput(result.stdout, result.stderr) }
  }

  /** 读写自定义提交提示词；传空串表示恢复默认。 */
  async function setCommitPrompt(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const raw = typeof params.prompt === 'string' ? params.prompt : ''
    if (raw.length > COMMIT_PROMPT_MAX) {
      throw new GitError(`提示词过长（上限 ${COMMIT_PROMPT_MAX} 字）`, { code: 'invalid-params' })
    }
    const value = raw.trim()
    if (value === '') {
      // 没设过时 git config --unset 退出码非 0，不算失败。
      await runGit(['config', '--local', '--unset', COMMIT_PROMPT_KEY], {
        cwd: root, signal, timeoutMs: timeouts.write, allowFailure: true,
      })
    } else {
      await runGit(['config', '--local', COMMIT_PROMPT_KEY, value], {
        cwd: root, signal, timeoutMs: timeouts.write,
      })
    }
    const read = await runGit(['config', '--get', COMMIT_PROMPT_KEY], {
      cwd: root, signal, allowFailure: true,
    })
    return { prompt: read.code === 0 ? read.stdout.trim() : '' }
  }

  // ---------------------------------------------------------------- 冲突解决

  /** 列出某个冲突文件在索引里的三份 stage（1=base 2=ours 3=theirs）。 */
  async function conflictStages(root, path, signal) {
    const res = await runGit(['ls-files', '-u', '-z', '--', path], {
      cwd: root, signal, allowFailure: true,
    })
    const stages = {}
    for (const chunk of String(res.stdout || '').split('\0')) {
      if (chunk === '') continue
      const tab = chunk.indexOf('\t')
      if (tab < 0) continue
      // 格式：<mode> <hash> <stage>\t<path>
      const meta = chunk.slice(0, tab).split(' ')
      const hash = meta[1]
      const stage = Number(meta[2])
      if (!hash || !Number.isInteger(stage) || stage < 1 || stage > 3) continue
      stages[stage] = hash
    }
    return stages
  }

  async function readBlob(root, hash, signal) {
    if (!hash) return null
    const res = await runGit(['cat-file', '-p', hash], { cwd: root, signal, allowFailure: true })
    return res.code === 0 ? res.stdout : null
  }

  /**
   * 冲突文件的差异视图：当前分支（:2:）↔ 合入分支（:3:）。
   * 直接 `git diff <blob> <blob>` 是合法的，拿到的是普通 unified diff，行级高亮照样能用。
   * 某一侧没有这个文件（删除/改名冲突）时没有可比的两份内容，只回元数据让面板说明情况。
   */
  async function conflictDiff(root, path, stages, signal) {
    const oursHash = stages[2]
    const theirsHash = stages[3]
    const base = {
      mode: 'conflict',
      path,
      conflict: true,
      oursExists: Boolean(oursHash),
      theirsExists: Boolean(theirsHash),
      binary: false,
      additions: 0,
      deletions: 0,
      hunks: [],
      truncated: false,
      raw: '',
    }
    if (!oursHash || !theirsHash) return base
    const args = ['diff', '--no-color', oursHash, theirsHash]
    const result = await runGit(args, { cwd: root, signal, allowFailure: true })
    if (result.code !== 0 && result.code !== 1) throw gitFailure(['git', ...args], result)
    let raw = result.stdout
    let truncated = false
    if (raw.length > DIFF_MAX_CHARS) {
      raw = raw.slice(0, DIFF_MAX_CHARS)
      truncated = true
    }
    const parsed = parseUnifiedDiff(raw)
    return {
      ...base,
      binary: parsed.binary,
      additions: parsed.additions,
      deletions: parsed.deletions,
      hunks: parsed.hunks,
      truncated,
      raw,
    }
  }

  /** 还剩几个未解决冲突（applyConflict / takeSide 之后用它回执）。 */
  async function unmergedCount(root, signal) {
    const res = await runGit(['diff', '--name-only', '--diff-filter=U', '-z'], {
      cwd: root, signal, allowFailure: true,
    })
    return String(res.stdout || '').split('\0').filter(Boolean).length
  }

  /** 合入侧的 ref 名：merge 看 MERGE_HEAD，rebase 看 REBASE_HEAD。 */
  async function incomingRef(root, signal) {
    for (const ref of ['MERGE_HEAD', 'REBASE_HEAD']) {
      const exists = await runGit(['rev-parse', '--verify', '-q', ref], {
        cwd: root, signal, allowFailure: true,
      })
      if (exists.code !== 0) continue
      const name = await runGit(['name-rev', '--name-only', ref], {
        cwd: root, signal, allowFailure: true,
      })
      if (name.code === 0 && name.stdout.trim() !== '') return name.stdout.trim()
      const subject = await runGit(['log', '-1', '--pretty=%s', ref], {
        cwd: root, signal, allowFailure: true,
      })
      if (subject.code === 0 && subject.stdout.trim() !== '') return subject.stdout.trim()
    }
    return null
  }

  /** 读一个冲突文件的三份版本；不是冲突文件就报 invalid-params。 */
  async function loadConflict(root, path, signal) {
    const stages = await conflictStages(root, path, signal)
    if (Object.keys(stages).length === 0) {
      throw new GitError(`该文件没有未解决的冲突：${path}`, { code: 'invalid-params' })
    }
    const [base, ours, theirs] = await Promise.all([
      readBlob(root, stages[1], signal),
      readBlob(root, stages[2], signal),
      readBlob(root, stages[3], signal),
    ])
    return { stages, base, ours: ours ?? '', theirs: theirs ?? '' }
  }

  async function conflictInfo(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) {
      throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    }
    const path = assertRelPath(params.path)
    const info = await loadConflict(root, path, signal)
    const branch = await currentBranch(root, signal)
    const incoming = await incomingRef(root, signal)
    return {
      path,
      branch,
      incoming,
      hasBase: info.base !== null,
      oursExists: Boolean(info.stages[2]),
      theirsExists: Boolean(info.stages[3]),
      ours: info.ours.slice(0, DIFF_MAX_CHARS),
      theirs: info.theirs.slice(0, DIFF_MAX_CHARS),
      base: (info.base ?? '').slice(0, DIFF_MAX_CHARS),
    }
  }

  /**
   * 生成解决建议。**不写盘** —— 用户确认后走 applyConflict。
   * 这样模型给出坏结果时最多是白看一次，不会把工作区改脏。
   *
   * 删除/改名冲突（某一侧在索引里没有 stage）先走确定性判断：存活的一侧相对 base
   * 没有任何改动时，删除是唯一无损解，不必问模型（问也容易得到「原样保留」的错答案）。
   */
  async function aiConflict(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) {
      throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    }
    const path = assertRelPath(params.path)
    const hint = typeof params.hint === 'string' ? params.hint.slice(0, 500) : ''
    const info = await loadConflict(root, path, signal)
    const oursDeleted = !info.stages[2]
    const theirsDeleted = !info.stages[3]
    const hasBase = info.base !== null
    const unchanged = (text) => hasBase && text === info.base
    const deleteOnly = (oursDeleted && theirsDeleted)
      || (theirsDeleted && unchanged(info.ours))
      || (oursDeleted && unchanged(info.theirs))
    if (deleteOnly) {
      return {
        path,
        suggested: null,
        delete: true,
        deterministic: true,
        model: null,
        hasBase,
        oursExists: !oursDeleted,
        theirsExists: !theirsDeleted,
      }
    }
    const total = info.ours.length + info.theirs.length + (info.base ? info.base.length : 0)
    if (total > 240000) {
      throw new GitError(`冲突文件过大（三份共 ${total} 字符），请手动解决`, { code: 'invalid-params' })
    }
    const context = ai() ?? {}
    const branch = await currentBranch(root, signal)
    const incoming = await incomingRef(root, signal)
    const result = await resolveConflict({
      path,
      base: info.base,
      ours: info.ours,
      theirs: info.theirs,
      oursDeleted,
      theirsDeleted,
      branch,
      incoming,
      hint,
      signal,
      llm: context.llm,
      selection: context.selection,
    })
    return {
      path,
      suggested: result.suggested,
      delete: result.delete,
      deterministic: false,
      model: result.model,
      hasBase,
      oursExists: !oursDeleted,
      theirsExists: !theirsDeleted,
    }
  }

  /**
   * 把解决结果写回工作区（`delete: true` 时改为删除该文件）并标记为已解决。
   * 写入前再挡一次冲突标记；删除前再确认一次这确实是冲突文件。
   */
  async function applyConflict(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) {
      throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    }
    const path = assertRelPath(params.path)
    // 必须是当前真实的冲突文件，避免用这个接口去改/删任意文件
    await loadConflict(root, path, signal)
    if (params.delete === true) {
      await runGit(['rm', '-f', '--ignore-unmatch', '--', path], {
        cwd: root, signal, timeoutMs: timeouts.write, allowFailure: true,
      })
      const unmerged = await unmergedCount(root, signal)
      return { path, resolved: true, deleted: true, unmerged }
    }
    const content = params.content
    if (typeof content !== 'string' || content.trim() === '') {
      throw new GitError('content 不能为空', { code: 'invalid-params' })
    }
    if (content.length > DIFF_MAX_CHARS) {
      throw new GitError(`content 过长（${content.length} 字符）`, { code: 'invalid-params' })
    }
    if (hasConflictMarkers(content)) {
      throw new GitError('解决结果仍包含冲突标记，拒绝写入', { code: 'invalid-params' })
    }
    const abs = join(root, path)
    if (abs !== root && !abs.startsWith(root + '/')) {
      throw new GitError('path 超出仓库范围', { code: 'invalid-params' })
    }
    await writeFileImpl(abs, content, 'utf8')
    await runGit(['add', '--', path], { cwd: root, signal, timeoutMs: timeouts.write })
    const unmerged = await unmergedCount(root, signal)
    return { path, resolved: true, deleted: false, unmerged }
  }

  /**
   * 直接取某一侧（ours / theirs）。
   * 该侧没有这个文件时（被删除或改名）语义就是「删除」，用 git rm 收掉冲突条目。
   */
  async function takeSide(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) {
      throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    }
    const path = assertRelPath(params.path)
    const side = params.side
    if (side !== 'ours' && side !== 'theirs') {
      throw new GitError(`side 只能是 ours 或 theirs：${String(side)}`, { code: 'invalid-params' })
    }
    const info = await loadConflict(root, path, signal)
    const stage = side === 'ours' ? 2 : 3
    const deleted = !info.stages[stage]
    if (deleted) {
      await runGit(['rm', '-f', '--ignore-unmatch', '--', path], {
        cwd: root, signal, timeoutMs: timeouts.write, allowFailure: true,
      })
    } else {
      await runGit(['checkout', side === 'ours' ? '--ours' : '--theirs', '--', path], {
        cwd: root, signal, timeoutMs: timeouts.write,
      })
      await runGit(['add', '--', path], { cwd: root, signal, timeoutMs: timeouts.write })
    }
    const unmerged = await unmergedCount(root, signal)
    return { path, side, deleted, resolved: true, unmerged }
  }

  async function aiCommit(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const hint = typeof params.hint === 'string' ? params.hint.slice(0, 500) : ''
    const context = ai() ?? {}
    const promptRes = await runGit(['config', '--get', COMMIT_PROMPT_KEY], {
      cwd: root, signal, allowFailure: true,
    })
    const systemPrompt = promptRes.code === 0 ? promptRes.stdout : ''
    return generate({
      runGit: (args, options = {}) => runGit(args, {
        cwd: root,
        signal,
        timeoutMs: timeouts.read,
        ...options,
      }),
      cwd: root,
      hint,
      signal,
      llm: context.llm,
      selection: context.selection,
      systemPrompt,
    })
  }

  const handlers = {
    snapshot,
    graph,
    diff,
    stage,
    unstage,
    discard,
    switchBranch,
    deleteBranch,
    commit,
    fetch: fetchRemote,
    pull,
    push,
    aiCommit,
    stashPush,
    stashPop,
    stashDrop,
    setCommitPrompt,
    conflictInfo,
    aiConflict,
    applyConflict,
    takeSide,
  }

  /**
   * 分发一次请求。
   * @param {string} op
   * @param {Record<string, unknown>} params
   * @param {AbortSignal} [signal]
   */
  async function handle(op, params, signal) {
    if (typeof op !== 'string' || !OPS.includes(op)) {
      throw new GitError(`未知操作：${String(op)}`, { code: 'invalid-params' })
    }
    if (params === null || typeof params !== 'object') {
      throw new GitError('参数必须是 JSON 对象', { code: 'invalid-params' })
    }
    const timeout = op === 'aiCommit' || op === 'aiConflict'
      ? timeouts.ai
      : op === 'fetch' || op === 'pull' || op === 'push'
        ? timeouts.network
        : timeouts.read
    const controller = new AbortController()
    const onOuterAbort = () => controller.abort()
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', onOuterAbort, { once: true })
    }
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      return await handlers[op](params, controller.signal)
    } catch (error) {
      if (error instanceof GitError) throw error
      if (controller.signal.aborted) {
        throw new GitError(`git ${op} 超时（${timeout}ms）或被取消`, { code: 'timeout' })
      }
      const message = error && error.message ? error.message : String(error)
      throw new GitError(`git ${op} 失败：${message}`, { code: 'internal' })
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onOuterAbort)
    }
  }

  return { handle, ops: [...OPS], runGit }
}