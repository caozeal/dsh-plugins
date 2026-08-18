/**
 * DSH 插件：长任务结束提醒（飞书 webhook）。
 *
 * 监听 Host 生命周期事件，在「长任务结束 / 需要交互」时通过飞书自定义机器人推送：
 *   - `goal/changed`     → 目标 complete / blocked / paused / create（各自可开关）
 *   - `approval/request` → 需要授权/审批（waterfall，观察后必须 next() 放行）
 *   - `agent/error`      → 执行出错
 *
 * 配置在 Web UI 的「插件配置」页管理：注册 settings 命名空间 `long-task-reminder`，
 * 由 settings 服务持久化到 settings.yaml，并通过 scope.watch 实时生效（改配置无需重启）。
 * 首次启动会把旧 config.json 里已有的 webhook 一次性并入 settings，避免既有配置丢失。
 */
import z from '@deepseek-ai/schemastery'
import { goalChangedMessage, approvalRequestMessage, agentErrorMessage, turnEndMessage, stoppedMessage } from './messages.js'
import { sendFeishu } from './notifier.js'

export const name = 'long-task-reminder'

/** 需要 settings（配置读写）与 fs（一次性迁移旧 config.json）。 */
export const inject = ['settings', 'fs']

/**
 * 配置 schema：Web UI 插件配置页据此渲染表单并持久化；
 * 同时作为组合挂载时的 Config（cordis.yml config 块）校验。
 */
export const Config = z.object({
  feishuWebhook: z.string().default(''),
  notifyOnCreate: z.boolean().default(false),
  notifyOnComplete: z.boolean().default(true),
  notifyOnBlocked: z.boolean().default(true),
  notifyOnPaused: z.boolean().default(true),
  notifyOnApproval: z.boolean().default(true),
  notifyOnError: z.boolean().default(true),
  dryRun: z.boolean().default(false),
  /** 同一类通知的最小间隔（ms），防止短时间刷屏。 */
  cooldownMs: z.number().default(15000),
  /** 未建目标时，普通任务/回合结束是否提醒（按运行时长阈值判定）。 */
  notifyTurnEnd: z.boolean().default(true),
  /** 普通任务运行达到该时长（ms）才视为「任务结束」并提醒，避免快速问答刷屏。 */
  notifyTurnMinMs: z.number().default(60000),
  /** 手动停止任务时是否提醒。 */
  notifyOnStopped: z.boolean().default(true),
})

/** 旧版配置文件路径（仅用于一次性迁移到 settings）。 */
const LEGACY_CONFIG_PATH = '/Users/caozeal/projects/dsh-plugins/long-task-reminder/config.json'

/**
 * 若 settings 尚无 webhook，把旧 config.json 里的 webhook 并入 settings，
 * 让既有配置自动出现在 Web UI 里。迁移失败不影响运行，仅打日志。
 */
async function migrateLegacyWebhook(ctx, scope) {
  if (scope.get().feishuWebhook) return
  try {
    const target = await ctx.fs.resolve(LEGACY_CONFIG_PATH)
    const text = await ctx.fs.readText(target)
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed.feishuWebhook === 'string' && parsed.feishuWebhook) {
      await scope.update({ feishuWebhook: parsed.feishuWebhook })
      console.log('[long-task-reminder] 已把旧 config.json 的 webhook 迁移到 Web UI 设置')
    }
  } catch (error) {
    const detail = error && error.message ? error.message : String(error)
    console.error(`[long-task-reminder] 迁移旧配置失败：${detail}`)
  }
}

/**
 * 轻量冷却：同一 kind 的通知在 cooldownMs 内最多发一次。
 * @returns {(kind: string, cooldownMs: number) => boolean} 允许发送返回 true。
 */
