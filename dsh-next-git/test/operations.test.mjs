import test from 'node:test'
import assert from 'node:assert/strict'
import { createOperations } from '../src/operations.js'
import { GitError } from '../src/git.js'

const ROOT = '/tmp/repo'
const CWD = '/tmp/repo/sub'

/** 构造按参数分发的假 exec，并记录调用。 */
function makeExec(routes) {
  /** @type {Array<{args: string[], opts: object}>} */
  const calls = []
  const exec = async (argv, opts) => {
    const args = argv.slice(1)
    calls.push({ args, opts })
    for (const [match, handler] of routes) {
      const hit = typeof match === 'function'
        ? match(args)
        : match.every((value, index) => (typeof value === 'function' ? value(args[index], args) : args[index] === value))
      if (hit) return typeof handler === 'function' ? handler(args, opts) : handler
    }
    return { code: 0, stdout: '', stderr: '' }
  }
  return { exec, calls }
}

const ok = (stdout = '') => ({ code: 0, stdout, stderr: '' })
const failed = (stderr = 'boom', code = 128) => ({ code, stdout: '', stderr })

const PORCELAIN = [
  '## main...origin/main [ahead 3, behind 1]',
  'M  src/staged.js',
  ' M src/unstaged.js',
  '?? new.txt',
  'UU both.js',
  '',
].join('\u0000')

const BRANCHES = [
  'refs/heads/main\u0000main\u0000abc1234\u0000origin/main\u0000[ahead 3, behind 1]\u00002026-10-22 10:00:00 +0800\u0000feat: main',
  'refs/heads/topic\u0000topic\u0000def5678\u0000\u0000\u00002026-10-21 10:00:00 +0800\u0000wip',
  'refs/remotes/origin/main\u0000origin/main\u0000abc1234\u0000\u0000\u00002026-10-22 10:00:00 +0800\u0000feat: main',
].join('\n')

/** snapshot 相关的标准路由。 */
function snapshotRoutes(overrides = {}) {
  return [
    [['rev-parse', '--show-toplevel'], overrides.root ?? ok(`${ROOT}\n`)],
    [['status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all'], ok(PORCELAIN)],
    [['for-each-ref'], ok(BRANCHES)],
    [['remote', '-v'], ok('origin\tgit@github.com:foo/bar.git (fetch)\norigin\tgit@github.com:foo/bar.git (push)\n')],
    [['stash', 'list', '--format=%gd%x00%s'], ok('')],
    [['rev-parse', '--short', 'HEAD'], ok('abc1234\n')],
    [['config', '--get', 'remote.origin.url'], ok('git@github.com:foo/bar.git\n')],
  ]
}

test('snapshot：非仓库目录返回 isRepo=false 而不是报错', async () => {
  const { exec } = makeExec([[['rev-parse', '--show-toplevel'], failed('fatal: not a git repository')]])
  const ops = createOperations({ exec })
  const data = await ops.handle('snapshot', { cwd: CWD })
  assert.equal(data.repo.isRepo, false)
  assert.deepEqual(data.status.staged, [])
})

test('snapshot：汇总仓库、分支、变更与 stash', async () => {
  const { exec } = makeExec(snapshotRoutes())
  const ops = createOperations({ exec })
  const data = await ops.handle('snapshot', { cwd: CWD })
  assert.equal(data.repo.isRepo, true)
  assert.equal(data.repo.root, ROOT)
  assert.equal(data.repo.name, 'repo')
  assert.equal(data.repo.branch, 'main')
  assert.equal(data.repo.ahead, 3)
  assert.equal(data.repo.behind, 1)
  assert.equal(data.repo.head, 'abc1234')
  assert.equal(data.repo.remoteUrl, 'git@github.com:foo/bar.git')
  assert.equal(data.branches.length, 3)
  assert.equal(data.branches.find((branch) => branch.name === 'main').current, true)
  assert.equal(data.branches.find((branch) => branch.name === 'topic').current, false)
  assert.equal(data.status.clean, false)
  assert.deepEqual(data.status.staged.map((item) => item.path), ['src/staged.js'])
  assert.deepEqual(data.status.unstaged.map((item) => item.path), ['src/unstaged.js'])
  assert.deepEqual(data.status.untracked.map((item) => item.path), ['new.txt'])
  assert.deepEqual(data.status.conflicted.map((item) => item.path), ['both.js'])
})

