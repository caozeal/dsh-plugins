/**
 * git-manager — git 进程执行与输出解析。
 *
 * 本模块只做两件事：
 *   1. 提供 `cleanGitEnv` 与 `GitError`，由 Host 入口负责真正 spawn 进程；
 *   2. 把 git 的文本输出解析成面板所需的纯 JSON（全部是纯函数，可单测）。
 *
 * 约定：所有解析函数都不抛异常（除 GitError 之外），坏行直接跳过。
 */

/** 一次 git 失败（非 0 退出、超时或解析前置失败）。 */
export class GitError extends Error {
  /**
   * @param {string} message 人类可读信息（含 stderr 摘要）。
   * @param {{code?: string, stderr?: string, stdout?: string, exitCode?: number|null}} [detail]
   */
  constructor(message, detail = {}) {
    super(message)
    this.name = 'GitError'
    this.code = detail.code ?? 'git-failed'
    this.stderr = detail.stderr ?? ''
    this.stdout = detail.stdout ?? ''
    this.exitCode = detail.exitCode ?? null
  }
}

/**
 * 构造子进程环境：去掉本机会话里损坏的 GIT_CONFIG_* 变量，并固定非交互行为。
 *
 * 注意：Host 的 subprocess provider 会把显式 env **合并**到父进程环境之上，
 * 因此「删除」一个继承变量必须传 `undefined` 墓碑值（provider 文档明确支持），
 * 不能只是不写这个键——否则父进程里那组损坏的 GIT_CONFIG_COUNT（有 COUNT、
 * 缺 KEY）会原样带进子进程，git 直接 fatal `missing config key GIT_CONFIG_KEY_0`。
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {NodeJS.ProcessEnv} 带 undefined 墓碑的环境补丁
 */
export function cleanGitEnv(env = process.env) {
  /** @type {NodeJS.ProcessEnv} */
  const out = {}
  for (const [key, value] of Object.entries(env)) {
    if (key === 'GIT_CONFIG_COUNT' || /^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(key)) {
      out[key] = undefined
      continue
    }
    if (value !== undefined) out[key] = value
  }
  // 无论父环境有什么，都显式清掉可能存在的配置注入槽位。
  for (let index = 0; index < 16; index += 1) {
    out[`GIT_CONFIG_KEY_${index}`] = undefined
    out[`GIT_CONFIG_VALUE_${index}`] = undefined
  }
  out.GIT_CONFIG_COUNT = undefined
  out.GIT_TERMINAL_PROMPT = '0'
  out.GIT_PAGER = 'cat'
  out.GIT_OPTIONAL_LOCKS = '0'
  // 固定英文输出，让下面的解析不依赖 locale。
  out.LC_ALL = 'C'
  out.LANG = 'C'
  return out
}

/** 把 stderr 压成一行短消息。 */
function brief(text, max = 2000) {
  const trimmed = String(text || '').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

/**
 * 由一次 exec 结果构造 GitError。
 * @param {string[]} argv
 * @param {{code: number|null, stdout: string, stderr: string}} result
 */
export function gitFailure(argv, result) {
  const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  const command = argv.join(' ')
  return new GitError(
    `git ${argv[0] === 'git' ? argv.slice(1).join(' ') : command} 失败：${brief(detail) || '无输出'}`,
    { code: 'git-failed', stderr: result.stderr, stdout: result.stdout, exitCode: result.code },
  )
}

/**
 * 解析 `git status --porcelain=v1 -z --branch` 输出。
 * @param {string} raw
 * @returns {{branchLine: string|null, entries: Array<{x: string, y: string, path: string, oldPath: string|null}>}}
 */
export function parsePorcelain(raw) {
  const text = String(raw ?? '')
  const parts = text.split('\0')
  /** @type {string|null} */
  let branchLine = null
  /** @type {Array<{x: string, y: string, path: string, oldPath: string|null}>} */
  const entries = []
  for (let i = 0; i < parts.length; i += 1) {
    const record = parts[i]
    if (!record) continue
    if (record.startsWith('## ')) {
      branchLine = record.slice(3)
      continue
    }
    if (record.length < 3) continue
    const x = record[0]
    const y = record[1]
    let path = record.slice(3)
    /** @type {string|null} */
    let oldPath = null
    // porcelain v1 -z：重命名/复制状态下，下一段记录是原路径。
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') {
      const next = parts[i + 1]
      if (next !== undefined) {
        oldPath = next
        i += 1
      }
    }
    // -z 模式下路径原样输出；去掉可能存在的尾部空格没有意义，保持原值。
    entries.push({ x, y, path, oldPath })
  }
  return { branchLine, entries }
}

