/**
 * long-task-reminder dry-run 自测。
 *
 * 不依赖真实 webhook / 网络：验证「文案构造」+「飞书发送链路」（含 curl spawn
 * 参数拼装）。运行：`npm test`（即 node test/dry-run.mjs）。
 */
import assert from 'node:assert/strict'
import {
  goalChangedMessage,
  approvalRequestMessage,
  agentErrorMessage,
  turnEndMessage,
  stoppedMessage,
  agentContext,
  contextText,
  truncate,
} from '../src/messages.js'
import { sendFeishu } from '../src/notifier.js'

const tests = []
let passed = 0

function ok(name, fn) {
  tests.push(
    Promise.resolve()
      .then(fn)
      .then(() => {
        passed++
        console.log(`  ✔ ${name}`)
      }),
  )
}

console.log('== 文案构造 ==')

ok('goal complete', () => {
  const m = goalChangedMessage({ operation: 'complete', goal: { objective: '写周报', updatedAt: Date.now() } })
  assert.equal(m.emoji, '✅')
  assert.equal(m.title, '长任务已完成')
  assert.match(m.text, /写周报/)
})

ok('goal blocked 带原因', () => {
  const m = goalChangedMessage({ operation: 'block', goal: { objective: '部署服务', blockedReason: { message: '磁盘已满' } } })
  assert.equal(m.title, '长任务受阻，需要处理')
  assert.match(m.text, /磁盘已满/)
})

ok('goal paused', () => {
  const m = goalChangedMessage({ operation: 'pause', goal: { objective: '训练模型' } })
  assert.equal(m.emoji, '⏸️')
  assert.match(m.text, /训练模型/)
})

ok('goal create', () => {
  const m = goalChangedMessage({ operation: 'create', goal: { objective: '重构代码' } })
  assert.equal(m.emoji, '🚀')
})

ok('普通任务结束（turn end）', () => {
  const m = turnEndMessage({ id: 'sess-1' })
  assert.equal(m.title, '任务已完成')
  assert.match(m.text, /普通任务处理完成/)
})

ok('agentContext 提取项目名 + 最近助手消息进度', () => {
  const agent = {
    session: {
      header: { cwd: '/Users/caozeal/projects/dsh-plugins/long-task-reminder' },
      deriveMessages() {
        return [
          { role: 'user', content: [{ type: 'text', text: '帮我干活' }] },
          { role: 'assistant', content: [{ type: 'text', text: '已修复受阻/暂停通知并提交' }, { type: 'reasoning', text: '思考中' }] },
        ]
      },
    },
  }
  const ctx = agentContext(agent)
  assert.equal(ctx.project, 'long-task-reminder')
  assert.match(ctx.progress, /已修复受阻/)
  // 只取 text 块，跳过 reasoning。
  assert.ok(!ctx.progress.includes('思考中'))
})

ok('agentContext 无会话信息时静默降级为空', () => {
  assert.deepEqual(agentContext(undefined), { project: '', progress: '' })
  assert.deepEqual(agentContext({}), { project: '', progress: '' })
  assert.equal(contextText({}), '')
})

ok('goal 消息带项目名 + 进度总结', () => {
  const agent = {
    session: {
      header: { cwd: '/Users/caozeal/projects/dsh-plugins' },
      deriveMessages() {
        return [{ role: 'assistant', content: [{ type: 'text', text: '完成部署' }] }]
      },
    },
  }
  const m = goalChangedMessage({ operation: 'complete', goal: { objective: '部署服务' } }, agent)
  assert.match(m.text, /项目：dsh-plugins/)
  assert.match(m.text, /进度：完成部署/)
})

ok('stoppedMessage（手动停止）带项目名 + 进度', () => {
  const session = {
    id: 'sess-stop-1',
    header: { cwd: '/Users/caozeal/projects/ai-app' },
    deriveMessages() {
      return [{ role: 'assistant', content: [{ type: 'text', text: '已完成到一半' }] }]
    },
  }
  const m = stoppedMessage(session)
  assert.equal(m.title, '任务已停止')
  assert.match(m.text, /项目：ai-app/)
  assert.match(m.text, /进度：已完成到一半/)
})

ok('edit / resume / clear 不通知', () => {
  for (const op of ['edit', 'resume', 'clear']) {
    assert.equal(goalChangedMessage({ operation: op, goal: {} }), null)
  }
})

ok('非对象输入返回 null', () => {
  assert.equal(goalChangedMessage(undefined), null)
  assert.equal(goalChangedMessage('junk'), null)
})

