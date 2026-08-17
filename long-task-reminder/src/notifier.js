/**
 * 长任务提醒——飞书自定义机器人 webhook 发送器。
 *
 * DSH Host 端没有全局 fetch；`web.fetch` 只支持 GET 检索。因此这里通过
 * `ctx.subprocess` 调用本机 curl 发送 POST。curl 的 argv 不做 shell 解释、
 * 直接传参，不会引入命令注入。
 *
 * webhook 未配置或 `config.dryRun` 为 true 时走 dry-run：只打印日志不发请求，
 * 便于在拿到真实 webhook 之前验证整条链路。
 */

/** collect 模式子进程输出上限（字节）。 */
const COLLECT = { maxBytes: 4096 }

/** 读取 collect 模式子进程的一段输出（从 0 偏移批量取回）。 */
function readOutput(reader) {
  if (!reader) return ''
  try {
    const read = reader.readFrom(0)
    return read ? read.text : ''
  } catch {
    return ''
  }
}

/**
 * 发送一条飞书 text 消息。
 * @param {object} ctx Host Cordis 上下文（至少提供 ctx.get('subprocess')）。
 * @param {{ feishuWebhook?: string, dryRun?: boolean }} config 插件配置。
 * @param {{ emoji: string, title: string, text: string }} message 通知文案。
 * @param {{ log: Function, error: Function }} logger 日志器，默认 console。
 * @returns {Promise<{ sent: boolean, reason?: string, detail?: string }>}
 */
export async function sendFeishu(ctx, config, message, logger = console) {
  const webhook = config && config.feishuWebhook
  const line = `[long-task-reminder] ${message.emoji} ${message.title} — ${message.text}`

  if (!webhook) {
    logger.log(`${line}\n    （未配置飞书 webhook，按 dry-run 处理；在 config.json 填入 feishuWebhook 后生效）`)
    return { sent: false, reason: 'no-webhook' }
  }
  if (config && config.dryRun) {
    logger.log(`${line}\n    （config.dryRun=true，未实际发送）`)
    return { sent: false, reason: 'dry-run' }
  }

  const subprocess = ctx.get('subprocess')
  if (!subprocess) {
    logger.error(`${line}\n    （subprocess 服务不可用，跳过发送）`)
    return { sent: false, reason: 'no-subprocess' }
  }

  const body = JSON.stringify({
    msg_type: 'text',
    content: { text: `${message.emoji} ${message.title}\n${message.text}` },
  })

  try {
    const curlPath = await subprocess.resolveExecutable('curl')
    const handle = subprocess.spawn({
      argv: [curlPath, '-sS', '-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', body, webhook],
      cwd: '/',
      stdio: { stdin: 'ignore', stdout: COLLECT, stderr: COLLECT },
      graceMs: 5000,
    })
    const outcome = await handle.done
    const stdout = readOutput(handle.collected.stdout)
    const stderr = readOutput(handle.collected.stderr)

    if (outcome.exitCode !== 0) {
      logger.error(`${line}\n    （curl 退出码 ${outcome.exitCode}：${stderr || stdout}）`)
      return { sent: false, reason: 'curl-exit', detail: stderr || stdout }
    }
    // 飞书成功响应形如 {"code":0,"msg":"success"}；code 非 0 视为业务失败。
    const feishuOk = /"code"\s*:\s*0/.test(stdout)
    if (!feishuOk) {
      logger.error(`${line}\n    （飞书返回异常：${stdout || stderr}）`)
      return { sent: false, reason: 'feishu-code', detail: stdout || stderr }
    }
    return { sent: true }
  } catch (error) {
    const detail = error && error.message ? error.message : String(error)
    logger.error(`${line}\n    （发送异常：${detail}）`)
    return { sent: false, reason: 'exception', detail }
  }
}
