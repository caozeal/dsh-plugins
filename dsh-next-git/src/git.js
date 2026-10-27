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
export function parseGraph(raw, options = {}) {
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
  // 逐行算 lane 色号，Client 直接用；ref 色号与线条色号来自同一次分配，
  // 保证「分支徽章」和「分支线」严格同色。
  const colors = assignGraphColors(lines, options.width)
  const assignments = assignRefColors(lines)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    line.colors = colors[index]
    if (line.refs && line.refs.length > 0) {
      const head = line.refs.find((ref) => String(ref).indexOf('HEAD') === 0)
      const color = assignments.get(canonicalRef(head || line.refs[0]))
      if (color !== undefined) line.refColor = color
    }
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


/**
 * 把一对「删除行 / 新增行」切成词级片段，供 diff 渲染高亮真正变化的词。
 *
 * 算法：先按「词 / 空白 / 标点」粗切成 token，再对两组 token 做 LCS，
 * 未匹配的 token 才是变化部分。纯函数、无依赖、可单测。
 *
 * 注意：中文等无空格语言按字符切，否则整行会变成一个 token（等于没高亮）。
 *
 * @param {string} before 删除行的文本（不含前缀符号）
 * @param {string} after 新增行的文本（不含前缀符号）
 * @returns {{before: Array<{text: string, changed: boolean}>, after: Array<{text: string, changed: boolean}>}}
 */
export function diffInline(before, after) {
  const left = tokenizeInline(String(before ?? ''))
  const right = tokenizeInline(String(after ?? ''))
  // 任一侧为空（纯增/纯删）或任一侧过长（高亮收益低、LCS 变慢）时整体标记为变化。
  if (left.length === 0 || right.length === 0 || left.length + right.length > MAX_INLINE_TOKENS) {
    return {
      before: [{ text: left.join(''), changed: left.length > 0 }],
      after: [{ text: right.join(''), changed: right.length > 0 }],
    }
  }
  const matched = lcsMatches(left, right)
  return {
    before: groupInline(left, matched.left),
    after: groupInline(right, matched.right),
  }
}

/** 单行词级比较的 token 上限，超过就退化成整行高亮。 */
const MAX_INLINE_TOKENS = 400

/** 是否把该 codepoint 当作可独立成词的表意字符（CJK、假名、全角标点等）。 */
function isIdeographic(code) {
  return (
    (code >= 0x3040 && code <= 0x30ff) || // 平假名 / 片假名
    (code >= 0x3400 && code <= 0x4dbf) || // CJK 扩展 A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK 基本区
    (code >= 0xf900 && code <= 0xfaff) || // CJK 兼容表意
    (code >= 0xff00 && code <= 0xffef) || // 全角字符
    (code >= 0xac00 && code <= 0xd7af) // 谚文
  )
}

/** 把一行切成分隔 token：连续标识符、连续空白、单个标点/表意字符。 */
function tokenizeInline(text) {
  /** @type {string[]} */
  const out = []
  let buffer = ''
  let mode = ''
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    const next = /\s/.test(char) ? 'space' : isIdeographic(code) ? 'ideograph' : /[A-Za-z0-9_$]/.test(char) ? 'word' : 'punct'
    if (next === 'ideograph') {
      if (buffer) { out.push(buffer); buffer = '' }
      out.push(char)
      mode = ''
      continue
    }
    if (next === mode) {
      buffer += char
      continue
    }
    if (buffer) out.push(buffer)
    buffer = char
    mode = next
  }
  if (buffer) out.push(buffer)
  return out
}

/**
 * 对左右 token 序列求最长公共子序列，返回两侧各自「被匹配上」的下标集合。
 * 经典 DP；因为 MAX_INLINE_TOKENS 限制了规模，内存可以接受。
 * @param {string[]} left
 * @param {string[]} right
 * @returns {{left: Set<number>, right: Set<number>}}
 */
function lcsMatches(left, right) {
  const n = left.length
  const m = right.length
  /** @type {Uint16Array[]} */
  const table = []
  for (let i = 0; i <= n; i += 1) table.push(new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const matchedLeft = new Set()
  const matchedRight = new Set()
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      matchedLeft.add(i)
      matchedRight.add(j)
      i += 1
      j += 1
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1
    } else {
      j += 1
    }
  }
  return { left: matchedLeft, right: matchedRight }
}

