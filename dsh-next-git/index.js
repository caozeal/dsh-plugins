/**
 * git-manager — Host 入口。
 *
 * 注册认证路由 `POST /api/git-manager`（由 connection 层做浏览器凭据校验），
 * 把请求分发给 src/operations.js；git 进程统一走 ctx.subprocess，AI 提交信息
 * 走可选的 llm + agentDefaultModel 服务（缺失时降级）。
 */
import { cleanGitEnv, GitError } from './src/git.js'
import { createOperations } from './src/operations.js'

export const name = 'git-manager'

/** connection 提供认证 fetch 路由；subprocess 执行 git。 */
export const inject = ['connection', 'subprocess']

const ROUTE_PATH = '/api/git-manager'
const STDOUT_MAX_BYTES = 8 * 1024 * 1024
const STDERR_MAX_BYTES = 1024 * 1024

/** 构造 JSON Response。 */
function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function errorPayload(error) {
  const code = error instanceof GitError ? error.code : 'internal'
  const raw = error && error.message ? String(error.message) : String(error)
  const message = raw.length > 4000 ? `${raw.slice(0, 4000)}…` : raw
  return { ok: false, error: { code, message } }
}

/** 读取 subprocess 收集模式下的输出。 */
function readCollected(handle, which) {
  try {
    const reader = handle && handle.collected ? handle.collected[which] : undefined
    if (!reader) return ''
    return reader.readFrom(0).text ?? ''
  } catch {
    return ''
  }
}

/** 把 ctx.subprocess 包装成 operations 需要的 exec。 */
function createExec(ctx) {
  return async function exec(argv, options = {}) {
    const { cwd, signal, timeoutMs = 30000 } = options
    const controller = new AbortController()
    let timedOut = false
    const onAbort = () => controller.abort()
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, Math.max(100, timeoutMs))
    try {
      const handle = ctx.subprocess.spawn({
        argv,
        cwd,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: STDOUT_MAX_BYTES },
          stderr: { maxBytes: STDERR_MAX_BYTES },
        },
        graceMs: 3000,
        signal: controller.signal,
        env: cleanGitEnv(),
      })
      const outcome = await handle.done
      const stdout = readCollected(handle, 'stdout')
      const stderr = readCollected(handle, 'stderr')
      if (timedOut || controller.signal.aborted) {
        throw new GitError(`git 命令超时或被取消：${argv.join(' ')}`, {
          code: 'timeout',
          stdout,
          stderr,
        })
      }
      return { code: outcome.exitCode, stdout, stderr }
    } catch (error) {
      if (error instanceof GitError) throw error
      if (timedOut || controller.signal.aborted) {
        throw new GitError(`git 命令超时或被取消：${argv.join(' ')}`, { code: 'timeout' })
      }
      const message = error && error.message ? error.message : String(error)
      const code = error && (error.code === 'ENOENT' || /\bENOENT\b/.test(message))
        ? 'cwd-unavailable'
        : 'internal'
      throw new GitError(
        code === 'cwd-unavailable'
          ? `无法访问工作目录或 git 可执行文件（${cwd}）：${message}`
          : `无法执行 ${argv.join(' ')}：${message}`,
        { code },
      )
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
  }
}

/** 读取默认模型选择；任何异常都视为未配置。 */
function readSelection(ctx) {
  try {
    const service = ctx.get('agentDefaultModel')
    if (!service || typeof service.currentSelection !== 'function') return null
    return service.currentSelection() ?? null
  } catch {
    return null
  }
}

/** 处理一次 HTTP 请求。 */
async function handleRequest(request, operations) {
  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: { code: 'invalid-params', message: '只支持 POST' } })
  }
  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { ok: false, error: { code: 'invalid-params', message: '请求体不是合法 JSON' } })
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse(400, { ok: false, error: { code: 'invalid-params', message: '请求体必须是 JSON 对象' } })
  }
  const { op, ...params } = body
  try {
    const data = await operations.handle(op, params, request.signal)
    return jsonResponse(200, { ok: true, data })
  } catch (error) {
    // 参数错误（含未知 op）用 400；git 业务失败仍是 200 + ok:false，
    // 让 UI 统一按 body 处理而不把错误码当网络故障。
    const status = error instanceof GitError && error.code === 'invalid-params' ? 400 : 200
    return jsonResponse(status, errorPayload(error))
  }
}

/**
 * Host 插件主体。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  const operations = createOperations({
    exec: createExec(ctx),
    ai: () => ({
      llm: ctx.get('llm'),
      selection: readSelection(ctx),
    }),
  })
  ctx.effect(() => {
    const dispose = ctx.connection.fetch.register({
      path: ROUTE_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: (request) => handleRequest(request, operations),
    })
    return () => {
      void dispose()
    }
  }, 'git-manager: /api/git-manager route')
  console.log(`[git-manager] 已注册 ${ROUTE_PATH}`)
}
