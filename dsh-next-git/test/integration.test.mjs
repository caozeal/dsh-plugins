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
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
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
