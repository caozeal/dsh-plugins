/**
 * DSH 插件：长任务结束提醒（飞书 webhook）。
 *
 * 监听 Host 生命周期事件，在「长任务结束 / 需要交互」时通过飞书自定义机器人推送：
 *   - `goal/changed`   → 目标 complete / blocked / paused / create（各自可开关）
 *   - `approval/request` → 需要授权/审批（waterfall，观察后必须 next() 放行）
 *   - `agent/error`    → 执行出错
 *
 * 配置来源（优先级从高到低）：
 *   1. 组合挂载时的 config 块（提升为 harness 包后使用，apply 第二参数）
 *   2. 本项目 config.json（开发 / 动态插件阶段）
 *   3. 内置默认值（webhook 为空 → dry-run 只打日志）
 *
 * 以动态插件挂载时，把 apply 主体内联进 cordis_define 的 code.host 即可
 * （见 README「动态挂载」一节）。
 */
import { goalChangedMessage, approvalRequestMessage, agentErrorMessage } from './messages.js'
import { sendFeishu } from './notifier.js'

export const name = 'long-task-reminder'

/**
 * 硬依赖 fs：启动时要读取配置文件（config.json）。声明为硬依赖后，插件会
 * 等到 fs 服务就绪才 apply，避免 Web 启动早期 fs 尚未提供导致读不到配置
 * （其它服务如 subprocess 仅在发送通知时按需 ctx.get，不设硬依赖）。
 */
export const inject = ['fs']

/** 各事件开关与 webhook 配置。 */
const DEFAULT_CONFIG = {
  feishuWebhook: '',
  notifyOnCreate: false,
  notifyOnComplete: true,
  notifyOnBlocked: true,
  notifyOnPaused: true,
  notifyOnApproval: true,
  notifyOnError: true,
  dryRun: false,
  /** 同一类通知的最小间隔（ms），防止短时间刷屏。 */
  cooldownMs: 15000,
}

/** 项目内配置文件路径（开发/动态插件阶段读取；组合阶段改用 config 块）。 */
const CONFIG_PATH = '/Users/caozeal/projects/dsh-plugins/long-task-reminder/config.json'

/** 尽力读取项目 config.json；任何失败都返回空对象（回退默认配置）并打日志。 */
async function readFileConfig(ctx) {
  const fs = ctx.get('fs')
  if (!fs) {
    console.error('[long-task-reminder] fs 服务不可用，无法读取配置文件（webhook 按未配置处理）')
    return {}
  }
  try {
    const target = await fs.resolve(CONFIG_PATH)
    const text = await fs.readText(target)
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    const detail = error && error.message ? error.message : String(error)
    console.error(`[long-task-reminder] 读取配置文件失败（${CONFIG_PATH}）：${detail}`)
    return {}
  }
}

/** 合并配置：组合 config 块 > 项目 config.json > 默认值。 */
async function resolveConfig(ctx, compositionConfig) {
  const composition = compositionConfig && typeof compositionConfig === 'object' ? compositionConfig : {}
  const file = await readFileConfig(ctx)
  return { ...DEFAULT_CONFIG, ...file, ...composition }
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
 * @param {Partial<typeof DEFAULT_CONFIG>} [compositionConfig] 组合挂载时注入的配置。
 */
export function apply(ctx, compositionConfig) {
  resolveConfig(ctx, compositionConfig).then((config) => {
    const allow = makeCooldown()
    const send = (kind, message) => {
      if (!message || !allow(kind, config.cooldownMs)) return
      // 异步发送，不阻塞事件监听器；失败已由 notifier 记录日志。
      sendFeishu(ctx, config, message).catch(() => {})
    }

    ctx.on('goal/changed', (payload) => {
      const change = payload && payload.change
      const op = change && change.operation
      const flag = {
        create: config.notifyOnCreate,
        complete: config.notifyOnComplete,
        blocked: config.notifyOnBlocked,
        paused: config.notifyOnPaused,
      }[op]
      if (!flag) return
      send(`goal:${op}`, goalChangedMessage(change))
    })

    // waterfall：观察审批请求并放行（必须调用 next()）。
    ctx.on('approval/request', (req, next) => {
      if (config.notifyOnApproval) send('approval', approvalRequestMessage(req))
      return next()
    })

    ctx.on('agent/error', (payload) => {
      if (config.notifyOnError) send('error', agentErrorMessage(payload))
    })

    console.log(`[long-task-reminder] 已启动：飞书 webhook ${config.feishuWebhook ? '已配置' : '未配置（dry-run）'}，冷却 ${config.cooldownMs}ms`)
  })
}
