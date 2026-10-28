// 用真实的 src/operations.js 生成 demo fixture，
// 保证 Demo 里看到的数据结构与真实 Host 返回逐字节一致。
//
// 用法：node demo/gen-fixtures.mjs <演示仓库路径>
import { createOperations } from '../src/operations.js'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const CWD = process.argv[2]
if (!CWD) {
  console.error('用法: node demo/gen-fixtures.mjs <仓库路径>')
  process.exit(1)
}

function exec(argv, options) {
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: options.cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    child.on('error', (error) => resolve({ code: null, stdout, stderr: String(error) }))
  })
}

const operations = createOperations({ exec })
const call = (op, params) => operations.handle(op, params)

const out = {}
out.snapshot = await call('snapshot', { cwd: CWD })
out.graph = await call('graph', { cwd: CWD, limit: 100 })

// 每个变更文件的 diff（worktree / staged / untracked 各一份）
const snap = out.snapshot
const diffs = {}
async function collect(mode, entries) {
  for (const entry of entries || []) {
    const key = mode + ':' + entry.path
    try {
      diffs[key] = await call('diff', { cwd: CWD, mode, path: entry.path })
    } catch (error) {
      console.warn('跳过', key, '-', error.message)
    }
  }
}
await collect('worktree', snap.status.unstaged)
await collect('staged', snap.status.staged)
await collect('untracked', snap.status.untracked)

// 每个提交的 diff（供提交图点击）
const commitDiffs = {}
for (const line of out.graph.lines) {
  if (!line.full) continue
  try {
    commitDiffs[line.hash] = await call('diff', { cwd: CWD, mode: 'commit', hash: line.full })
  } catch (error) {
    console.warn('跳过 commit', line.hash, '-', error.message)
  }
}

out.diffs = diffs
out.commitDiffs = commitDiffs
out.generatedAt = new Date().toISOString()

writeFileSync(new URL('./fixtures.json', import.meta.url), JSON.stringify(out, null, 2))
console.log('分支:', out.snapshot.repo.branch)
console.log('变更 diff:', Object.keys(diffs).length, '份 →', Object.keys(diffs).join(', '))
console.log('提交:', out.graph.lines.filter((l) => l.full).length, '个，commit diff:', Object.keys(commitDiffs).length, '份')
console.log('fixture 大小:', (JSON.stringify(out).length / 1024).toFixed(1), 'KB')