function makeCooldown() {
  const last = new Map()
  return (kind, cooldownMs) => {
    const now = Date.now()
    if (now - (last.get(kind) || 0) < cooldownMs) return false
    last.set(kind, now)
    return true
  }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx Host Cordis 上下文。
 * @param {Record<string, unknown>} [compositionConfig] 组合挂载时的 config 块（settings 的 base 层）。
 */
export function apply(ctx, compositionConfig) {
  const scope = ctx.settings.register('long-task-reminder', Config, { base: compositionConfig })
  let config = { ...scope.get() }
  const allow = makeCooldown()
  // 刚因目标完成/受阻/暂停发过通知的 agent，紧随其后的 turn-end 不再重复提醒。
  const recentGoalNotified = new WeakSet()
  // 刚发过「手动停止」通知的会话 id，紧随其后的 turn-end 不再发「已完成」。
  const recentlyStopped = new Set()
  // agent 进入 running 的时刻（WeakMap，随 agent 释放自动回收）。
  const runningStart = new WeakMap()
  const send = (kind, message) => {
    if (!message || !allow(kind, config.cooldownMs)) return
    console.log(`[long-task-reminder] 发送通知 ${kind}：${message.emoji} ${message.title}`)
    // 异步发送，不阻塞事件监听器；失败已由 notifier 记录日志。
    sendFeishu(ctx, config, message).catch(() => {})
  }

  ctx.on('goal/changed', (payload) => {
    const change = payload && payload.change
    const op = change && change.operation
    // GoalOperation 取值：create | edit | pause | resume | complete | block | clear
    const flag = {
      create: config.notifyOnCreate,
      complete: config.notifyOnComplete,
      block: config.notifyOnBlocked,
      pause: config.notifyOnPaused,
    }[op]
    console.log(`[long-task-reminder] 收到 goal/changed：op=${op}，flag=${String(flag)}`)
    if (!flag) return
    if (payload && payload.agent) recentGoalNotified.add(payload.agent)
    send(`goal:${op}`, goalChangedMessage(change, payload && payload.agent))
  })

  // waterfall：观察审批请求并放行（必须调用 next()）。
  ctx.on('approval/request', (req, next) => {
    console.log(`[long-task-reminder] 收到 approval/request：${req && req.title || ''}`)
    if (config.notifyOnApproval) send('approval', approvalRequestMessage(req))
    return next()
  })

  ctx.on('agent/error', (payload) => {
    const err = payload && payload.error
    console.log(`[long-task-reminder] 收到 agent/error：${err && err.message || err || ''}`)
    if (config.notifyOnError) send('error', agentErrorMessage(payload))
  })

  // 普通任务（未建目标）结束：agent 从 running 变 idle 且运行超过阈值时提醒。
  ctx.on('agent/status', ({ agent, status }) => {
    if (status === 'running') {
      runningStart.set(agent, Date.now())
      return
    }
    // status === 'idle'：一段运行结束。
    const start = runningStart.get(agent)
    runningStart.delete(agent)
    if (start === undefined) return
    if (recentlyStopped.has(String(agent.id))) {
      // 刚发过「手动停止」通知，不再发「已完成」。
      recentlyStopped.delete(String(agent.id))
      return
    }
    if (recentGoalNotified.has(agent)) {
      // 刚发过目标通知（完成/受阻/暂停），紧随其后的 idle 不重复提醒。
      recentGoalNotified.delete(agent)
      return
    }
    if (!config.notifyTurnEnd) return
    const ranMs = Date.now() - start
    console.log(`[long-task-reminder] agent 转空闲：运行 ${ranMs}ms（阈值 ${config.notifyTurnMinMs}ms）`)
    if (ranMs >= config.notifyTurnMinMs) send('turn', turnEndMessage(agent))
  })

  // 手动停止（用户取消）：turn/end 会话事件，reason = aborted/user。
  ctx.on('session/event', (session, event) => {
    if (!event || event.type !== 'turn/end') return
    const reason = event.data && event.data.reason
    if (!reason || reason.kind !== 'aborted') return
    const cause = reason.reason
    if (!cause || cause.kind !== 'user') return
    if (!config.notifyOnStopped) return
    const sessionId = String(session.id)
    recentlyStopped.add(sessionId)
    console.log(`[long-task-reminder] 收到 turn/end：aborted/user（手动停止）${sessionId}`)
    send('stop', stoppedMessage(session))
  })

  // Web UI 里改配置 → 实时生效，无需重启。
  scope.watch((next) => {
    config = next
  })

  // 异步初始化：先迁移旧配置，再打印启动状态（含迁移后的 webhook）。
  void migrateLegacyWebhook(ctx, scope).then(() => {
    config = { ...scope.get() }
    console.log(`[long-task-reminder] 已启动：飞书 webhook ${config.feishuWebhook ? '已配置' : '未配置（dry-run）'}，冷却 ${config.cooldownMs}ms`)
  })
}
