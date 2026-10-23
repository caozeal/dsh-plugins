#!/usr/bin/env node
/**
 * git-manager 安装后冒烟测试（直连 Host RPC，不经过浏览器 UI）。
 *
 * 认证方式（已实测）：launch token -> GET /?token=… 换 303 + Set-Cookie `dsh-auth-*`
 * -> 后续 POST /api/git-manager 带 Cookie。token 每次 dsh 进程启动轮换，运行时从令牌文件读取。
 *
 * 用法：
 *   node dsh-next-git/test/live/smoke.mjs                 # 只读检查跑当前仓库（cwd 参数默认取本文件所在仓库）
 *   node dsh-next-git/test/live/smoke.mjs --cwd /some/repo
 *   node dsh-next-git/test/live/smoke.mjs --keep          # 保留 disposable 仓库便于排查
 *
 * 环境变量：
 *   DSH_URL        默认 http://127.0.0.1:3080
 *   DSH_TOKEN_FILE 默认 /Users/caozeal/projects/deepseek-harness/.dsh-launch-token
 *
 * 纪律：所有写操作（stage/unstage/commit/switchBranch/deleteBranch）只在
 * mkdtemp 出来的 disposable git 仓库里做，不碰真实仓库。
 *
 * 退出码：0 全绿；1 有断言失败；2 环境/安装未就绪（路由 404、认证失败）。
 */
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile, readFile, realpath } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = join(HERE, '..', '..')
const WORKSPACE = join(PLUGIN_ROOT, '..') // /Users/caozeal/projects/dsh-plugins

/** 与本机既有问题一致：GIT_CONFIG_COUNT 有值但缺 GIT_CONFIG_KEY_*，git 会 fatal。 */
function cleanGitEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (key === 'GIT_CONFIG_COUNT' || key.startsWith('GIT_CONFIG_KEY_') || key.startsWith('GIT_CONFIG_VALUE_')) delete env[key]
  }
  env.GIT_TERMINAL_PROMPT = '0'
  env.GIT_PAGER = 'cat'
  env.LC_ALL = 'C'
  return env
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, env: cleanGitEnv(), encoding: 'utf8' })
  if (r.error) throw new Error(`spawn git 失败: ${r.error.message}`)
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

function gitOk(args, cwd) {
  const r = git(args, cwd)
  if (r.code !== 0) throw new Error(`git ${args.join(' ')} 退出 ${r.code}: ${r.stderr.trim().slice(0, 300)}`)
  return r.stdout
}

const argv = process.argv.slice(2)
function argValue(flag) {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}
const KEEP = argv.includes('--keep')
const BASE = process.env.DSH_URL ?? 'http://127.0.0.1:3080'
const TOKEN_FILE = process.env.DSH_TOKEN_FILE ?? '/Users/caozeal/projects/deepseek-harness/.dsh-launch-token'
const READ_CWD = argValue('--cwd') ?? WORKSPACE

let COOKIE = ''
let passed = 0
const failures = []

function ok(name, evidence) {
  passed += 1
  console.log(`  ✓ ${name}${evidence ? ` — ${evidence}` : ''}`)
}
function fail(name, message) {
  failures.push({ name, message })
  console.log(`  ✗ ${name}\n      ${String(message).split('\n').join('\n      ')}`)
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}
function assertIn(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`${label} 期望 ∈ ${JSON.stringify(allowed)}，实际 ${JSON.stringify(value)}`)
}

async function check(name, fn) {
  try {
    const evidence = await fn()
    ok(name, typeof evidence === 'string' ? evidence : undefined)
  } catch (error) {
    fail(name, error instanceof Error ? error.message : String(error))
  }
}

/** 关键路径：拿不到就整体退出，避免把"没装好"误报成几十条断言失败。 */
async function authenticate() {
  if (!existsSync(TOKEN_FILE)) throw new Error(`令牌文件不存在：${TOKEN_FILE}（dsh 未由 dsh-ctl.sh 启动？）`)
  const token = (await readFile(TOKEN_FILE, 'utf8')).trim()
  assert(token.length > 0, '令牌文件为空')
  const res = await fetch(`${BASE}/?token=${encodeURIComponent(token)}`, { redirect: 'manual' })
  assert(res.status === 303, `token 交换应 303，实际 ${res.status}`)
  const setCookie = res.headers.getSetCookie?.() ?? []
  assert(setCookie.length > 0, 'token 交换未返回 set-cookie')
  COOKIE = setCookie[0].split(';')[0]
  assert(COOKIE.startsWith('dsh-auth-'), `cookie 名不是 dsh-auth-*：${COOKIE.split('=')[0]}`)
  return COOKIE.split('=')[0]
}

