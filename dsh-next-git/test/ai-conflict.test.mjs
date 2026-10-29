import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SYSTEM_PROMPT,
  DELETE_MARKER,
  MAX_SIDE_CHARS,
  buildConflictPrompt,
  extractFenced,
  hasConflictMarkers,
  parseResolution,
  resolveConflict,
  sanitizeResolution,
  validateResolution,
} from '../src/ai-conflict.js'

const MARKED = [
  'export function add(a, b) {',
  '<<<<<<< HEAD',
  '  return a + b',
  '=======',
  '  return b + a',
  '>>>>>>> feature/sum',
  '}',
].join('\n')

function fakeLlm(parts) {
  return {
    stream() {
      return (async function* () {
        for (const text of parts) yield { type: 'text-delta', text }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })()
    },
  }
}

test('hasConflictMarkers 只认行首七连标记', () => {
  assert.equal(hasConflictMarkers(MARKED), true)
  assert.equal(hasConflictMarkers('const s = "<<<<<<<";'), false)
  // Markdown 的 setext 标题就是一行 =======，不能当成冲突标记
  assert.equal(hasConflictMarkers('标题\n=======\n正文'), false)
  assert.equal(hasConflictMarkers(''), false)
})

test('extractFenced 取最长的代码块', () => {
  const text = '好的，这是结果：\n```js\nconst a = 1\n```\n说明\n```\nconst b = 2\nconst c = 3\n```\n'
  assert.equal(extractFenced(text).trim(), 'const b = 2\nconst c = 3')
  assert.equal(extractFenced('没有围栏'), null)
})

test('sanitizeResolution 剥掉开场白与围栏，保留缩进', () => {
  const raw = '好的，以下是解决后的文件：\n```python\ndef f():\n    return 1\n```\n'
  const out = sanitizeResolution(raw)
  assert.equal(out, 'def f():\n    return 1\n')
  assert.ok(!out.includes('好的'))
  assert.ok(out.includes('    return 1'), '缩进必须保留')
})

test('sanitizeResolution 对没有围栏的输出只做换行归一', () => {
  assert.equal(sanitizeResolution('a\r\nb\r\n'), 'a\nb\n')
})

test('validateResolution 拒绝空结果与残留标记', () => {
  assert.throws(() => validateResolution('   '), /空文件/)
  assert.throws(() => validateResolution(MARKED), /冲突标记/)
  assert.throws(() => validateResolution(null), /没有返回/)
  assert.doesNotThrow(() => validateResolution('const a = 1\n'))
})

test('buildConflictPrompt 带上三份版本与分支信息', () => {
  const prompt = buildConflictPrompt({
    path: 'src/sum.js',
    base: 'base-content',
    ours: 'ours-content',
    theirs: 'theirs-content',
    branch: 'main',
    incoming: 'feature/sum',
    hint: '优先保留上游',
  })
  assert.match(prompt, /文件：src\/sum\.js/)
  assert.match(prompt, /当前分支（ours）：main/)
  assert.match(prompt, /合入分支（theirs）：feature\/sum/)
  assert.match(prompt, /base-content/)
  assert.match(prompt, /ours-content/)
  assert.match(prompt, /theirs-content/)
  assert.match(prompt, /优先保留上游/)
})

test('buildConflictPrompt 对 add/add 冲突说明没有 base', () => {
  const prompt = buildConflictPrompt({ path: 'a.txt', base: null, ours: 'x', theirs: 'y' })
  assert.match(prompt, /没有共同祖先版本/)
})

test('buildConflictPrompt 对超大文件截断并标注', () => {
  const huge = 'x'.repeat(MAX_SIDE_CHARS + 500)
  const prompt = buildConflictPrompt({ path: 'big.txt', base: null, ours: huge, theirs: 'y' })
  assert.match(prompt, /已截断/)
  assert.ok(prompt.length < huge.length + 2000)
})

test('resolveConflict 走通流式输出并清理结果', async () => {
  const result = await resolveConflict({
    path: 'a.js',
    base: null,
    ours: 'x',
    theirs: 'y',
    llm: fakeLlm(['```js\n', 'const a = 1\n', '```']),
    selection: { provider: 'p', model: 'm' },
  })
  assert.equal(result.suggested, 'const a = 1\n')
  assert.equal(result.model, 'p/m')
})