/**
 * 解析 `--porcelain --branch` 的分支头。
 * 例：`main...origin/main [ahead 1, behind 2]`、`HEAD (no branch)`。
 * @param {string|null} line
 * @returns {{branch: string|null, upstream: string|null, upstreamGone: boolean, ahead: number, behind: number, detached: boolean, noCommits: boolean}}
 */
export function parseBranchHeader(line) {
  const out = {
    branch: null,
    upstream: null,
    upstreamGone: false,
    ahead: 0,
    behind: 0,
    detached: false,
    noCommits: false,
  }
  if (!line) return out
  if (line.startsWith('HEAD (no branch)') || line.startsWith('HEAD (detached')) {
    out.detached = true
    return out
  }
  const noCommits = /^No commits yet on (.+)$/.exec(line)
  if (noCommits) {
    out.branch = noCommits[1]
    out.noCommits = true
    return out
  }
  if (line.startsWith('Initial commit on ')) {
    out.branch = line.slice('Initial commit on '.length).trim()
    out.noCommits = true
    return out
  }
  let head = line
  const bracket = line.indexOf(' [')
  if (bracket !== -1) {
    const track = line.slice(bracket + 2, line.lastIndexOf(']'))
    head = line.slice(0, bracket)
    const ahead = /ahead (\d+)/.exec(track)
    const behind = /behind (\d+)/.exec(track)
    out.ahead = ahead ? Number(ahead[1]) : 0
    out.behind = behind ? Number(behind[1]) : 0
    if (track.includes('gone')) out.upstreamGone = true
  }
  const dots = head.indexOf('...')
  if (dots === -1) {
    out.branch = head.trim() || null
    return out
  }
  out.branch = head.slice(0, dots).trim() || null
  out.upstream = head.slice(dots + 3).trim() || null
  if (out.upstream === '') out.upstream = null
  return out
}

/**
 * 把 porcelain 条目分类成面板的四组。
 * @param {Array<{x: string, y: string, path: string, oldPath?: string|null}>} entries
 */
export function classifyEntries(entries) {
  /** @type {{staged: Array<object>, unstaged: Array<object>, untracked: Array<object>, conflicted: Array<object>}} */
  const out = { staged: [], unstaged: [], untracked: [], conflicted: [] }
  for (const entry of entries) {
    const { x, y } = entry
    const item = {
      path: entry.path,
      status: x === '?' ? '?' : x,
      oldPath: entry.oldPath ?? null,
    }
    const unmerged = x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')
    if (unmerged) {
      out.conflicted.push({ ...item, status: `${x}${y}` })
      continue
    }
    if (x === '?' && y === '?') {
      out.untracked.push({ ...item, status: '?' })
      continue
    }
    if (x !== ' ' && x !== '?') out.staged.push({ ...item, status: x })
    if (y !== ' ' && y !== '?') {
      out.unstaged.push({ ...item, status: y })
    }
  }
  return out
}

/**
 * 解析 `git for-each-ref` 的 `%00` 分隔记录。
 * @param {string} raw
 * @returns {Array<object>}
 */
export function parseBranches(raw) {
  /** @type {Array<object>} */
  const branches = []
  for (const line of String(raw ?? '').split('\n')) {
    if (!line.trim()) continue
    const fields = line.split('\0')
    if (fields.length < 6) continue
    const [refname, name, commit, upstream, track, date] = fields
    const subject = fields.slice(6).join('\0').trim()
    if (!refname || !name) continue
    const kind = refname.startsWith('refs/heads/') ? 'local' : refname.startsWith('refs/remotes/') ? 'remote' : null
    if (!kind) continue
    if (kind === 'remote' && name.endsWith('/HEAD')) continue
    const { ahead, behind, gone } = parseTrack(track)
    branches.push({
      name,
      kind,
      current: false,
      upstream: upstream || null,
      ahead,
      behind,
      gone,
      commit: commit || '',
      subject,
      date: date || '',
    })
  }
  return branches
}

/** 解析 `%(upstream:track)` 的 `[ahead 1, behind 2]` / `[gone]`。 */
export function parseTrack(track) {
  const out = { ahead: 0, behind: 0, gone: false }
  if (!track) return out
  if (track.includes('gone')) out.gone = true
  const ahead = /ahead (\d+)/.exec(track)
  const behind = /behind (\d+)/.exec(track)
  if (ahead) out.ahead = Number(ahead[1])
  if (behind) out.behind = Number(behind[1])
  return out
}

/**
 * 解析 `git remote -v`。
 * @param {string} raw
 * @returns {Array<{name: string, url: string}>}
 */
