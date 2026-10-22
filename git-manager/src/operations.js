/**
 * git-manager — RPC 操作实现。
 *
 * 每个操作都是一次独立的请求：解析 cwd → 找到仓库根 → 读写 git → 返回纯 JSON。
 * `exec` 由 Host 入口注入（真实子进程或单测的假实现），因此本文件没有 I/O 依赖。
 */
import { isAbsolute } from 'node:path'
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

const READ_TIMEOUT = 30000
const WRITE_TIMEOUT = 30000
const NETWORK_TIMEOUT = 180000
const AI_TIMEOUT = 120000
const DIFF_MAX_CHARS = 400000

/** 支持的操作名。 */
const OPS = [
  'snapshot', 'graph', 'diff', 'stage', 'unstage', 'switchBranch', 'deleteBranch',
  'commit', 'fetch', 'pull', 'push', 'aiCommit',
]

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

function assertRef(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new GitError(`缺少 ${label} 参数`, { code: 'invalid-params' })
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
      }
    }
    const root = resolved.root
    const [statusRes, branchesRes, remotesRes, stashRes, headRes, urlRes] = await Promise.all([
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
    const result = await runGit(['pull'], { cwd: root, signal, timeoutMs: timeouts.network })
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

  async function aiCommit(params, signal) {
    const cwd = assertCwd(params.cwd)
    const resolved = await repoRoot(cwd, signal)
    const root = resolved.root
    if (!root) throw new GitError(`当前目录不是 Git 仓库：${cwd}${resolved.error ? `（${resolved.error}）` : ''}`, { code: 'not-a-repo' })
    const hint = typeof params.hint === 'string' ? params.hint.slice(0, 500) : ''
    const context = ai() ?? {}
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
    })
  }

  const handlers = {
    snapshot,
    graph,
    diff,
    stage,
    unstage,
    switchBranch,
    deleteBranch,
    commit,
    fetch: fetchRemote,
    pull,
    push,
    aiCommit,
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
    const timeout = op === 'aiCommit'
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