/**
 * 把 token 按下标是否命中合并成连续片段，减少 DOM 节点数。
 * @param {string[]} tokens
 * @param {Set<number>} matched
 * @returns {Array<{text: string, changed: boolean}>}
 */
function groupInline(tokens, matched) {
  /** @type {Array<{text: string, changed: boolean}>} */
  const out = []
  for (let index = 0; index < tokens.length; index += 1) {
    const changed = !matched.has(index)
    const last = out[out.length - 1]
    if (last && last.changed === changed) last.text += tokens[index]
    else out.push({ text: tokens[index], changed })
  }
  return out
}

/**
 * 在一个 hunk 的行序列上就地附加词级高亮片段。
 *
 * 配对策略：同一 hunk 内相邻的连续删除块与连续新增块「按下标逐行配对」——
 * 这是 unified diff 的常见形态，也是用户直觉上认为「这一行改成了那一行」的对应关系。
 * 多余的删除行或新增行保持整行高亮。
 *
 * @param {Array<{kind: string, text: string}>} lines
 * @returns {Array<{kind: string, text: string, old?: number, new?: number, inline?: Array<{text: string, changed: boolean}>}>}
 */
export function attachInlineHunks(lines) {
  const output = lines.map((line) => ({ ...line }))
  let index = 0
  while (index < output.length) {
    if (output[index].kind !== 'del') {
      index += 1
      continue
    }
    let delEnd = index
    while (delEnd < output.length && output[delEnd].kind === 'del') delEnd += 1
    let addEnd = delEnd
    while (addEnd < output.length && output[addEnd].kind === 'add') addEnd += 1
    const delCount = delEnd - index
    const addCount = addEnd - delEnd
    const pairs = Math.min(delCount, addCount)
    for (let offset = 0; offset < pairs; offset += 1) {
      const delLine = output[index + offset]
      const addLine = output[delEnd + offset]
      const inline = diffInline(delLine.text, addLine.text)
      // 只在真的存在可见差异时才挂片段，纯「整行替换」不额外包 span。
      if (inline.before.length > 1 || inline.after.length > 1 ||
          (inline.before[0] && inline.before[0].changed) || (inline.after[0] && inline.after[0].changed)) {
        delLine.inline = inline.before
        addLine.inline = inline.after
      }
    }
    index = addEnd
  }
  return output
}

/** 提交图配色槽位数；Client 侧 CSS 提供 --gm-lane-0 .. --gm-lane-{N-1}。 */
export const GRAPH_PALETTE_SIZE = 8

/** 图表单格的连接语义：'|' 竖直、'/' 从 lane i 顶到 lane i-1 底、'\\' 从 lane i-1 顶到 lane i 底。 */
function cellLink(char, lane) {
  if (char === '|') return { top: lane, bottom: lane }
  if (char === '/') return { top: lane, bottom: lane - 1 }
  if (char === '\\') return { top: lane - 1, bottom: lane }
  if (char === '*') return { top: lane, bottom: lane }
  if (char === '_') return { top: lane, bottom: lane }
  return null
}

/** 取图行第 lane 个字符；越界返回空格。 */
function graphChar(text, lane) {
  return lane >= 0 && lane < text.length ? text[lane] : ' '
}

/** 由分支名/远程名算出稳定色号：同名分支在任何仓库、任何一次打开都是同一种颜色。 */
export function refColorIndex(ref) {
  const name = String(ref ?? '')
    .replace(/^HEAD -> /, '')
    .replace(/^tag: /, '')
    .replace(/^origin\//, '')
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 100003
  }
  return hash % GRAPH_PALETTE_SIZE
}