export function parseRemotes(raw) {
  /** @type {Map<string, string>} */
  const byName = new Map()
  for (const line of String(raw ?? '').split('\n')) {
    const match = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/.exec(line.trim())
    if (!match) continue
    if (!byName.has(match[1])) byName.set(match[1], match[2])
  }
  return [...byName.entries()].map(([name, url]) => ({ name, url }))
}

/**
 * 解析 `git stash list --format=%gd%x00%s`。
 * @param {string} raw
 */
export function parseStashes(raw) {
  /** @type {Array<{index: number, message: string}>} */
  const stashes = []
  for (const line of String(raw ?? '').split('\n')) {
    if (!line.trim()) continue
    const [ref, ...rest] = line.split('\0')
    const match = /^stash@\{(\d+)\}$/.exec((ref || '').trim())
    if (!match) continue
    stashes.push({ index: Number(match[1]), message: rest.join('\0').trim() })
  }
  return stashes
}

/**
 * 解析 `git log --graph --pretty=format:%H%x1f%h%x1f%an%x1f%ar%x1f%D%x1f%s` 输出。
 * @param {string} raw
 * @returns {Array<{graph: string, hash: string|null, full: string|null, refs: string[], author: string, date: string, subject: string}>}
 */
export function parseGraph(raw) {
  /** @type {Array<object>} */
  const lines = []
  for (const line of String(raw ?? '').split('\n')) {
    if (line === '') continue
    const fields = line.split('\x1f')
    if (fields.length < 6) {
      // 只有 graph 连接符的行：保留给 UI 当作骨架行。
      lines.push({ graph: line, hash: null, full: null, refs: [], author: '', date: '', subject: '' })
      continue
    }
    const head = fields[0]
    const full = /([0-9a-f]{40})$/.exec(head)
    if (!full) {
      lines.push({ graph: line, hash: null, full: null, refs: [], author: '', date: '', subject: '' })
      continue
    }
    const graph = head.slice(0, full.index)
    const decorations = fields[4] ? fields[4].split(',').map((ref) => ref.trim()).filter(Boolean) : []
    lines.push({
      graph,
      hash: fields[1] || full[1].slice(0, 7),
      full: full[1],
      refs: decorations,
      author: fields[2] ?? '',
      date: fields[3] ?? '',
      subject: fields.slice(5).join('\x1f'),
    })
  }
  return lines
}

/**
 * 解析 `git log --pretty=%s` 等单行输出。
 * @param {string} raw
 * @returns {string[]}
 */
export function parseLines(raw) {
  return String(raw ?? '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

/**
 * 解析 unified diff，输出结构化 hunk（用于面板逐行渲染）。
 * @param {string} raw
 * @returns {{binary: boolean, additions: number, deletions: number, hunks: Array<{header: string, lines: Array<{kind: string, text: string, old?: number, new?: number}>}>}}
 */
export function parseUnifiedDiff(raw) {
  const text = String(raw ?? '')
  /** @type {Array<{header: string, lines: Array<{kind: string, text: string, old?: number, new?: number}>}>} */
  const hunks = []
  let current = null
  let oldLine = 0
  let newLine = 0
  let additions = 0
  let deletions = 0
  let binary = false
  for (const line of text.split('\n')) {
    if (line.startsWith('Binary files ') && line.endsWith(' differ')) {
      binary = true
      continue
    }
    if (line.startsWith('diff --git ')) {
      current = null
      continue
    }
    const hunk = HUNK_HEADER.exec(line)
    if (hunk) {
      oldLine = Number(hunk[1])
      newLine = Number(hunk[3])
      current = { header: line, lines: [] }
      hunks.push(current)
      continue
    }
    if (!current) continue
    if (line === '') {
      // hunk 内空行等价于一个空的上下文行。
      current.lines.push({ kind: 'ctx', text: '', old: oldLine, new: newLine })
      oldLine += 1
      newLine += 1
      continue
    }
    const marker = line[0]
    if (marker === '+') {
      current.lines.push({ kind: 'add', text: line.slice(1), new: newLine })
      additions += 1
      newLine += 1
    } else if (marker === '-') {
      current.lines.push({ kind: 'del', text: line.slice(1), old: oldLine })
      deletions += 1
      oldLine += 1
    } else if (marker === ' ') {
      current.lines.push({ kind: 'ctx', text: line.slice(1), old: oldLine, new: newLine })
      oldLine += 1
      newLine += 1
    } else if (marker === '\\') {
      current.lines.push({ kind: 'meta', text: line })
    } else {
      // 例如 `index abc..def 100644`、`--- a/x`、`+++ b/x` 等文件头：忽略。
    }
  }
  return { binary, additions, deletions, hunks }
}
