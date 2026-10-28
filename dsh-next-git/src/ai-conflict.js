/**
 * git-manager — AI 冲突解决。
 *
 * 冲突文件有三份 stage：共同祖先（:1:）、当前分支（:2:）、合入分支（:3:）。
 * 这里把它们装配成 prompt，让模型输出「解决后的完整文件」。
 *
 * 本模块只做清理与校验，**不写盘**：真正的写入由 operations 的 applyConflict 完成，
 * 而且写之前会再校验一次是否残留冲突标记。这样即使模型胡说，也不会把
 * `<<<<<<<` 直接 stage 进仓库。
 */
import { GitError } from './git.js'

/** 单份版本最多送给模型多少字符；再大就不是「看懂了再合」，而是碰运气。 */
export const MAX_SIDE_CHARS = 40000
const MAX_OUTPUT_TOKENS = 1600

export const DEFAULT_SYSTEM_PROMPT = [
  '你是一个 Git 合并冲突解决器。',
  '用户会给出冲突文件的三份内容：base（共同祖先）、ours（当前分支）、theirs（合入分支）。',
  '请输出解决冲突后的完整文件内容，遵守：',
  '- 保留双方各自有价值的改动；同一处语义等价的重复只保留一份。',
  '- 版本号、依赖版本这类冲突取更新/更高的一方，并与文件其余部分保持一致。',
  '- 只输出文件内容本身：不要解释、不要 Markdown 围栏、不要行号、不要「以下是」这类开场白。',
  '- 输出必须能直接编译或解析：括号、缩进、import 与文件其余部分自洽。',
  '- 拿不准时选择让整个文件保持自洽的一侧，不要把两边拼贴成互相矛盾的代码。',
  '- 不要臆造两边都没有的新逻辑。',
].join('\n')

/** 冲突标记只认行首的 7 个 < 或 >（`=======` 可能合法出现在 Markdown 里，不查）。 */
export function hasConflictMarkers(text) {
  return String(text ?? '')
    .split('\n')
    .some((line) => /^(<{7}|>{7})(\s|$)/.test(line))
}

/** 取最长的围栏代码块；模型常常在代码块前后加一句解释。 */
export function extractFenced(text) {
  const source = String(text ?? '')
  const re = /^[ \t]*```[^\n]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm
  let match
  let best = null
  while ((match = re.exec(source)) !== null) {
    const block = match[1]
    if (best === null || block.length > best.length) best = block
  }
  return best
}

/**
 * 清理模型输出为文件内容。
 * 只剥围栏和首尾空行，绝不逐行 trim —— 缩进就是语义。
 * @param {string} text
 * @returns {string}
 */
export function sanitizeResolution(text) {
  const fenced = extractFenced(text)
  let value = fenced !== null ? fenced : String(text ?? '')
  value = value.replace(/\r\n/g, '\n')
  if (fenced === null) {
    // 没有围栏时，模型可能仍写了整行 ``` 围栏
    value = value.replace(/^[ \t]*```[a-zA-Z0-9_-]*[ \t]*$/gm, '')
  }
  return value.replace(/\n{0,2}$/, '\n')
}

/**
 * 校验模型给出的解决结果。不合格就抛错，**不要**用一个坏结果去覆盖用户文件。
 * @param {string} suggested
 */
export function validateResolution(suggested) {
  if (typeof suggested !== 'string') {
    throw new GitError('模型没有返回内容', { code: 'ai-unavailable' })
  }
  if (suggested.trim() === '') {
    throw new GitError('模型返回了空文件，未采用', { code: 'ai-unavailable' })
  }
  if (hasConflictMarkers(suggested)) {
    throw new GitError('模型输出仍包含冲突标记，未采用', { code: 'ai-unavailable' })
  }
}

function capSide(label, text) {
  const value = String(text ?? '')
  if (value.length <= MAX_SIDE_CHARS) return value
  return value.slice(0, MAX_SIDE_CHARS) + `\n…（${label} 超过 ${MAX_SIDE_CHARS} 字符，已截断）`
}

/** 构造 user prompt。 */
export function buildConflictPrompt({ path, base, ours, theirs, branch, incoming, hint }) {
  const parts = ['文件：' + path]
  if (branch) parts.push('当前分支（ours）：' + branch)
  if (incoming) parts.push('合入分支（theirs）：' + incoming)
  if (hint) parts.push('用户补充说明：' + hint)
  parts.push('')
  if (base !== null && base !== undefined) {
    parts.push('=== base（共同祖先）===', capSide('base', base), '')
  } else {
    parts.push('=== base ===', '（这个文件没有共同祖先版本，是 add/add 冲突）', '')
  }
  parts.push('=== ours（当前分支）===', capSide('ours', ours), '')
  parts.push('=== theirs（合入分支）===', capSide('theirs', theirs))
  return parts.join('\n')
}

/**
 * 让模型给出一份解决结果。
 * @param {{
 *   path: string, base: string|null, ours: string, theirs: string,
 *   branch?: string|null, incoming?: string|null, hint?: string,
 *   llm?: unknown, selection?: {provider?: string, model?: string, reasoningEffort?: string},
 *   signal?: AbortSignal, systemPrompt?: string,
 * }} options
 * @returns {Promise<{suggested: string, model: string}>}
 */
export async function resolveConflict(options) {
  const { llm, selection, signal } = options
  if (!llm || !selection || !selection.provider || !selection.model) {
    throw new GitError('没有可用的默认模型，无法生成解决建议', { code: 'ai-unavailable' })
  }
  const model = selection.provider + '/' + selection.model
  const systemPrompt = typeof options.systemPrompt === 'string' && options.systemPrompt.trim() !== ''
    ? options.systemPrompt.trim().slice(0, 4000)
    : DEFAULT_SYSTEM_PROMPT
  const prompt = buildConflictPrompt(options)

  let text = ''
  try {
    const stream = llm.stream({
      provider: selection.provider,
      model: selection.model,
      reasoningEffort: selection.reasoningEffort,
      system: systemPrompt,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.1,
      signal,
    })
    for await (const chunk of stream) {
      if (chunk.type === 'text-delta') text += chunk.text
      if (chunk.type === 'finish') {
        const kind = chunk.reason && chunk.reason.kind
        if (kind === 'error' || kind === 'aborted') {
          const failure = chunk.reason.failure
          throw new GitError('模型生成失败：' + (failure && failure.message ? failure.message : kind), {
            code: 'ai-unavailable',
          })
        }
      }
    }
  } catch (error) {
    if (error instanceof GitError) throw error
    const message = error && error.message ? error.message : String(error)
    throw new GitError('模型生成失败：' + message, { code: 'ai-unavailable' })
  }

  const suggested = sanitizeResolution(text)
  validateResolution(suggested)
  return { suggested, model }
}