test('snapshot：cwd 非绝对路径直接拒绝', async () => {
  const { exec } = makeExec([])
  const ops = createOperations({ exec })
  await assert.rejects(
    () => ops.handle('snapshot', { cwd: 'relative/path' }),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
})

test('graph：解析 git log --graph 输出', async () => {
  const graphRaw = [
    '* 1111111111111111111111111111111111111111\x1f1111111\x1fCao\x1f2 hours ago\x1fHEAD -> main\x1ffeat: x',
    '| * 2222222222222222222222222222222222222222\x1f2222222\x1fBob\x1f1 day ago\x1f\x1ffix: y',
  ].join('\n')
  const { exec, calls } = makeExec([
    [['rev-parse', '--show-toplevel'], ok(`${ROOT}\n`)],
    [['log'], ok(graphRaw)],
  ])
  const ops = createOperations({ exec })
  const data = await ops.handle('graph', { cwd: CWD, limit: 30 })
  assert.equal(data.lines.length, 2)
  assert.equal(data.lines[0].hash, '1111111')
  const logCall = calls.find((call) => call.args[0] === 'log')
  assert.ok(logCall.args.includes('-n'))
  assert.ok(logCall.args.includes('30'))
})

test('diff worktree：返回 hunk 与增删统计，路径放在 -- 之后', async () => {
  const raw = [
    'diff --git a/src/a.js b/src/a.js',
    '--- a/src/a.js',
    '+++ b/src/a.js',
    '@@ -1,2 +1,2 @@',
    ' const a = 1',
    '-const b = 2',
    '+const b = 3',
  ].join('\n')
  const { exec, calls } = makeExec([
    [['rev-parse', '--show-toplevel'], ok(`${ROOT}\n`)],
    [['diff'], ok(raw)],
  ])
  const ops = createOperations({ exec })
  const data = await ops.handle('diff', { cwd: CWD, mode: 'worktree', path: 'src/a.js' })
  assert.equal(data.additions, 1)
  assert.equal(data.deletions, 1)
  assert.equal(data.hunks.length, 1)
  assert.equal(data.path, 'src/a.js')
  const diffCall = calls.find((call) => call.args[0] === 'diff')
  assert.deepEqual(diffCall.args.slice(0, 3), ['diff', '--no-color', '--'])
  assert.equal(diffCall.args.at(-1), 'src/a.js')
})

test('diff untracked：必须以 path 调用 --no-index，且退出码 1 不算失败', async () => {
  const raw = 'diff --git a/new.txt b/new.txt\n--- /dev/null\n+++ b/new.txt\n@@ -0,0 +1 @@\n+hello\n'
  const { exec, calls } = makeExec([
    [['rev-parse', '--show-toplevel'], ok(`${ROOT}\n`)],
    [['diff'], { code: 1, stdout: raw, stderr: '' }],
  ])
  const ops = createOperations({ exec })
  const data = await ops.handle('diff', { cwd: CWD, mode: 'untracked', path: 'new.txt' })
  assert.equal(data.additions, 1)
  const call = calls.find((entry) => entry.args[0] === 'diff')
  assert.ok(call.args.includes('--no-index'))
  await assert.rejects(
    () => ops.handle('diff', { cwd: CWD, mode: 'untracked' }),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
})

test('diff commit：hash 非法时拒绝（防选项注入）', async () => {
  const { exec } = makeExec([[['rev-parse', '--show-toplevel'], ok(`${ROOT}\n`)]])
  const ops = createOperations({ exec })
  await assert.rejects(
    () => ops.handle('diff', { cwd: CWD, mode: 'commit', hash: '--upload-pack=evil' }),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
})

test('stage / unstage：all 与 paths 两种形态', async () => {
  const { exec, calls } = makeExec([[['rev-parse', '--show-toplevel'], ok(`${ROOT}\n`)]])
  const ops = createOperations({ exec })
  await ops.handle('stage', { cwd: CWD, all: true })
  await ops.handle('stage', { cwd: CWD, paths: ['a.js', '-b.js'] })
  await ops.handle('unstage', { cwd: CWD, all: true })
  await ops.handle('unstage', { cwd: CWD, paths: ['a.js'] })
  const addAll = calls.find((call) => call.args[0] === 'add' && call.args[1] === '-A')
  assert.ok(addAll)
  const addPaths = calls.find((call) => call.args[0] === 'add' && call.args[1] === '--')
  assert.deepEqual(addPaths.args, ['add', '--', 'a.js', './-b.js'])
  assert.ok(calls.find((call) => call.args[0] === 'reset'))
  assert.deepEqual(calls.find((call) => call.args[0] === 'restore').args, ['restore', '--staged', '--', 'a.js'])
})

test('switchBranch：本地分支直接 checkout，远程分支建跟踪分支', async () => {
  const routes = [
    [['rev-parse', '--show-toplevel'], ok(`${ROOT}\n`)],
    [['for-each-ref', '--format=%(refname:short)', 'refs/remotes'], ok('origin/feat\norigin/main\n')],
    [['checkout', '-b', 'feat', '--track', 'origin/feat'], ok("Switched to a new branch 'feat'\n")],
    [['checkout', 'main'], ok("Switched to branch 'main'\n")],
    [['rev-parse', '--abbrev-ref', 'HEAD'], ok('feat\n')],
  ]
  const { exec, calls } = makeExec(routes)
  const ops = createOperations({ exec })
  await ops.handle('switchBranch', { cwd: CWD, name: 'main' })
  const data = await ops.handle('switchBranch', { cwd: CWD, name: 'origin/feat' })
  assert.equal(data.branch, 'feat')
  assert.ok(calls.some((call) => call.args.join(' ') === 'checkout -b feat --track origin/feat'))
})

test('switchBranch：create 走 checkout -b', async () => {
  const { exec, calls } = makeExec([
    [['rev-parse', '--show-toplevel'], ok(`${ROOT}\n`)],
    [['checkout', '-b', 'newbie'], ok('')],
    [['rev-parse', '--abbrev-ref', 'HEAD'], ok('newbie\n')],
  ])
  const ops = createOperations({ exec })
  const data = await ops.handle('switchBranch', { cwd: CWD, name: 'newbie', create: true })
  assert.equal(data.branch, 'newbie')
  assert.ok(calls.some((call) => call.args.join(' ') === 'checkout -b newbie'))
})

test('commit：空信息拒绝，成功后返回 hash 与 subject', async () => {
  const { exec } = makeExec([
    [['rev-parse', '--show-toplevel'], ok(`${ROOT}\n`)],
    [['commit', '-m', 'feat: x'], ok('[main 1234567] feat: x\n')],
    [['rev-parse', '--short', 'HEAD'], ok('1234567\n')],
    [['log', '-1', '--pretty=format:%s'], ok('feat: x\n')],
  ])
  const ops = createOperations({ exec })
  await assert.rejects(
    () => ops.handle('commit', { cwd: CWD, message: '   ' }),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
  const data = await ops.handle('commit', { cwd: CWD, message: 'feat: x' })
  assert.equal(data.hash, '1234567')
  assert.equal(data.subject, 'feat: x')
})

test('push：无 upstream 时使用 -u origin <branch>', async () => {
  const { exec, calls } = makeExec([
    [['rev-parse', '--show-toplevel'], ok(`${ROOT}\n`)],
    [['rev-parse', '--abbrev-ref', 'HEAD'], ok('topic\n')],
    [['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], failed('fatal: no upstream')],
    [['push', '-u', 'origin', 'topic'], ok('')],
  ])
  const ops = createOperations({ exec })
  const data = await ops.handle('push', { cwd: CWD })
  assert.equal(data.branch, 'topic')
  assert.ok(calls.some((call) => call.args.join(' ') === 'push -u origin topic'))
})

test('aiCommit：没有 llm 时降级成确定性文案', async () => {
  const { exec } = makeExec([
    [['rev-parse', '--show-toplevel'], ok(`${ROOT}\n`)],
    [['diff', '--cached', '--no-color'], ok('')],
    [['diff', '--no-color'], ok('diff --git a/a.js b/a.js\n+1\n')],
    [['log', '-8', '--pretty=format:%s'], ok('feat: 新增功能\nfix: 修复缺陷\n')],
    [['status', '--porcelain'], ok(' M a.js\n')],
  ])
  const ops = createOperations({ exec, ai: () => null })
  const data = await ops.handle('aiCommit', { cwd: CWD })
  assert.equal(data.fallback, true)
  assert.match(data.message, /^chore: /)
})

test('超时：exec 卡住时按 timeout 报错，code=timeout', async () => {
  const exec = (argv, opts) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ code: 0, stdout: `${ROOT}\n`, stderr: '' }), 500)
    opts.signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }, { once: true })
  })
  const ops = createOperations({ exec, timeouts: { read: 30 } })
  await assert.rejects(
    () => ops.handle('snapshot', { cwd: CWD }),
    (error) => error instanceof GitError && error.code === 'timeout',
  )
})

