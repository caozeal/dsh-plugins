/**
 * 真实 git 集成测试：用临时仓库跑一遍 snapshot / diff / stage / commit / graph /
 * switchBranch / deleteBranch / aiCommit 降级路径。
 *
 * 不依赖 dsh 运行时；git 子进程通过 node:child_process 直接起，环境经
 * cleanGitEnv 清洗（本机会话的 GIT_CONFIG_* 变量是坏的）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleanGitEnv } from '../src/git.js'
import { createOperations } from '../src/operations.js'

function realExec(argv, { cwd, signal, timeoutMs = 20000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      env: cleanGitEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    const onAbort = () => child.kill('SIGTERM')
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    child.on('error', (error) => {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve({ code, stdout, stderr })
    })
  })
}

async function git(cwd, ...args) {
  const result = await realExec(['git', ...args], { cwd })
  if (result.code !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout
}

test('真实仓库：面板所需的核心 op 全部可用', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-git-manager-'))
  t.after(() => rm(dir, { recursive: true, force: true }))

  await git(dir, 'init', '-b', 'main')
  await git(dir, 'config', 'user.name', 'Git Manager Test')
  await git(dir, 'config', 'user.email', 'git-manager@example.com')
  await git(dir, 'config', 'commit.gpgsign', 'false')
  await writeFile(join(dir, 'a.txt'), 'one\n')
  await git(dir, 'add', '-A')
  await git(dir, 'commit', '-m', 'chore: init repo')

  const ops = createOperations({ exec: realExec, ai: () => null })

  // 1. snapshot：干净仓库 + 当前分支
  let snapshot = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snapshot.repo.isRepo, true)
  assert.equal(snapshot.repo.branch, 'main')
  assert.equal(snapshot.repo.name.endsWith('dsh-git-manager-') ? true : snapshot.repo.name.length > 0, true)
  assert.equal(snapshot.status.clean, true)
  assert.ok(snapshot.branches.some((branch) => branch.name === 'main' && branch.current))

  // 2. 工作区修改 → snapshot 分类 + worktree diff
  await writeFile(join(dir, 'a.txt'), 'one\ntwo\n')
  await writeFile(join(dir, 'b.txt'), 'new file\n')
  snapshot = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snapshot.status.clean, false)
  assert.deepEqual(snapshot.status.unstaged.map((item) => item.path), ['a.txt'])
  assert.deepEqual(snapshot.status.untracked.map((item) => item.path), ['b.txt'])
  const worktreeDiff = await ops.handle('diff', { cwd: dir, mode: 'worktree', path: 'a.txt' })
  assert.equal(worktreeDiff.additions, 1)
  assert.equal(worktreeDiff.deletions, 0)
  assert.equal(worktreeDiff.hunks.length, 1)
  const untrackedDiff = await ops.handle('diff', { cwd: dir, mode: 'untracked', path: 'b.txt' })
  assert.equal(untrackedDiff.additions, 1)

  // 3. 暂存 → staged 分类 + staged diff
  await ops.handle('stage', { cwd: dir, paths: ['a.txt'] })
  snapshot = await ops.handle('snapshot', { cwd: dir })
  assert.deepEqual(snapshot.status.staged.map((item) => item.path), ['a.txt'])
  const stagedDiff = await ops.handle('diff', { cwd: dir, mode: 'staged', path: 'a.txt' })
  assert.equal(stagedDiff.additions, 1)

  // 4. 取消暂存
  await ops.handle('unstage', { cwd: dir, paths: ['a.txt'] })
  snapshot = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snapshot.status.staged.length, 0)

  // 5. AI 提交信息降级（未配置模型时仍能给出可编辑文案）
  const ai = await ops.handle('aiCommit', { cwd: dir })
  assert.equal(ai.fallback, true)
  assert.match(ai.message, /^chore: /)

  // 6. 提交（全部暂存）
  const committed = await ops.handle('commit', { cwd: dir, message: 'feat: add b and extend a', stageAll: true })
  assert.match(committed.hash, /^[0-9a-f]{7,}$/)
  assert.equal(committed.subject, 'feat: add b and extend a')
  snapshot = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snapshot.status.clean, true)

  // 7. 提交图
  const graph = await ops.handle('graph', { cwd: dir, limit: 20 })
  assert.ok(graph.lines.length >= 2)
  assert.ok(graph.lines.some((line) => line.subject === 'feat: add b and extend a'))
  const headCommit = graph.lines.find((line) => line.full)
  const commitDiff = await ops.handle('diff', { cwd: dir, mode: 'commit', hash: headCommit.full })
  assert.equal(commitDiff.additions, 2)

  // 8. 建分支 / 切分支 / 删分支
  const created = await ops.handle('switchBranch', { cwd: dir, name: 'feature/x', create: true })
  assert.equal(created.branch, 'feature/x')
  const switched = await ops.handle('switchBranch', { cwd: dir, name: 'main' })
  assert.equal(switched.branch, 'main')
  await ops.handle('deleteBranch', { cwd: dir, name: 'feature/x' })
  snapshot = await ops.handle('snapshot', { cwd: dir })
  assert.ok(!snapshot.branches.some((branch) => branch.name === 'feature/x'))

  // 9. pull/push 在无远程仓库时给出明确失败（不吞错）
  await assert.rejects(
    () => ops.handle('pull', { cwd: dir }),
    (error) => error.code === 'git-failed' && /remote|upstream|No such/i.test(error.message),
  )
})
test('真实仓库：discard 三种模式（工作区 / 未跟踪 / 连暂存区）', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-git-discard-'))
  t.after(() => rm(dir, { recursive: true, force: true }))

  await git(dir, 'init', '-b', 'main')
  await git(dir, 'config', 'user.name', 'T')
  await git(dir, 'config', 'user.email', 't@example.com')
  await git(dir, 'config', 'commit.gpgsign', 'false')
  await writeFile(join(dir, 'a.txt'), 'original\n')
  await git(dir, 'add', '-A')
  await git(dir, 'commit', '-m', 'chore: init')

  const ops = createOperations({ exec: realExec, ai: () => null })
  const exists = async (name) => {
    try { await access(join(dir, name)); return true } catch { return false }
  }

  // 1) 未暂存：改坏 → 丢弃 → 回到 HEAD
  await writeFile(join(dir, 'a.txt'), 'broken\n')
  await ops.handle('discard', { cwd: dir, paths: ['a.txt'], mode: 'worktree' })
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'original\n')

  // 2) 未跟踪：新建 → 丢弃 → 文件消失
  await writeFile(join(dir, 'junk.txt'), 'junk\n')
  assert.equal(await exists('junk.txt'), true)
  await ops.handle('discard', { cwd: dir, paths: ['junk.txt'], mode: 'untracked' })
  assert.equal(await exists('junk.txt'), false)

  // 3) 已暂存：暂存改动 → all 模式 → 暂存区与工作区一起回到 HEAD
  await writeFile(join(dir, 'a.txt'), 'staged-change\n')
  await git(dir, 'add', 'a.txt')
  let snap = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snap.status.staged.length, 1)
  await ops.handle('discard', { cwd: dir, paths: ['a.txt'], mode: 'all' })
  snap = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snap.status.clean, true)
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'original\n')
})

test('真实仓库：stash 保存 / 列出 / 恢复', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-git-stash-'))
  t.after(() => rm(dir, { recursive: true, force: true }))

  await git(dir, 'init', '-b', 'main')
  await git(dir, 'config', 'user.name', 'T')
  await git(dir, 'config', 'user.email', 't@example.com')
  await git(dir, 'config', 'commit.gpgsign', 'false')
  await writeFile(join(dir, 'a.txt'), 'base\n')
  await git(dir, 'add', '-A')
  await git(dir, 'commit', '-m', 'chore: init')

  const ops = createOperations({ exec: realExec, ai: () => null })
  await writeFile(join(dir, 'a.txt'), 'wip\n')

  await ops.handle('stashPush', { cwd: dir, message: '半成品' })
  let snap = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snap.status.clean, true, 'stash 后工作区应干净')
  assert.equal(snap.stashes.length, 1)
  assert.match(snap.stashes[0].message, /半成品/)
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'base\n')

  await ops.handle('stashPop', { cwd: dir, index: 0 })
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'wip\n')
  snap = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snap.stashes.length, 0, 'pop 后 stash 列表应清空')
})

test('真实仓库：stashDrop 删除条目', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-git-stashdrop-'))
  t.after(() => rm(dir, { recursive: true, force: true }))

  await git(dir, 'init', '-b', 'main')
  await git(dir, 'config', 'user.name', 'T')
  await git(dir, 'config', 'user.email', 't@example.com')
  await git(dir, 'config', 'commit.gpgsign', 'false')
  await writeFile(join(dir, 'a.txt'), 'base\n')
  await git(dir, 'add', '-A')
  await git(dir, 'commit', '-m', 'chore: init')

  const ops = createOperations({ exec: realExec, ai: () => null })
  await writeFile(join(dir, 'a.txt'), 'wip\n')
  await ops.handle('stashPush', { cwd: dir })
  await ops.handle('stashDrop', { cwd: dir, index: 0 })
  const snap = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snap.stashes.length, 0)
})

test('真实仓库：自定义提交提示词写进 git config，清空后回到默认', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-git-prompt-'))
  t.after(() => rm(dir, { recursive: true, force: true }))

  await git(dir, 'init', '-b', 'main')
  await git(dir, 'config', 'user.name', 'T')
  await git(dir, 'config', 'user.email', 't@example.com')
  await git(dir, 'config', 'commit.gpgsign', 'false')
  await writeFile(join(dir, 'a.txt'), 'x\n')
  await git(dir, 'add', '-A')
  await git(dir, 'commit', '-m', 'chore: init')

  const ops = createOperations({ exec: realExec, ai: () => null })
  let snap = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snap.commitPrompt, '', '默认没有自定义提示词')

  const saved = await ops.handle('setCommitPrompt', { cwd: dir, prompt: '用英文写，不要 emoji' })
  assert.equal(saved.prompt, '用英文写，不要 emoji')
  snap = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snap.commitPrompt, '用英文写，不要 emoji')

  // 存在 git config 里，不是工作区文件：git status 仍然干净
  assert.equal((await git(dir, 'status', '--porcelain')).trim(), '')
  assert.match(await git(dir, 'config', '--get', 'dsh.commitPrompt'), /用英文写/)

  await ops.handle('setCommitPrompt', { cwd: dir, prompt: '' })
  snap = await ops.handle('snapshot', { cwd: dir })
  assert.equal(snap.commitPrompt, '')
})
/** 造一个真实的合并冲突仓库：main 与 topic 改同一行。 */
async function makeConflictRepo(label) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-git-conflict-'))
  await git(dir, 'init', '-b', 'main')
  await git(dir, 'config', 'user.name', 'T')
  await git(dir, 'config', 'user.email', 't@example.com')
  await git(dir, 'config', 'commit.gpgsign', 'false')
  await writeFile(join(dir, 'a.txt'), 'line1\nbase\nline3\n')
  await git(dir, 'add', '-A')
  await git(dir, 'commit', '-m', 'chore: init')

  await git(dir, 'checkout', '-b', 'topic')
  await writeFile(join(dir, 'a.txt'), 'line1\ntopic-change\nline3\n')
  await git(dir, 'commit', '-am', 'feat: topic side')

  await git(dir, 'checkout', 'main')
  await writeFile(join(dir, 'a.txt'), 'line1\nmain-change\nline3\n')
  await git(dir, 'commit', '-am', 'feat: main side')

  const merge = await realExec(['git', 'merge', 'topic'], { cwd: dir })
  if (merge.code === 0) throw new Error(label + ': 期望产生冲突，但 merge 成功了')
  return dir
}

