import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GitError,
  cleanGitEnv,
  classifyEntries,
  parseBranches,
  parseBranchHeader,
  parseGraph,
  parsePorcelain,
  parseRemotes,
  parseStashes,
  parseTrack,
  parseUnifiedDiff,
} from '../src/git.js'

test('cleanGitEnv 去掉损坏的 GIT_CONFIG_* 并固定非交互环境', () => {
  const env = cleanGitEnv({
    PATH: '/usr/bin',
    HOME: '/tmp/home',
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_VALUE_0: 'false',
    GIT_CONFIG_VALUE_1: 'false',
    GIT_CONFIG_KEY_0: 'safe.directory',
    GIT_TERMINAL_PROMPT: '1',
  })
  assert.equal(env.PATH, '/usr/bin')
  assert.equal(env.HOME, '/tmp/home')
  // Host 的 subprocess provider 合并父环境：删除必须靠 undefined 墓碑，键本身要存在。
  assert.ok('GIT_CONFIG_COUNT' in env)
  assert.equal(env.GIT_CONFIG_COUNT, undefined)
  assert.ok('GIT_CONFIG_VALUE_0' in env)
  assert.equal(env.GIT_CONFIG_VALUE_0, undefined)
  assert.ok('GIT_CONFIG_KEY_0' in env)
  assert.equal(env.GIT_CONFIG_KEY_0, undefined)
  assert.equal(env.GIT_CONFIG_KEY_15, undefined)
  assert.equal(env.GIT_TERMINAL_PROMPT, '0')
  assert.equal(env.GIT_PAGER, 'cat')
  assert.equal(env.LC_ALL, 'C')
})

test('parsePorcelain 解析分支头、重命名与四类变更', () => {
  const raw = [
    '## main...origin/main [ahead 1, behind 2]',
    'M  src/staged.js',
    ' M src/unstaged.js',
    '?? new.txt',
    'UU both.js',
    'R  src/new-name.js',
    'src/old-name.js',
    '',
  ].join('\u0000')
  const { branchLine, entries } = parsePorcelain(raw)
  assert.equal(branchLine, 'main...origin/main [ahead 1, behind 2]')
  assert.equal(entries.length, 5)
  assert.deepEqual(entries[4], {
    x: 'R',
    y: ' ',
    path: 'src/new-name.js',
    oldPath: 'src/old-name.js',
  })
  const head = parseBranchHeader(branchLine)
  assert.equal(head.branch, 'main')
  assert.equal(head.upstream, 'origin/main')
  assert.equal(head.ahead, 1)
  assert.equal(head.behind, 2)
  const groups = classifyEntries(entries)
  assert.deepEqual(groups.staged.map((item) => item.path), ['src/staged.js', 'src/new-name.js'])
  assert.deepEqual(groups.unstaged.map((item) => item.path), ['src/unstaged.js'])
  assert.deepEqual(groups.untracked.map((item) => item.path), ['new.txt'])
  assert.deepEqual(groups.conflicted.map((item) => item.path), ['both.js'])
})

test('parseBranchHeader 处理 detached / 无提交 / 无 upstream', () => {
  assert.deepEqual(parseBranchHeader('HEAD (no branch)'), {
    branch: null,
    upstream: null,
    upstreamGone: false,
    ahead: 0,
    behind: 0,
    detached: true,
    noCommits: false,
  })
  const fresh = parseBranchHeader('No commits yet on main')
  assert.equal(fresh.branch, 'main')
  assert.equal(fresh.noCommits, true)
  const local = parseBranchHeader('feature/x')
  assert.equal(local.branch, 'feature/x')
  assert.equal(local.upstream, null)
  const gone = parseBranchHeader('main...origin/main [gone]')
  assert.equal(gone.upstreamGone, true)
})

