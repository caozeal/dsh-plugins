/**
 * git-manager — AI 提交信息生成。
 *
 * 流程：收集「已暂存 diff（为空则工作区 diff）→ 最近提交风格 → 调用默认模型的
 * llm.stream」→ 清理成一行提交信息。任何一步不可用都退回确定性文案（fallback），
 * 让面板始终能拿到一个可编辑的建议。
 */
import { GitError } from './git.js'

const MAX_DIFF_CHARS = 12000
/** 单次生成的 token 预算：reasoning 模型会先消耗思考 token，200 太小容易截断。 */
const MAX_OUTPUT_TOKENS = 600

const SYSTEM_PROMPT = [
  '你是一个 Git 提交信息生成器。',
  '只输出一行提交信息，不要解释、不要代码块、不要引号、不要句号结尾。',
  '使用 Conventional Commits 风格（如 feat:/fix:/refactor:/docs:/chore:），',
  '不超过 72 个字符。跟随仓库最近提交的语言：最近提交多为中文就用中文，否则用英文。',
].join('')

/** 从 diff 与最近提交构造 user prompt。 */
function buildPrompt({ diff, files, recent, hint }) {
  const parts = []
  if (recent.length > 0) {
    parts.push('最近提交（仅作风格参考）：', ...recent.slice(0, 8).map((line) => `- ${line}`), '')
  }
  if (files.length > 0) {
    parts.push('变更文件：', ...files.slice(0, 60).map((file) => `- ${file}`), '')
  }
  if (hint) parts.push(`用户补充说明：${hint}`, '')
  parts.push('待提交的 diff：', '```diff', diff.slice(0, MAX_DIFF_CHARS), '```')
  return parts.join('\n')
}

/** 清理模型输出为一行提交信息。 */
export function sanitizeSubject(text) {
  let value = String(text ?? '')
  value = value.replace(/```[a-zA-Z]*/g, ' ')
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  let subject = lines[0] ?? ''
  subject = subject.replace(/^(commit message|提交信息)\s*[:：]\s*/i, '')
  subject = subject.replace(/^["'`“”]+|["'`“”]+$/g, '')
  subject = subject.replace(/\s+/g, ' ').trim()
  if (subject.length > 100) subject = subject.slice(0, 100).trim()
  return subject
}

/** 最近提交是否以中文为主。 */
function looksChinese(subjects) {
  const joined = subjects.join('')
  if (!joined) return false
  const cjk = (joined.match(/[\u4e00-\u9fff]/g) || []).length
  return cjk >= Math.max(1, Math.floor(joined.length * 0.2))
}

const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^()]+\))?!?\s*[:：]\s*\S/i

/**
 * 判断模型输出是否是一条可用的提交信息。
 * 模型偶发会被 reasoning token 挤掉、只吐出 `fix:` 或半句话；这种输出比降级文案
 * 更糟（用户会拿到不可提交的标题），因此宁可回退到确定性文案。
 * @param {string} subject 清理后的一行文本
 * @returns {boolean}
 */
export function looksLikeSubject(subject) {
  if (typeof subject !== 'string') return false
  const value = subject.trim()
  if (value.length < 8) return false
  if (!CONVENTIONAL.test(value)) return false
  // 以标点/连接词结尾 = 半句话。
  if (/[，,、；;：:（(「『"'`+\-–—]$/.test(value)) return false
  if (/(并|和|与|及|或|然后|以及|并且|同时)$/.test(value)) return false
  const opens = (value.match(/（|\(/g) || []).length
  const closes = (value.match(/）|\)/g) || []).length
  if (opens !== closes) return false
  return true
}

/** 确定性降级文案：根据变更文件数量生成一行。 */
export function fallbackSubject({ files, stagedCount, Chinese }) {
  const count = files.length
  const verb = stagedCount > 0 ? '提交' : '更新'
  if (Chinese) {
    if (count === 0) return 'chore: 空提交'
    if (count === 1) return `chore: ${verb} ${files[0]}`
    return `chore: ${verb} ${count} 个文件`
  }
  if (count === 0) return 'chore: empty commit'
  if (count === 1) return `chore: update ${files[0]}`
  return `chore: update ${count} files`
}

/**
 * 生成一条提交信息。
 * @param {{
 *   runGit: (args: string[], options?: object) => Promise<{stdout: string, stderr: string, code?: number|null}>,
 *   cwd: string,
 *   hint?: string,
 *   files?: string[],
 *   stagedCount?: number,
 *   signal?: AbortSignal,
 *   llm?: unknown,
 *   selection?: {provider?: string, model?: string, reasoningEffort?: string},
 * }} options
 * @returns {Promise<{message: string, model: string|null, fallback: boolean}>}
 */
export async function generateCommitMessage(options) {
  const {
    runGit,
    cwd,
    hint = '',
    signal,
    llm,
    selection,
    files = [],
    stagedCount = 0,
  } = options

  const staged = await runGit(['diff', '--cached', '--no-color'], { cwd, signal, allowFailure: true })
  let diff = staged.stdout
  if (!diff.trim()) {
    const worktree = await runGit(['diff', '--no-color'], { cwd, signal, allowFailure: true })
    diff = worktree.stdout
  }
  const recentRaw = await runGit(['log', '-8', '--pretty=format:%s'], { cwd, signal, allowFailure: true })
  const recent = String(recentRaw.stdout || '').split('\n').map((line) => line.trim()).filter(Boolean)

  let changedFiles = files
  if (changedFiles.length === 0) {
    const statusRaw = await runGit(['status', '--porcelain'], { cwd, signal, allowFailure: true })
    changedFiles = String(statusRaw.stdout || '')
      .split('\n')
      .map((line) => line.slice(3).trim())
      .filter(Boolean)
  }

  const chinese = looksChinese(recent)
  const model = selection && selection.provider && selection.model
    ? `${selection.provider}/${selection.model}`
    : null

  const canUseLlm = Boolean(llm && selection && selection.provider && selection.model && diff.trim())
  if (!canUseLlm) {
    return {
      message: fallbackSubject({ files: changedFiles, stagedCount, Chinese: chinese }),
      model,
      fallback: true,
    }
  }

  const prompt = buildPrompt({ diff, files: changedFiles, recent, hint })
  let text = ''
  try {
    const stream = llm.stream({
      provider: selection.provider,
      model: selection.model,
      reasoningEffort: selection.reasoningEffort,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2,
      signal,
    })
    for await (const chunk of stream) {
      if (chunk.type === 'text-delta') text += chunk.text
      if (chunk.type === 'finish') {
        const kind = chunk.reason && chunk.reason.kind
        if (kind === 'error' || kind === 'aborted') {
          const failure = chunk.reason.failure
          throw new GitError(`模型生成失败：${failure && failure.message ? failure.message : kind}`, {
            code: 'ai-unavailable',
          })
        }
      }
    }
  } catch (error) {
    if (error instanceof GitError) throw error
    const message = error && error.message ? error.message : String(error)
    throw new GitError(`模型生成失败：${message}`, { code: 'ai-unavailable' })
  }

  const subject = sanitizeSubject(text)
  if (!looksLikeSubject(subject)) {
    return {
      message: fallbackSubject({ files: changedFiles, stagedCount, Chinese: chinese }),
      model,
      fallback: true,
    }
  }
  return { message: subject, model, fallback: false }
}
