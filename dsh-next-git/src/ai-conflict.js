/**
 * git-manager — AI 冲突解决。
 *
 * 冲突文件有三份 stage：共同祖先（:1:）、当前分支（:2:）、合入分支（:3:）。
 * 这里把它们装配成 prompt，让模型输出「解决后的完整文件」——或者，当正确解是
 * **删除这个文件**时，输出一行删除标记（见 DELETE_MARKER）。
 *
 * 为什么需要删除标记：删除/改名冲突里有一侧在索引里根本没有 stage，内容只能读成
 * 空字符串。如果把它当「空文件」交给模型，模型分不清「对方删了文件」和「对方是空文件」，
 * 只会照着提示词把存活侧原样吐回来，等于悄悄选了「保留」。所以装配层必须显式标注
 * 哪一侧被删除，并给模型一个能表达「删除」的输出通道。
 *
 * 本模块只做清理与校验，**不写盘**：真正的写入/删除由 operations 的 applyConflict 完成，
 * 而且写之前会再校验一次是否残留冲突标记。这样即使模型胡说，也不会把
 * `<<<<<<<` 直接 stage 进仓库。
 */
import { GitError } from './git.js'

/** 单份版本最多送给模型多少字符；再大就不是「看懂了再合」，而是碰运气。 */
export const MAX_SIDE_CHARS = 40000
/** 解决结果最多能写回多少字符（applyConflict 同一上限）。 */
export const MAX_OUTPUT_TOKENS = 8192

/**
 * 模型判断「正确解是删掉整个文件」时输出的唯一一行标记。
 * 只用 3 个尖括号：`hasConflictMarkers` 只认行首 7 个 `<` / `>`，不会误判。
 */
export const DELETE_MARKER = '<<<DELETE_FILE>>>'

export const DEFAULT_SYSTEM_PROMPT = [
  '你是一个 Git 合并冲突解决器。',
  '用户会给出冲突文件的三份内容：base（共同祖先）、ours（当前分支）、theirs（合入分支）。',
  '某一侧被整份删除时，对应段落会明确写「该侧已删除这个文件」，不要把它当成空文件。',
  '请输出解决冲突后的结果，遵守：',
  '- 保留双方各自有价值的改动；同一处语义等价的重复只保留一份。',
  '- 版本号、依赖版本这类冲突取更新/更高的一方，并与文件其余部分保持一致。',
  '- 只输出文件内容本身：不要解释、不要 Markdown 围栏、不要行号、不要「以下是」这类开场白。',
  '- 输出必须能直接编译或解析：括号、缩进、import 与文件其余部分自洽。',
  '- 拿不准时选择让整个文件保持自洽的一侧，不要把两边拼贴成互相矛盾的代码。',
  '- 不要臆造两边都没有的新逻辑。',
  '- 只有「某一侧删除了文件」时才需要考虑删除：',
  `  · 存活的一侧相对 base 没有实质改动（等于原样保留）→ 只输出一行 ${DELETE_MARKER}，表示删除该文件；`,
  '  · 存活的一侧有实质改动、删掉会丢内容 → 不要删除，输出保留后的完整文件内容。',
  `- ${DELETE_MARKER} 必须独占一行、不带任何其他文字与代码围栏；其余情况一律输出文件内容。`,
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
 * 解析模型输出：是「删除这个文件」还是「一份文件内容」。
 * 删除标记允许被模型包在围栏里、或前后多写一句解释，只要有一行独占标记就算删除。
 * @param {string} text
 * @returns {{delete: true, content: null} | {delete: false, content: string}}
 */
export function parseResolution(text) {
  const source = String(text ?? '').replace(/\r\n/g, '\n')
  const wantsDelete = source
    .split('\n')
    .some((line) => line.trim() === DELETE_MARKER)
  if (wantsDelete) return { delete: true, content: null }
  return { delete: false, content: sanitizeResolution(text) }
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

/**
 * 构造 user prompt。
 * @param {{
 *   path: string, base: string|null, ours: string, theirs: string,
 *   oursDeleted?: boolean, theirsDeleted?: boolean,
 *   branch?: string|null, incoming?: string|null, hint?: string,
 * }} options
 */
export function buildConflictPrompt(options) {
  const { path, base, ours, theirs, branch, incoming, hint } = options
  const oursDeleted = Boolean(options.oursDeleted)
  const theirsDeleted = Boolean(options.theirsDeleted)
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
  parts.push(...sideBlock('ours（当前分支）', 'ours', ours, oursDeleted))
  parts.push(...sideBlock('theirs（合入分支）', 'theirs', theirs, theirsDeleted))
  return parts.join('\n')
}

/** 一侧在索引里没有 stage（被删除/改名）时必须显式说明，不能交一段空内容糊过去。 */
function sideBlock(label, capLabel, text, deleted) {
  if (deleted) {
    return ['=== ' + label + ' ===', '（该侧已删除这个文件，没有内容）', '']
  }
  return ['=== ' + label + ' ===', capSide(capLabel, text), '']
}

/**
 * 让模型给出一份解决结果。
 * @param {{
 *   path: string, base: string|null, ours: string, theirs: string,
 *   oursDeleted?: boolean, theirsDeleted?: boolean,
 *   branch?: string|null, incoming?: string|null, hint?: string,
 *   llm?: unknown, selection?: {provider?: string, model?: string, reasoningEffort?: string},
 *   signal?: AbortSignal, systemPrompt?: string,
 * }} options
 * @returns {Promise<{suggested: string|null, delete: boolean, model: string}>}
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
        // 撞到 maxTokens 的输出是被截断的半份文件：宁可报错，也不能当解决结果写回磁盘。
        if (kind === 'max-tokens') {
          throw new GitError('模型输出被截断（达到 maxTokens 上限），未采用；请手动解决', {
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

  const parsed = parseResolution(text)
  if (parsed.delete) return { suggested: null, delete: true, model }
  validateResolution(parsed.content)
  return { suggested: parsed.content, delete: false, model }
}