ok('approval 请求', () => {
  const m = approvalRequestMessage({ reason: '运行危险命令 rm -rf /' })
  assert.equal(m.emoji, '🛂')
  assert.match(m.text, /rm -rf \//)
})

ok('agent error 带轮次', () => {
  const m = agentErrorMessage({ turn: 3, step: 2, error: new Error('boom') })
  assert.match(m.text, /第 3 轮 \/ 第 2 步/)
  assert.match(m.text, /boom/)
})

ok('truncate 边界', () => {
  assert.equal(truncate('abc', 2), 'a…')
  assert.equal(truncate('abc', 5), 'abc')
})

console.log('== 发送链路 ==')

const logger = { log() {}, error() {} }

ok('无 webhook → dry-run(no-webhook)，不发请求', async () => {
  const r = await sendFeishu({}, {}, { emoji: '✅', title: 't', text: 'x' }, logger)
  assert.equal(r.sent, false)
  assert.equal(r.reason, 'no-webhook')
})

ok('dryRun=true → 不发请求', async () => {
  const r = await sendFeishu(
    {},
    { feishuWebhook: 'https://example.invalid/hook', dryRun: true },
    { emoji: '✅', title: 't', text: 'x' },
    logger,
  )
  assert.equal(r.reason, 'dry-run')
})

ok('subprocess 可用 + curl 成功（模拟 code:0）→ 校验 spawn 参数', async () => {
  let spawnSpec
  const ctx = {
    get(name) {
      if (name === 'subprocess') {
        return {
          async resolveExecutable(cmd) {
            assert.equal(cmd, 'curl')
            return '/usr/bin/curl'
          },
          spawn(spec) {
            spawnSpec = spec
            return {
              done: Promise.resolve({ exitCode: 0, signal: null }),
              collected: {
                stdout: { readFrom: () => ({ text: '{"code":0,"msg":"success"}' }) },
                stderr: { readFrom: () => ({ text: '' }) },
              },
            }
          },
        }
      }
      return undefined
    },
  }
  const r = await sendFeishu(
    ctx,
    { feishuWebhook: 'https://open.feishu.cn/open-apis/bot/v2/hook/token' },
    { emoji: '✅', title: '长任务已完成', text: 'done' },
    logger,
  )
  assert.equal(r.sent, true)
  const argv = spawnSpec.argv
  assert.ok(argv.includes('-X') && argv.includes('POST'))
  const bodyIdx = argv.indexOf('--data-binary')
  assert.ok(bodyIdx >= 0)
  const body = JSON.parse(argv[bodyIdx + 1])
  assert.equal(body.msg_type, 'text')
  assert.match(body.content.text, /长任务已完成/)
  assert.equal(argv[argv.length - 1], 'https://open.feishu.cn/open-apis/bot/v2/hook/token')
  assert.equal(spawnSpec.cwd, '/')
  assert.equal(spawnSpec.graceMs, 5000)
})

ok('curl 非零退出 → 记失败', async () => {
  const ctx = {
    get(name) {
      if (name === 'subprocess') {
        return {
          async resolveExecutable() {
            return '/usr/bin/curl'
          },
          spawn() {
            return {
              done: Promise.resolve({ exitCode: 7, signal: null }),
              collected: {
                stdout: { readFrom: () => ({ text: '' }) },
                stderr: { readFrom: () => ({ text: 'connection refused' }) },
              },
            }
          },
        }
      }
      return undefined
    },
  }
  const r = await sendFeishu(ctx, { feishuWebhook: 'https://x/hook' }, { emoji: '❌', title: 't', text: 'x' }, logger)
  assert.equal(r.sent, false)
  assert.equal(r.reason, 'curl-exit')
})

ok('飞书返回 code 非 0 → 记失败', async () => {
  const ctx = {
    get(name) {
      if (name === 'subprocess') {
        return {
          async resolveExecutable() {
            return '/usr/bin/curl'
          },
          spawn() {
            return {
              done: Promise.resolve({ exitCode: 0, signal: null }),
              collected: {
                stdout: { readFrom: () => ({ text: '{"code":19001,"msg":"invalid"}' }) },
                stderr: { readFrom: () => ({ text: '' }) },
              },
            }
          },
        }
      }
      return undefined
    },
  }
  const r = await sendFeishu(ctx, { feishuWebhook: 'https://x/hook' }, { emoji: '❌', title: 't', text: 'x' }, logger)
  assert.equal(r.sent, false)
  assert.equal(r.reason, 'feishu-code')
})

ok('subprocess 不可用 → 跳过发送', async () => {
  const r = await sendFeishu({ get: () => undefined }, { feishuWebhook: 'https://x/hook' }, { emoji: '❌', title: 't', text: 'x' }, logger)
  assert.equal(r.sent, false)
  assert.equal(r.reason, 'no-subprocess')
})

await Promise.all(tests)
console.log(`\n全部通过（${passed} 项）`)
