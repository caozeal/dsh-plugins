import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SYSTEM_PROMPT,
  MAX_SIDE_CHARS,
  buildConflictPrompt,
  extractFenced,
  hasConflictMarkers,
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