async function post(body, { raw = false, retry404 = false } = {}) {
  const send = async () => {
    const res = await fetch(`${BASE}/api/git-manager`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(COOKIE ? { cookie: COOKIE } : {}) },
      body: raw ? body : JSON.stringify(body),
    })
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* 保持 null，由断言报错 */
    }
    return { status: res.status, contentType: res.headers.get('content-type') ?? '', text, json }
  }
  const first = await send()
  // Host 热重载（bundle disable/enable）期间路由会短暂 404；等 1.5s 重试一次再判失败。
  if (retry404 && first.status === 404) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return send()
  }
  return first
}

/** 发一次 RPC 并要求 HTTP 200 + ok:true，返回 data。 */
async function rpcOk(op, params, cwdForError = READ_CWD) {
  const res = await post({ op, cwd: cwdForError, ...params }, { retry404: true })
  assert(res.json !== null, `响应不是 JSON（status=${res.status}）：${res.text.slice(0, 200)}`)
  if (res.status !== 200 || res.json.ok !== true) {
    throw new Error(`${op} 未成功（status=${res.status}）：${JSON.stringify(res.json).slice(0, 500)}`)
  }
  return res.json.data
}

/** 发一次 RPC 并要求 ok:false；返回 error。 */
async function rpcErr(op, params, cwdForError = READ_CWD) {
  const res = await post({ op, cwd: cwdForError, ...params }, { retry404: true })
  assert(res.json !== null, `响应不是 JSON（status=${res.status}）：${res.text.slice(0, 200)}`)
  assert(res.json.ok === false, `${op} 期望失败，实际 ${JSON.stringify(res.json).slice(0, 300)}`)
  return { status: res.status, error: res.json.error }
}

const ERROR_CODES = ['invalid-params', 'not-a-repo', 'git-failed', 'timeout', 'ai-unavailable', 'internal']
const KINDS = ['ctx', 'add', 'del']