test('resolveConflict 没有模型时抛 ai-unavailable', async () => {
  await assert.rejects(
    () => resolveConflict({ path: 'a.js', base: null, ours: 'x', theirs: 'y', llm: null }),
    (error) => error.code === 'ai-unavailable',
  )
})

test('resolveConflict 模型仍吐冲突标记时拒绝采用', async () => {
  await assert.rejects(
    () => resolveConflict({
      path: 'a.js', base: null, ours: 'x', theirs: 'y',
      llm: fakeLlm([MARKED]),
      selection: { provider: 'p', model: 'm' },
    }),
    (error) => error.code === 'ai-unavailable' && /冲突标记/.test(error.message),
  )
})

test('默认系统提示词要求直接给文件内容', () => {
  assert.match(DEFAULT_SYSTEM_PROMPT, /完整文件内容/)
  assert.match(DEFAULT_SYSTEM_PROMPT, /不要 Markdown 围栏/)
})

test('buildConflictPrompt 把「某一侧被删除」写清楚，而不是留一段空白', () => {
  const prompt = buildConflictPrompt({
    path: 'secret.txt',
    base: 'a\nb\n',
    ours: 'a\nb changed\n',
    theirs: '',
    theirsDeleted: true,
    branch: 'qa',
    incoming: 'feature',
  })
  assert.match(prompt, /=== theirs（合入分支） ===/)
  assert.match(prompt, /该侧已删除这个文件/)
  // 删除侧不能只剩一个空段落让人误读成「空文件」
  assert.ok(!prompt.includes('=== theirs（合入分支） ===\n\n'), prompt)
})

test('buildConflictPrompt 两侧都在时不会误标删除', () => {
  const prompt = buildConflictPrompt({ path: 'a.txt', base: 'b', ours: 'o', theirs: 't' })
  assert.ok(!prompt.includes('已删除'))
})

test('parseResolution 识别独占一行的删除标记（允许被围栏包着）', () => {
  assert.deepEqual(parseResolution(DELETE_MARKER), { delete: true, content: null })
  assert.deepEqual(parseResolution('这个文件应该删除\n```\n' + DELETE_MARKER + '\n```\n'), { delete: true, content: null })
  assert.deepEqual(parseResolution('  ' + DELETE_MARKER + '  '), { delete: true, content: null })
})

test('parseResolution 普通内容仍按文件内容清理', () => {
  const parsed = parseResolution('```js\nconst a = 1\n```')
  assert.equal(parsed.delete, false)
  assert.equal(parsed.content, 'const a = 1\n')
})

test('resolveConflict 模型给删除标记时返回 delete=true，不当作空文件', async () => {
  const result = await resolveConflict({
    path: 'secret.txt',
    base: 'a\n',
    ours: 'a changed\n',
    theirs: '',
    theirsDeleted: true,
    llm: fakeLlm([DELETE_MARKER]),
    selection: { provider: 'p', model: 'm' },
  })
  assert.equal(result.delete, true)
  assert.equal(result.suggested, null)
  assert.equal(result.model, 'p/m')
})

test('resolveConflict 撞到 maxTokens 截断时报错，不把半份文件当结果', async () => {
  const truncated = {
    stream() {
      return (async function* () {
        yield { type: 'text-delta', text: 'const a = 1\n' }
        yield { type: 'finish', reason: { kind: 'max-tokens' } }
      })()
    },
  }
  await assert.rejects(
    () => resolveConflict({
      path: 'a.js', base: null, ours: 'x', theirs: 'y',
      llm: truncated,
      selection: { provider: 'p', model: 'm' },
    }),
    (error) => error.code === 'ai-unavailable' && /截断/.test(error.message),
  )
})

test('默认系统提示词包含删除协议', () => {
  assert.ok(DEFAULT_SYSTEM_PROMPT.includes(DELETE_MARKER))
  assert.match(DEFAULT_SYSTEM_PROMPT, /该侧已删除这个文件/)
})