test('未知 op / 非对象参数报 invalid-params', async () => {
  const { exec } = makeExec([])
  const ops = createOperations({ exec })
  await assert.rejects(
    () => ops.handle('rm-rf', { cwd: CWD }),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
  await assert.rejects(
    () => ops.handle('snapshot', null),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
})
test('discard：按模式选择 git restore / git clean', async () => {
  const routes = [[['rev-parse', '--show-toplevel'], ok(ROOT + '\n')]]
  const { exec, calls } = makeExec(routes)
  const ops = createOperations({ exec })
  await ops.handle('discard', { cwd: CWD, paths: ['a.txt'], mode: 'worktree' })
  await ops.handle('discard', { cwd: CWD, paths: ['b.txt'], mode: 'untracked' })
  await ops.handle('discard', { cwd: CWD, paths: ['c.txt'], mode: 'all' })
  const writes = calls.map((call) => call.args.join(' '))
  assert.ok(writes.includes('restore --worktree -- a.txt'), 'worktree 走 restore --worktree')
  assert.ok(writes.includes('clean -f -d -- b.txt'), 'untracked 走 clean -f -d')
  assert.ok(writes.includes('restore --staged --worktree -- c.txt'), 'all 连暂存区一起回退')
})

test('discard：未知模式与空路径都被拒绝', async () => {
  const { exec } = makeExec([[['rev-parse', '--show-toplevel'], ok(ROOT + '\n')]])
  const ops = createOperations({ exec })
  await assert.rejects(
    () => ops.handle('discard', { cwd: CWD, paths: ['a.txt'], mode: 'everything' }),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
  await assert.rejects(
    () => ops.handle('discard', { cwd: CWD, paths: [], mode: 'worktree' }),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
})

test('discard：以 - 开头的路径补 ./ 前缀，避免被当成选项', async () => {
  const { exec, calls } = makeExec([[['rev-parse', '--show-toplevel'], ok(ROOT + '\n')]])
  const ops = createOperations({ exec })
  await ops.handle('discard', { cwd: CWD, paths: ['--force'], mode: 'worktree' })
  assert.ok(calls.some((call) => call.args.join(' ') === 'restore --worktree -- ./--force'))
})

test('stashPush：默认不带 -u，传 includeUntracked 才加', async () => {
  const { exec, calls } = makeExec([[['rev-parse', '--show-toplevel'], ok(ROOT + '\n')]])
  const ops = createOperations({ exec })
  await ops.handle('stashPush', { cwd: CWD })
  await ops.handle('stashPush', { cwd: CWD, message: '临时存一下', includeUntracked: true })
  const writes = calls.map((call) => call.args.join(' '))
  assert.ok(writes.includes('stash push'))
  assert.ok(writes.includes('stash push -u -m 临时存一下'))
})

test('stashPop / stashDrop：索引拼成 stash@{n}，非法索引被拒', async () => {
  const { exec, calls } = makeExec([[['rev-parse', '--show-toplevel'], ok(ROOT + '\n')]])
  const ops = createOperations({ exec })
  await ops.handle('stashPop', { cwd: CWD })
  await ops.handle('stashPop', { cwd: CWD, index: 2 })
  await ops.handle('stashDrop', { cwd: CWD, index: 1 })
  const writes = calls.map((call) => call.args.join(' '))
  assert.ok(writes.includes('stash pop stash@{0}'))
  assert.ok(writes.includes('stash pop stash@{2}'))
  assert.ok(writes.includes('stash drop stash@{1}'))
  await assert.rejects(
    () => ops.handle('stashPop', { cwd: CWD, index: -1 }),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
  await assert.rejects(
    () => ops.handle('stashDrop', { cwd: CWD, index: 1.5 }),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
})

test('setCommitPrompt：写入 --local dsh.commitPrompt，空串则清除', async () => {
  const routes = [
    [['rev-parse', '--show-toplevel'], ok(ROOT + '\n')],
    [['config', '--get', 'dsh.commitPrompt'], ok('自定义规则\n')],
  ]
  const { exec, calls } = makeExec(routes)
  const ops = createOperations({ exec })
  const saved = await ops.handle('setCommitPrompt', { cwd: CWD, prompt: '自定义规则' })
  assert.equal(saved.prompt, '自定义规则')
  assert.ok(calls.some((call) => call.args.join('\u0000') === ['config', '--local', 'dsh.commitPrompt', '自定义规则'].join('\u0000')))
  await ops.handle('setCommitPrompt', { cwd: CWD, prompt: '   ' })
  assert.ok(calls.some((call) => call.args.join(' ') === 'config --local --unset dsh.commitPrompt'))
})

test('setCommitPrompt：超长提示词被拒绝', async () => {
  const { exec } = makeExec([[['rev-parse', '--show-toplevel'], ok(ROOT + '\n')]])
  const ops = createOperations({ exec })
  await assert.rejects(
    () => ops.handle('setCommitPrompt', { cwd: CWD, prompt: 'x'.repeat(4001) }),
    (error) => error instanceof GitError && error.code === 'invalid-params',
  )
})

test('snapshot：带上仓库自定义提交提示词', async () => {
  const routes = snapshotRoutes()
  routes.push([['config', '--get', 'dsh.commitPrompt'], ok('用英文写，不要 emoji\n')])
  const { exec } = makeExec(routes)
  const ops = createOperations({ exec })
  const data = await ops.handle('snapshot', { cwd: CWD })
  assert.equal(data.commitPrompt, '用英文写，不要 emoji')
})