async function main() {
  console.log(`git-manager live smoke  base=${BASE}`)
  console.log(`read cwd=${READ_CWD}`)

  // ── 0. 安装态 ────────────────────────────────────────────────────────────
  console.log('\n[0] 安装态 / 认证')
  let cookieName
  try {
    cookieName = await authenticate()
    ok('launch token → cookie 交换', `303, cookie=${cookieName.slice(0, 24)}…`)
  } catch (error) {
    console.error(`环境未就绪：${error instanceof Error ? error.message : error}`)
    process.exit(2)
  }

  const probe = await post({ op: 'snapshot', cwd: READ_CWD })
  if (probe.status === 404) {
    console.error('\nPOST /api/git-manager → 404：Host 半区未注册路由（插件未安装或宿主未加载）。')
    process.exit(2)
  }
  if (probe.status === 401) {
    console.error('\nPOST /api/git-manager → 401：cookie 未被接受。')
    process.exit(2)
  }
  await check('未认证请求被拒（401）', async () => {
    const saved = COOKIE
    COOKIE = ''
    try {
      const res = await post({ op: 'snapshot', cwd: READ_CWD })
      assert(res.status === 401, `期望 401，实际 ${res.status}`)
      return 'status=401'
    } finally {
      COOKIE = saved
    }
  })
  await check('成功响应 content-type 为 JSON', async () => {
    const res = await post({ op: 'snapshot', cwd: READ_CWD })
    assert(/application\/json/i.test(res.contentType), `content-type=${res.contentType}`)
    assert(/charset=utf-8/i.test(res.contentType), `缺少 charset=utf-8：${res.contentType}`)
    return res.contentType
  })
  await check('非法 JSON body → 400 + error JSON', async () => {
    const res = await post('{ not json', { raw: true })
    assert(res.status === 400, `期望 400，实际 ${res.status}`)
    assert(res.json?.ok === false, `期望 ok:false，实际 ${JSON.stringify(res.json).slice(0, 200)}`)
    assertIn(res.json.error?.code, ERROR_CODES, 'error.code')
    assert(typeof res.json.error?.message === 'string' && res.json.error.message.length > 0, 'error.message 为空')
    return `400, code=${res.json.error.code}`
  })
  await check('未知 op → invalid-params', async () => {
    const { status, error } = await rpcErr('noSuchOp', {})
    assert(ERROR_CODES.includes(error?.code), `error.code=${JSON.stringify(error?.code)}`)
    assert(typeof error?.message === 'string' && error.message.length > 0, 'error.message 为空')
    return `${status}, code=${error.code}`
  })

  // ── 1. snapshot（真实仓库，只读）───────────────────────────────────────
  console.log('\n[1] snapshot（只读，目标=当前工作区）')
  const repoRoot = await realpath(gitOk(['rev-parse', '--show-toplevel'], READ_CWD).trim())
  const branch = gitOk(['branch', '--show-current'], READ_CWD).trim()
  await check('snapshot 结构完整', async () => {
    const data = await rpcOk('snapshot')
    assert(data && typeof data === 'object', 'data 不是对象')
    const { repo, branches, remotes, status, stashes } = data
    assert(repo?.isRepo === true, 'repo.isRepo 不是 true')
    assert(typeof repo.root === 'string' && repo.root.length > 0, 'repo.root 缺失')
    assert(typeof repo.name === 'string' && repo.name.length > 0, 'repo.name 缺失')
    assert(typeof repo.branch === 'string' && repo.branch.length > 0, 'repo.branch 缺失')
    assert(typeof repo.detached === 'boolean', 'repo.detached 不是 boolean')
    assert(typeof repo.head === 'string' && repo.head.length > 0, 'repo.head 缺失')
    assert(Array.isArray(branches), 'branches 不是数组')
    assert(Array.isArray(remotes), 'remotes 不是数组')
    assert(Array.isArray(stashes), 'stashes 不是数组')
    for (const key of ['staged', 'unstaged', 'untracked', 'conflicted']) {
      assert(Array.isArray(status?.[key]), `status.${key} 不是数组`)
      for (const row of status[key]) assert(typeof row.path === 'string' && row.path.length > 0, `status.${key} 行缺少 path`)
    }
    assert(typeof status.clean === 'boolean', 'status.clean 不是 boolean')
    assert(repo.error === undefined || repo.error === null, `正常仓库不该带 repo.error：${JSON.stringify(repo.error)}`)
    const total = status.staged.length + status.unstaged.length + status.untracked.length + status.conflicted.length
    assert(status.clean === (total === 0), `status.clean=${status.clean} 与变更行数 ${total} 不一致`)
    return `root=${repo.root} branch=${repo.branch} 变更 ${total} 项`
  })
  await check('snapshot 与 git CLI 一致（root/branch）', async () => {
    const data = await rpcOk('snapshot')
    assert(data.repo.root === repoRoot, `root 不一致：rpc=${data.repo.root} cli=${repoRoot}`)
    assert(data.repo.branch === branch, `branch 不一致：rpc=${data.repo.branch} cli=${branch}`)
    return `${data.repo.branch} @ ${data.repo.root}`
  })
  await check('snapshot 变更分类与 git status --porcelain 一致', async () => {
    const data = await rpcOk('snapshot')
    // Host 用 --untracked-files=all 展开未跟踪目录，比较时必须同样展开。
    const porcelain = gitOk(['status', '--porcelain', '--untracked-files=all'], READ_CWD).split('\n').filter((line) => line.length > 0)
    const cliStaged = new Set()
    const cliUnstaged = new Set()
    const cliUntracked = new Set()
    const cliConflicted = new Set()
    for (const line of porcelain) {
      const x = line[0]
      const y = line[1]
      const path = line.slice(3).replace(/^"|"$/g, '')
      if (x === '?' && y === '?') cliUntracked.add(path)
      else if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) cliConflicted.add(path)
      else {
        if (x !== ' ' && x !== '?') cliStaged.add(path)
        if (y !== ' ' && y !== '?') cliUnstaged.add(path)
      }
    }
    const rpcPaths = (rows) => new Set(rows.map((row) => row.path))
    const cmp = (label, cli, rpcArr) => {
      const rpc = rpcPaths(rpcArr)
      const missing = [...cli].filter((p) => !rpc.has(p))
      const extra = [...rpc].filter((p) => !cli.has(p))
      assert(missing.length === 0 && extra.length === 0, `${label} 不一致 缺=${JSON.stringify(missing)} 多=${JSON.stringify(extra)}`)
    }
    cmp('staged', cliStaged, data.status.staged)
    cmp('unstaged', cliUnstaged, data.status.unstaged)
    cmp('untracked', cliUntracked, data.status.untracked)
    cmp('conflicted', cliConflicted, data.status.conflicted)
    return `staged=${cliStaged.size} unstaged=${cliUnstaged.size} untracked=${cliUntracked.size}`
  })
  await check('非仓库目录 → ok:true + repo.isRepo=false', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gm-nonrepo-'))
    try {
      const data = await rpcOk('snapshot', {}, dir)
      assert(data?.repo?.isRepo === false, `期望 isRepo=false，实际 ${JSON.stringify(data?.repo)}`)
      return `isRepo=false @ ${dir}`
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  // ── 2. graph（真实仓库，只读）──────────────────────────────────────────
  console.log('\n[2] graph（只读）')
  await check('graph 行结构与 git log 一致', async () => {
    const data = await rpcOk('graph')
    assert(Array.isArray(data.lines) && data.lines.length > 0, 'lines 为空')
    assert(typeof data.truncated === 'boolean', 'truncated 不是 boolean')
    const commits = data.lines.filter((line) => typeof line.full === 'string' && line.full.length > 0)
    assert(commits.length > 0, '没有任何提交行')
    for (const line of data.lines) {
      assert(typeof line.graph === 'string', 'graph 行缺少 graph 前缀')
      assert(Array.isArray(line.refs), 'graph 行 refs 不是数组')
      assert(typeof line.author === 'string', 'graph 行 author 不是字符串')
      assert(typeof line.date === 'string', 'graph 行 date 不是字符串')
      assert(typeof line.subject === 'string', 'graph 行 subject 不是字符串')
      if (line.full !== null) assert(/^[0-9a-f]{40}$/.test(line.full), `full 不是 40 位 hash：${line.full}`)
      if (line.hash !== null) assert(/^[0-9a-f]{7,}$/.test(line.hash), `hash 异常：${line.hash}`)
    }
    const first = commits[0]
    const cli = gitOk(['log', '-1', '--pretty=format:%H%x1f%h%x1f%s', '--all'], READ_CWD).split('\x1f')
    assert(first.full === cli[0], `首个提交 full 不一致：rpc=${first.full} cli=${cli[0]}`)
    assert(first.subject === cli[2], `首个提交 subject 不一致：rpc=${first.subject} cli=${cli[2]}`)
    return `${data.lines.length} 行 / ${commits.length} 提交，首个 ${first.hash} ${first.subject.slice(0, 24)}`
  })
  await check('graph limit 边界（1 / 9999 不报错）', async () => {
    const small = await rpcOk('graph', { limit: 1 })
    const big = await rpcOk('graph', { limit: 9999 })
    assert(Array.isArray(small.lines), 'limit=1 返回结构异常')
    assert(Array.isArray(big.lines), 'limit=9999 返回结构异常')
    return `limit=1 -> ${small.lines.length} 行, limit=9999 -> ${big.lines.length} 行`
  })

  // ── 3. disposable 仓库：写操作 + diff ─────────────────────────────────
  console.log('\n[3] 写操作 / diff（disposable 仓库）')
  const scratch = await mkdtemp(join(tmpdir(), 'gm-smoke-repo-'))
  const created = [scratch]
  try {
    gitOk(['init', '-q', '-b', 'main'], scratch)
    gitOk(['config', 'user.name', 'git-manager smoke'], scratch)
    gitOk(['config', 'user.email', 'smoke@example.invalid'], scratch)
    await writeFile(join(scratch, 'a.txt'), 'line1\nline2\nline3\n')
    gitOk(['add', 'a.txt'], scratch)
    gitOk(['commit', '-q', '-m', 'chore: initial'], scratch)
    await writeFile(join(scratch, 'a.txt'), 'line1\nline2-changed\nline3\nline4\n')
    await writeFile(join(scratch, 'b.txt'), 'brand new\n')

    await check('diff worktree：hunk 行号与种类合法', async () => {
      const data = await rpcOk('diff', { mode: 'worktree', path: 'a.txt' }, scratch)
      assert(data.mode === 'worktree', `mode=${data.mode}`)
      assert(data.path === 'a.txt', `path=${data.path}`)
      assert(data.binary === false, 'binary 应为 false')
      assert(typeof data.raw === 'string' && data.raw.includes('@@'), 'raw 缺少 @@ 头')
      assert(Number.isInteger(data.additions) && data.additions > 0, `additions=${data.additions}`)
      assert(Number.isInteger(data.deletions) && data.deletions > 0, `deletions=${data.deletions}`)
      assert(Array.isArray(data.hunks) && data.hunks.length > 0, 'hunks 为空')
      let added = 0
      let deleted = 0
      for (const hunk of data.hunks) {
        assert(typeof hunk.header === 'string' && hunk.header.startsWith('@@'), `hunk.header=${hunk.header}`)
        assert(Array.isArray(hunk.lines), 'hunk.lines 不是数组')
        for (const line of hunk.lines) {
          assertIn(line.kind, KINDS, 'hunk line.kind')
          assert(typeof line.text === 'string', 'hunk line.text 不是字符串')
          if (line.kind === 'add') {
            added += 1
            assert(Number.isInteger(line.new), `add 行缺少 new 行号：${JSON.stringify(line)}`)
          } else if (line.kind === 'del') {
            deleted += 1
            assert(Number.isInteger(line.old), `del 行缺少 old 行号：${JSON.stringify(line)}`)
          } else {
            assert(Number.isInteger(line.old) && Number.isInteger(line.new), `ctx 行缺少 old/new 行号：${JSON.stringify(line)}`)
          }
        }
      }
      assert(added === data.additions, `hunks 内 add 行数 ${added} != additions ${data.additions}`)
      assert(deleted === data.deletions, `hunks 内 del 行数 ${deleted} != deletions ${data.deletions}`)
      return `+${data.additions} -${data.deletions}, ${data.hunks.length} hunk`
    })
    await check('diff untracked（含未跟踪文件）', async () => {
      const data = await rpcOk('diff', { mode: 'untracked', path: 'b.txt' }, scratch)
      assert(data.mode === 'untracked', `mode=${data.mode}`)
      assert(typeof data.raw === 'string' && data.raw.length > 0, 'raw 为空')
      assert(data.additions >= 1, `additions=${data.additions}`)
      return `+${data.additions} -${data.deletions}`
    })
    await check('diff 空差异 → hunks [] / raw ""', async () => {
      const data = await rpcOk('diff', { mode: 'worktree', path: 'nonexistent.txt' }, scratch)
      assert(Array.isArray(data.hunks) && data.hunks.length === 0, `hunks=${JSON.stringify(data.hunks).slice(0, 120)}`)
      assert(data.raw === '', `raw 非空：${data.raw.slice(0, 80)}`)
      return 'hunks=[] raw=""'
    })
    await check('stage → 进入 staged', async () => {
      const data = await rpcOk('stage', { paths: ['a.txt'] }, scratch)
      assert(typeof data.output === 'string', 'data.output 不是字符串')
      const snap = await rpcOk('snapshot', {}, scratch)
      assert(snap.status.staged.some((row) => row.path === 'a.txt'), 'staged 中看不到 a.txt')
      return `output=${JSON.stringify(data.output.slice(0, 40))}`
    })
    await check('diff staged 与 worktree 不同且非空', async () => {
      const staged = await rpcOk('diff', { mode: 'staged', path: 'a.txt' }, scratch)
      assert(staged.mode === 'staged', `mode=${staged.mode}`)
      assert(staged.additions > 0 && staged.raw.length > 0, 'staged diff 为空')
      return `+${staged.additions} -${staged.deletions}`
    })
    await check('unstage → 移出 staged', async () => {
      await rpcOk('unstage', { paths: ['a.txt'] }, scratch)
      const snap = await rpcOk('snapshot', {}, scratch)
      assert(!snap.status.staged.some((row) => row.path === 'a.txt'), 'a.txt 仍在 staged')
      return 'staged 已清空 a.txt'
    })
    await check('stage all / unstage all', async () => {
      await rpcOk('stage', { all: true }, scratch)
      let snap = await rpcOk('snapshot', {}, scratch)
      assert(snap.status.staged.length >= 2, `stage -A 后 staged 只有 ${snap.status.staged.length} 项`)
      await rpcOk('unstage', { all: true }, scratch)
      snap = await rpcOk('snapshot', {}, scratch)
      assert(snap.status.staged.length === 0, `unstage --all 后 staged 仍有 ${snap.status.staged.length} 项`)
      return 'all 暂存/取消暂存 OK'
    })
    await check('commit → hash/subject 落库', async () => {
      await rpcOk('stage', { all: true }, scratch)
      const data = await rpcOk('commit', { message: 'feat: smoke commit' }, scratch)
      assert(typeof data.hash === 'string' && data.hash.length >= 7, `hash=${JSON.stringify(data.hash)}`)
      assert(typeof data.subject === 'string' && data.subject.length > 0, 'subject 为空')
      assert(typeof data.output === 'string', 'output 不是字符串')
      const cliHash = gitOk(['log', '-1', '--pretty=format:%H'], scratch).trim()
      assert(cliHash.startsWith(data.hash) || data.hash.startsWith(cliHash.slice(0, data.hash.length)), `hash 与 git log 不一致：rpc=${data.hash} cli=${cliHash}`)
      const cliSubject = gitOk(['log', '-1', '--pretty=format:%s'], scratch).trim()
      assert(cliSubject === data.subject, `subject 不一致：rpc=${data.subject} cli=${cliSubject}`)
      const snap = await rpcOk('snapshot', {}, scratch)
      assert(snap.status.staged.length === 0, 'commit 后仍有 staged 项')
      return `${data.hash.slice(0, 7)} ${data.subject}`
    })
    await check('diff commit 模式（点开提交 diff 的 API 侧证据）', async () => {
      const head = gitOk(['rev-parse', 'HEAD'], scratch).trim()
      const data = await rpcOk('diff', { mode: 'commit', hash: head }, scratch)
      assert(data.mode === 'commit', `mode=${data.mode}`)
      assert(typeof data.raw === 'string' && data.raw.includes('diff --git'), 'raw 缺少 diff --git 头')
      return `${data.raw.split('\n').length} 行 patch`
    })
    await check('commit 空 message → invalid-params', async () => {
      const { status, error } = await rpcErr('commit', { message: '   ' }, scratch)
      assert(ERROR_CODES.includes(error?.code), `error.code=${JSON.stringify(error?.code)}`)
      assert(typeof error?.message === 'string' && error.message.length > 0, 'error.message 为空')
      return `${status}, code=${error.code}`
    })
    await check('switchBranch create → 切换 → 删回', async () => {
      const created2 = await rpcOk('switchBranch', { name: 'smoke-branch', create: true }, scratch)
      assert(created2.branch === 'smoke-branch', `data.branch=${created2.branch}`)
      let snap = await rpcOk('snapshot', {}, scratch)
      assert(snap.repo.branch === 'smoke-branch', `snapshot branch=${snap.repo.branch}`)
      const back = await rpcOk('switchBranch', { name: 'main' }, scratch)
      assert(back.branch === 'main', `切回 main 失败：${back.branch}`)
      await rpcOk('deleteBranch', { name: 'smoke-branch' }, scratch)
      const branches = gitOk(['branch', '--format=%(refname:short)'], scratch).split('\n').filter(Boolean)
      assert(!branches.includes('smoke-branch'), '分支仍然存在')
      return 'create/switch/delete OK'
    })

    // ── 4. 网络 op：失败时错误可见（scratch 仓库没有 remote）────────────
    console.log('\n[4] 网络 op 失败时错误可读（无 remote 的仓库）')
    await check('pull 无 upstream → ok:false + 可读 message', async () => {
      const { status, error } = await rpcErr('pull', {}, scratch)
      assert(ERROR_CODES.includes(error?.code), `error.code=${JSON.stringify(error?.code)}`)
      assert(typeof error?.message === 'string' && error.message.length > 0, 'error.message 为空（错误不可见）')
      assert(/pull|tracking|remote|upstream|fatal/i.test(error.message), `message 不像 git 报错：${error.message.slice(0, 200)}`)
      return `${status}, code=${error.code}: ${error.message.slice(0, 80)}`
    })
    await check('push 无目标 → ok:false + 可读 message', async () => {
      const { status, error } = await rpcErr('push', {}, scratch)
      assert(ERROR_CODES.includes(error?.code), `error.code=${JSON.stringify(error?.code)}`)
      assert(typeof error?.message === 'string' && error.message.length > 0, 'error.message 为空（错误不可见）')
      assert(/push|remote|destination|fatal/i.test(error.message), `message 不像 git 报错：${error.message.slice(0, 200)}`)
      return `${status}, code=${error.code}: ${error.message.slice(0, 80)}`
    })
    await check('fetch 无 remote（成功或失败都必须结构化）', async () => {
      const res = await post({ op: 'fetch', cwd: scratch })
      assert(res.status === 200, `status=${res.status}`)
      if (res.json?.ok === true) {
        assert(typeof res.json.data?.output === 'string', 'fetch 成功但 data.output 不是字符串')
        return `ok:true output=${JSON.stringify(res.json.data.output.slice(0, 40))}`
      }
      assertIn(res.json?.error?.code, ERROR_CODES, 'error.code')
      assert(typeof res.json.error.message === 'string' && res.json.error.message.length > 0, 'error.message 为空')
      return `ok:false code=${res.json.error.code}`
    })

    // ── 5. AI 提交信息 ─────────────────────────────────────────────────
    console.log('\n[5] aiCommit')
    await check('aiCommit → 成功结构或 ai-unavailable 降级', async () => {
      await writeFile(join(scratch, 'a.txt'), 'line1\nline2-changed\nline3\nline4\nline5\n')
      await rpcOk('stage', { all: true }, scratch)
      const res = await post({ op: 'aiCommit', cwd: scratch, hint: 'smoke' })
      assert(res.status === 200, `status=${res.status}`)
      assert(res.json && typeof res.json.ok === 'boolean', '响应缺少 ok')
      if (res.json.ok === true) {
        const { message, model, fallback } = res.json.data ?? {}
        assert(typeof message === 'string' && message.trim().length > 0, 'data.message 为空')
        assert(message.length <= 200, `message 过长：${message.length}`)
        assert(typeof model === 'string' && model.includes('/'), `data.model 应为 provider/model，实际 ${JSON.stringify(model)}`)
        assert(typeof fallback === 'boolean', `data.fallback 不是 boolean：${JSON.stringify(fallback)}`)
        return `"${message.slice(0, 48)}" model=${model} fallback=${fallback}`
      }
      assert(res.json.error?.code === 'ai-unavailable', `aiCommit 失败但 code=${JSON.stringify(res.json.error?.code)}（期望 ai-unavailable）`)
      return 'ok:false code=ai-unavailable（降级路径，符合协议）'
    })
    await check('非仓库目录的写操作 → not-a-repo 错误', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'gm-nonrepo-'))
      created.push(dir)
      const { status, error } = await rpcErr('stage', { all: true }, dir)
      assert(error?.code === 'not-a-repo', `期望 not-a-repo，实际 ${JSON.stringify(error?.code)}`)
      return `${status}, code=${error.code}`
    })
  } finally {
    if (KEEP) console.log(`\n保留 disposable 目录：${scratch}`)
    else for (const dir of created) await rm(dir, { recursive: true, force: true })
  }

  // ── 汇总 ─────────────────────────────────────────────────────────────
  console.log(`\n通过 ${passed}，失败 ${failures.length}`)
  if (failures.length > 0) {
    console.log('\n失败明细：')
    for (const item of failures) console.log(` - ${item.name}: ${item.message.split('\n')[0]}`)
    process.exit(1)
  }
  console.log('全部通过 ✅')
}

main().catch((error) => {
  console.error(`\nsmoke 运行异常：${error instanceof Error ? error.stack : error}`)
  process.exit(1)
})
