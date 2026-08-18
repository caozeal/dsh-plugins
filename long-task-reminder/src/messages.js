/**
 * 长任务提醒——通知文案构造（纯函数，无运行时依赖）。
 *
 * 把 DSH 的 `goal/changed`、`approval/request`、`agent/error` 事件负载
 * 转成飞书机器人通知文案。每个函数返回 `{ emoji, title, text }` 或 `null`（不通知）。
 */

const MAX_TEXT = 200

/** 截断长文本，超出部分以省略号结尾。 */
export function truncate(value, max = MAX_TEXT) {
  const s = String(value ?? '')
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`
}

/** 时间戳（epoch ms）→ "YYYY-MM-DD HH:mm:ss" 本地时间；非法输入返回空串。 */
export function formatTime(epochMs) {
  if (!Number.isFinite(epochMs)) return ''
  const d = new Date(epochMs)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * 从 agent 提取通知上下文：项目名（会话工作目录 basename）与最近一条助手消息文本。
 * 会话信息缺失或读取失败时静默降级为空串，不阻断通知。
 * @param {{ session?: { header?: { cwd?: string }, deriveMessages?: () => Array<{ role?: string, content?: Array<{ type?: string, text?: string }> }> } }} agent
 *   DSH 事件负载中的 agent。
 * @returns {{ project: string, progress: string }} 只读字符串，不含任何 Host 对象引用。
 */
export function agentContext(agent) {
  let project = ''
  let progress = ''
  if (!agent) return { project, progress }
  try {
    const session = agent.session
    const cwd = session && session.header && session.header.cwd
    const name = cwd ? String(cwd).replace(/\\/g, '/').split('/').filter(Boolean).pop() : ''
    if (name) project = name
    const messages = session && typeof session.deriveMessages === 'function' ? session.deriveMessages() : []
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg && msg.role === 'assistant') {
        const text = (msg.content || [])
          .filter((block) => block && block.type === 'text')
          .map((block) => block.text)
          .join('\n')
        if (text) {
          progress = truncate(text, 200)
          break
        }
      }
    }
  } catch {
    // 会话信息不可用时静默降级（不阻断通知）。
  }
  return { project, progress }
}

/**
 * 把项目名 + 进度总结拼成通知文本的尾部（多行）；两者都为空时返回空串。
 * @param {unknown} agent DSH 事件负载中的 agent。
 * @returns {string} 以换行开头，或空串。
 */
export function contextText(agent) {
  const { project, progress } = agentContext(agent)
  const lines = []
  if (project) lines.push(`项目：${project}`)
  if (progress) lines.push(`进度：${progress}`)
  return lines.length ? `\n${lines.join('\n')}` : ''
}

/**
 * 目标变更 → 通知文案。
 * @param {{ operation?: string, goal?: { objective?: string, blockedReason?: { message?: string }, updatedAt?: number } }} change
 *   DSH `goal/changed` 事件的 `change` 字段。
 * @param {unknown} [agent] 事件负载中的 agent，用于补充项目名与进度总结。
 * @returns {{ emoji: string, title: string, text: string } | null} 无需通知时返回 null。
 */
export function goalChangedMessage(change, agent) {
  if (!change || typeof change !== 'object') return null
  const goal = change.goal || {}
  const objective = truncate(goal.objective)
  const when = formatTime(goal.updatedAt)
  const context = contextText(agent)
  const base = `目标：${objective}${when ? `（${when}）` : ''}${context}`

  switch (change.operation) {
    case 'complete':
      return { emoji: '✅', title: '长任务已完成', text: `任务已完成，可以来看结果了。\n${base}` }
    case 'block': {
      const reason = goal.blockedReason
      const detail = truncate(reason && reason.message ? reason.message : '需要你介入处理', 300)
      return { emoji: '⛔', title: '长任务受阻，需要处理', text: `${detail}\n${base}` }
    }
    case 'pause':
      return { emoji: '⏸️', title: '长任务已暂停', text: `任务已暂停，等待你确认是否继续。\n${base}` }
    case 'create':
      return { emoji: '🚀', title: '长任务已开始', text: `新任务开始执行，我会在任务结束或需要你时提醒。\n${base}` }
    default:
      // edit / resume / clear 不打扰
      return null
  }
}

/**
 * 审批/授权请求 → 通知文案。
 * @param {{ reason?: string }} req DSH `approval/request` 的请求对象。
 */
export function approvalRequestMessage(req) {
  const reason = truncate(req && req.reason ? req.reason : '（无说明）', 300)
  return { emoji: '🛂', title: '需要你的授权/审批', text: `DSH 正在等待你的授权：\n${reason}` }
}

/**
 * 执行出错 → 通知文案。
 * @param {{ turn?: number, step?: number, error?: unknown }} payload DSH `agent/error` 负载。
 */
export function agentErrorMessage(payload) {
  const err = payload && payload.error
  const detail = truncate(err && typeof err.message === 'string' ? err.message : String(err ?? '未知错误'), 300)
  const where = Number.isInteger(payload && payload.turn) ? `第 ${payload.turn} 轮 / 第 ${payload.step} 步` : ''
  const context = contextText(payload && payload.agent)
  return { emoji: '❌', title: '任务执行出错', text: `${where ? `${where}出错：` : '出错：'}${detail}${context}` }
}

/**
 * 普通任务（未建目标）结束 → 通知文案。
 * @param {{ session?: object }} agent DSH `agent/status` 负载中的 agent。
 * @returns {{ emoji: string, title: string, text: string }}
 */
export function turnEndMessage(agent) {
  return { emoji: '✅', title: '任务已完成', text: `普通任务处理完成，可以来看结果了。${contextText(agent)}` }
}