test('parseBranches 解析本地/远程分支与跟踪状态', () => {
  const raw = [
    'refs/heads/main\u0000main\u0000abc1234\u0000origin/main\u0000[ahead 1, behind 2]\u00002026-10-22 10:00:00 +0800\u0000feat: 主分支',
    'refs/heads/topic\u0000topic\u0000def5678\u0000\u0000\u00002026-10-21 09:00:00 +0800\u0000wip',
    'refs/remotes/origin/feat\u0000origin/feat\u0000aaa1111\u0000\u0000\u00002026-10-20 09:00:00 +0800\u0000remote work',
    'refs/remotes/origin/HEAD\u0000origin/HEAD\u0000aaa1111\u0000\u0000\u00002026-10-20 09:00:00 +0800\u0000skip me',
  ].join('\n')
  const branches = parseBranches(raw)
  assert.equal(branches.length, 3)
  assert.deepEqual(branches[0], {
    name: 'main',
    kind: 'local',
    current: false,
    upstream: 'origin/main',
    ahead: 1,
    behind: 2,
    gone: false,
    commit: 'abc1234',
    subject: 'feat: 主分支',
    date: '2026-10-22 10:00:00 +0800',
  })
  assert.equal(branches[1].upstream, null)
  assert.equal(branches[2].kind, 'remote')
  assert.equal(parseTrack('[gone]').gone, true)
})

test('parseGraph 分离 graph 前缀、hash 与装饰', () => {
  const raw = [
    '* 1111111111111111111111111111111111111111\x1f1111111\x1fCao\x1f2 hours ago\x1fHEAD -> main, origin/main\x1ffeat: add',
    '| \\ ',
    '* 2222222222222222222222222222222222222222\x1f2222222\x1fBob\x1f3 days ago\x1f\x1ffix: bug',
  ].join('\n')
  const lines = parseGraph(raw)
  assert.equal(lines.length, 3)
  assert.equal(lines[0].graph, '* ')
  assert.equal(lines[0].hash, '1111111')
  assert.deepEqual(lines[0].refs, ['HEAD -> main', 'origin/main'])
  assert.equal(lines[0].subject, 'feat: add')
  assert.equal(lines[1].hash, null)
  assert.equal(lines[1].graph, '| \\ ')
  assert.equal(lines[2].hash, '2222222')
})

test('parseRemotes / parseStashes', () => {
  const remotes = parseRemotes([
    'origin\tgit@github.com:foo/bar.git (fetch)',
    'origin\tgit@github.com:foo/bar.git (push)',
    'upstream\thttps://github.com/baz/qux.git (fetch)',
  ].join('\n'))
  assert.deepEqual(remotes, [
    { name: 'origin', url: 'git@github.com:foo/bar.git' },
    { name: 'upstream', url: 'https://github.com/baz/qux.git' },
  ])
  const stashes = parseStashes('stash@{0}\u0000WIP on main: abc1234 x\nstash@{1}\u0000WIP on topic: def5678 y\n')
  assert.deepEqual(stashes, [
    { index: 0, message: 'WIP on main: abc1234 x' },
    { index: 1, message: 'WIP on topic: def5678 y' },
  ])
})

test('parseUnifiedDiff 逐行解析 hunk 并统计增删', () => {
  const raw = [
    'diff --git a/src/a.js b/src/a.js',
    'index 111..222 100644',
    '--- a/src/a.js',
    '+++ b/src/a.js',
    '@@ -1,3 +1,4 @@ function f() {',
    ' const a = 1',
    '-const b = 2',
    '+const b = 3',
    '+const c = 4',
    ' const d = 5',
    'diff --git a/img.png b/img.png',
    'Binary files a/img.png and b/img.png differ',
  ].join('\n')
  const parsed = parseUnifiedDiff(raw)
  assert.equal(parsed.binary, true)
  assert.equal(parsed.additions, 2)
  assert.equal(parsed.deletions, 1)
  assert.equal(parsed.hunks.length, 1)
  assert.equal(parsed.hunks[0].header, '@@ -1,3 +1,4 @@ function f() {')
  assert.deepEqual(parsed.hunks[0].lines.map((line) => line.kind), ['ctx', 'del', 'add', 'add', 'ctx'])
  assert.deepEqual(parsed.hunks[0].lines[1], { kind: 'del', text: 'const b = 2', old: 2 })
  assert.deepEqual(parsed.hunks[0].lines[3], { kind: 'add', text: 'const c = 4', new: 3 })
})

test('GitError 保留 code 与 stderr', () => {
  const error = new GitError('boom', { code: 'not-a-repo', stderr: 'fatal: x' })
  assert.equal(error.code, 'not-a-repo')
  assert.equal(error.stderr, 'fatal: x')
  assert.equal(error.name, 'GitError')
})