test('真实仓库：conflictInfo 读出三份版本', async (t) => {
  const dir = await makeConflictRepo('conflictInfo')
  t.after(() => rm(dir, { recursive: true, force: true }))

  const ops = createOperations({ exec: realExec, ai: () => null })
  const info = await ops.handle('conflictInfo', { cwd: dir, path: 'a.txt' })
  assert.equal(info.hasBase, true)
  assert.match(info.base, /base/)
  assert.match(info.ours, /main-change/)
  assert.match(info.theirs, /topic-change/)
  assert.equal(info.branch, 'main')
  assert.ok(info.incoming, '应能识别合入侧 ref')
})

test('真实仓库：takeSide 取一侧并清掉冲突条目', async (t) => {
  const dir = await makeConflictRepo('takeSide')
  t.after(() => rm(dir, { recursive: true, force: true }))

  const ops = createOperations({ exec: realExec, ai: () => null })
  const data = await ops.handle('takeSide', { cwd: dir, path: 'a.txt', side: 'theirs' })
  assert.equal(data.deleted, false)
  assert.equal(data.unmerged, 0)
  const content = await readFile(join(dir, 'a.txt'), 'utf8')
  assert.match(content, /topic-change/)
  assert.ok(!content.includes('<<<<<<<'), '不应残留冲突标记')
})

test('真实仓库：applyConflict 写回自定义内容并标记已解决', async (t) => {
  const dir = await makeConflictRepo('applyConflict')
  t.after(() => rm(dir, { recursive: true, force: true }))

  const ops = createOperations({ exec: realExec, ai: () => null })
  const merged = 'line1\nmerged-both\nline3\n'
  const data = await ops.handle('applyConflict', { cwd: dir, path: 'a.txt', content: merged })
  assert.equal(data.resolved, true)
  assert.equal(data.unmerged, 0)
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), merged)
  const staged = await git(dir, 'diff', '--cached', '--name-only')
  assert.match(staged, /a\.txt/, '解决后应已进入暂存区')

  // 再调一次：已经不是冲突文件了，必须报错而不是随便改文件
  await assert.rejects(
    () => ops.handle('applyConflict', { cwd: dir, path: 'a.txt', content: 'x\n' }),
    (error) => error.code === 'invalid-params',
  )
})