/**
 * 给提交图每一行算出 lane 的颜色号。
 *
 * 做法是模拟一条「颜色随线段流动」的轨道：每个格子有入口 lane 和出口 lane
 * （见 {@link cellLink}），入口颜色沿线段流到出口，于是同一条分支线在跨行时
 * 保持同色；分支点处新出现的线段取当前未被占用的色号，避免相邻两条线撞色。
 *
 * 有 ref（分支/tag）的提交点会强制使用该 ref 的稳定色，这样「分支自己的颜色」
 * 和「分支名徽章的颜色」一致，滚到哪都能认出来。
 *
 * @param {Array<{graph: string, refs?: string[]}>} lines
 * @param {number} [width] 参与绘制的 lane 数；省略时按实际最长图前缀推断
 * @returns {Array<Array<number>>} 每行每个 lane 的色号
 */
export function assignGraphColors(lines, width) {
  const rows = Array.isArray(lines) ? lines : []
  let maxWidth = 0
  for (const line of rows) {
    const text = line && line.graph ? line.graph : ''
    if (text.length > maxWidth) maxWidth = text.length
  }
  const cols = Number.isFinite(width) && width > 0 ? Math.min(width, maxWidth) : maxWidth
  // 先给所有出现过的 ref 分配互不相同的色号（按首次出现顺序），而不是对名字取模。
  // 取模在 8 色槽下约 1/8 概率撞色，两条分支同色会让整张图失去辨识度
  // （实测 feat/streaming 与 fix/empty-input 就撞在同一个色号上）。
  const refColors = assignRefColors(rows)
  /** @type {Map<number, number>} */
  let entering = new Map()
  /** @type {Array<Array<number>>} */
  const output = []
  for (let row = 0; row < rows.length; row += 1) {
    const text = rows[row] && rows[row].graph ? rows[row].graph : ''
    const refs = rows[row] && Array.isArray(rows[row].refs) ? rows[row].refs : []
    /** @type {Array<number>} */
    const colors = new Array(cols).fill(-1)
    /** @type {Map<number, number>} */
    const next = new Map()
    /** @type {Set<number>} */
    const used = new Set()
    for (let lane = 0; lane < cols; lane += 1) {
      const link = cellLink(graphChar(text, lane), lane)
      if (!link) continue
      let color = entering.get(link.top)
      if (color === undefined) {
        // 新线段：挑一个这一行还没用过的色号，相邻线不会同色。
        color = 0
        for (let candidate = 0; candidate < GRAPH_PALETTE_SIZE; candidate += 1) {
          if (!used.has(candidate)) { color = candidate; break }
        }
      }
      used.add(color)
      colors[lane] = color
      if (!next.has(link.bottom)) next.set(link.bottom, color)
    }
    // 提交点：有 ref 时用该分支分配到的色号，并让它继续往下流。
    if (refs.length > 0) {
      const dot = text.indexOf('*')
      if (dot >= 0 && dot < cols) {
        const head = refs.find((ref) => String(ref).indexOf('HEAD') === 0)
        const color = refColors.get(canonicalRef(head || refs[0]))
        if (color !== undefined) {
          colors[dot] = color
          next.set(dot, color)
        }
      }
    }
    output.push(colors)
    entering = next
  }
  return output
}

/**
 * 给一组图行里出现过的每个 ref 分配色号（按首次出现顺序取模）。
 * 顺序分配保证「同一屏里出现的分支一定不同色」，比按名字哈希取模更可靠。
 * @param {Array<{refs?: string[]}>} rows
 * @returns {Map<string, number>} 归一化分支名 → 色号
 */
function assignRefColors(rows) {
  const out = new Map()
  let cursor = 0
  for (const row of rows) {
    const refs = row && Array.isArray(row.refs) ? row.refs : []
    for (const ref of refs) {
      const name = canonicalRef(ref)
      if (!name || out.has(name)) continue
      out.set(name, cursor % GRAPH_PALETTE_SIZE)
      cursor += 1
    }
  }
  return out
}

/** 把 `HEAD -> main`、`tag: v1`、`origin/main` 归一成用于配色的分支名。 */
function canonicalRef(ref) {
  return String(ref ?? '')
    .replace(/^HEAD -> /, '')
    .replace(/^tag: /, '')
    .replace(/^origin\//, '')
    .trim()
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
  // 每个 hunk 的行上附加词级高亮片段（纯展示数据，UI 可忽略）。
  for (const hunk of hunks) hunk.lines = attachInlineHunks(hunk.lines)
  return { binary, additions, deletions, hunks }
}