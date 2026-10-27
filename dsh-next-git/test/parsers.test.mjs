import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GRAPH_PALETTE_SIZE,
  GitError,
  assignGraphColors,
  attachInlineHunks,
  cleanGitEnv,
  classifyEntries,
  diffInline,
  parseBranches,
  parseBranchHeader,
  parseGraph,
  parsePorcelain,
  parseRemotes,
  parseStashes,
  parseTrack,
  parseUnifiedDiff,
  refColorIndex,
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
  // 配对的删除/新增行会带上词级片段（inline）；未配对的新增行没有。
  assert.deepEqual(parsed.hunks[0].lines[1], {
    kind: 'del',
    text: 'const b = 2',
    old: 2,
    inline: [
      { text: 'const b = ', changed: false },
      { text: '2', changed: true },
    ],
  })
  assert.deepEqual(parsed.hunks[0].lines[3], { kind: 'add', text: 'const c = 4', new: 3 })
})

test('GitError 保留 code 与 stderr', () => {
  const error = new GitError('boom', { code: 'not-a-repo', stderr: 'fatal: x' })
  assert.equal(error.code, 'not-a-repo')
  assert.equal(error.stderr, 'fatal: x')
  assert.equal(error.name, 'GitError')
})

test('diffInline 只高亮真正变化的词（英文）', () => {
  const { before, after } = diffInline('const total = price * count', 'const total = price * quantity')
  assert.deepEqual(before, [
    { text: 'const total = price * ', changed: false },
    { text: 'count', changed: true },
  ])
  assert.deepEqual(after, [
    { text: 'const total = price * ', changed: false },
    { text: 'quantity', changed: true },
  ])
})

test('diffInline 对中文按字切分，不会整行高亮', () => {
  const { before, after } = diffInline('这是旧的中文说明文字', '这是新的中文说明文字')
  assert.deepEqual(before, [
    { text: '这是', changed: false },
    { text: '旧', changed: true },
    { text: '的中文说明文字', changed: false },
  ])
  assert.deepEqual(after, [
    { text: '这是', changed: false },
    { text: '新', changed: true },
    { text: '的中文说明文字', changed: false },
  ])
})

test('diffInline 纯增删与超长行退化为整段标记', () => {
  assert.deepEqual(diffInline('', 'new line'), {
    before: [{ text: '', changed: false }],
    after: [{ text: 'new line', changed: true }],
  })
  const long = 'x'.repeat(5000)
  const result = diffInline(long + 'a', long + 'b')
  assert.equal(result.before.length, 1)
  assert.equal(result.after.length, 1)
})

test('attachInlineHunks 按下标配对删除块与新增块', () => {
  const lines = attachInlineHunks([
    { kind: 'ctx', text: 'same' },
    { kind: 'del', text: 'let a = 1' },
    { kind: 'del', text: 'let b = 2' },
    { kind: 'add', text: 'let a = 10' },
    { kind: 'add', text: 'let b = 20' },
    { kind: 'add', text: 'let c = 30' },
    { kind: 'ctx', text: 'tail' },
  ])
  // 两对配对成功，多出来的新增行保持整行不挂 inline。
  assert.deepEqual(lines[1].inline, [
    { text: 'let a = ', changed: false },
    { text: '1', changed: true },
  ])
  assert.deepEqual(lines[3].inline, [
    { text: 'let a = ', changed: false },
    { text: '10', changed: true },
  ])
  assert.equal(lines[5].inline, undefined)
  assert.equal(lines[0].inline, undefined)
})

test('assignGraphColors 保证同屏出现的分支互不同色（哈希碰撞回归）', () => {
  // 曾经用「名字哈希取模」分配，feat/streaming 与 fix/empty-input 会撞在同一个色号上。
  const lines = [
    { graph: '*   ', refs: ['HEAD -> main'] },
    { graph: '|\\  ', refs: [] },
    { graph: '| * ', refs: ['fix/empty-input'] },
    { graph: '* | ', refs: [] },
    { graph: '| * ', refs: ['feat/streaming'] },
    { graph: '|/', refs: [] },
  ]
  const colors = assignGraphColors(lines, 4)
  const used = []
  for (let index = 0; index < lines.length; index += 1) {
    const dot = lines[index].graph.indexOf('*')
    if (dot >= 0 && lines[index].refs.length > 0) used.push(colors[index][dot])
  }
  assert.equal(used.length, 3)
  assert.equal(new Set(used).size, 3, '三条分支必须三种颜色')
})

test('assignGraphColors 让同一条分支线跨行保持同色', () => {
  const lines = [
    { graph: '* ', refs: ['HEAD -> main'] },
    { graph: '|\\', refs: [] },
    { graph: '| *', refs: ['feat/x'] },
    { graph: '| *', refs: [] },
    { graph: '* |', refs: [] },
    { graph: '|/', refs: [] },
    { graph: '* ', refs: [] },
  ]
  const colors = assignGraphColors(lines, 3)
  assert.equal(colors.length, lines.length)
  // 每个格子要么是有效色号要么是 -1（该格无连接）。
  for (const row of colors) {
    for (const color of row) assert.ok(color === -1 || (color >= 0 && color < GRAPH_PALETTE_SIZE))
  }
  // 第 2、3 行的第二 lane 是同一条分支，必须同色。
  assert.equal(colors[2][2], colors[3][2])
  // 第 0 行是 HEAD，独占第一个色号（顺序分配的起点）。
  assert.equal(colors[0][0], 0)
})

test('parseGraph 附带 colors 与 refColor，且空输入不炸', () => {
  // 真实 git log --graph --pretty=format:%H 把图前缀与 40 位 hash 放在同一字段。
  const shaA = 'a'.repeat(40)
  const shaB = 'b'.repeat(40)
  const raw = [
    `*   ${shaA}\x1faaaaaaa\x1fAnn\x1f1 day ago\x1fHEAD -> main\x1ffirst commit`,
    `| * ${shaB}\x1fbbbbbbb\x1fBob\x1f2 days ago\x1f\x1fsecond commit`,
  ].join('\n')
  const lines = parseGraph(raw)
  assert.equal(lines.length, 2)
  assert.ok(Array.isArray(lines[0].colors))
  // HEAD 所在行分配第一个色号，且 refColor 与线条色号来自同一次分配。
  assert.equal(lines[0].refColor, lines[0].colors[0])
  assert.equal(lines[1].refColor, undefined)
  assert.deepEqual(parseGraph(''), [])
})