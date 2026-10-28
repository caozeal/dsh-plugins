import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SYSTEM_PROMPT,
  generateCommitMessage,
  looksLikeSubject,
  parseCommitMessage,
  sanitizeBody,
  sanitizeSubject,
} from '../src/ai-commit.js'
import { GitError } from '../src/git.js'

const CWD = '/tmp/repo'

/** 假 llm 服务：按给定 chunk 序列返回流。 */
function makeLlm(text, finish = { kind: 'stop' }) {
  return {
    stream() {
      return (async function* generate() {
        if (text) yield { type: 'text-delta', index: 0, text }
        yield { type: 'finish', reason: finish }
      })()
    },
  }
}

/** 假 runGit：只回答 ai-commit 用到的三条命令。 */
function makeRunGit(overrides = {}) {
  const routes = {
    'diff --cached --no-color': { code: 0, stdout: 'diff --git a/a.txt b/a.txt\n+hello\n', stderr: '' },
    'diff --no-color': { code: 0, stdout: 'diff --git a/a.txt b/a.txt\n+hello\n', stderr: '' },
    'log -8 --pretty=format:%s': { code: 0, stdout: 'feat: init\nfix: bug\n', stderr: '' },
    'status --porcelain': { code: 0, stdout: ' M a.txt\n', stderr: '' },
    ...overrides,
  }
  return async (args) => routes[args.join(' ')] ?? { code: 0, stdout: '', stderr: '' }
}

test('looksLikeSubject 接受规范的提交信息', () => {
  assert.equal(looksLikeSubject('feat: add git manager plugin'), true)
  assert.equal(looksLikeSubject('fix(ui): 修复面板刷新问题'), true)
  assert.equal(looksLikeSubject('chore: 更新 3 个文件'), true)
  assert.equal(looksLikeSubject('refactor!: 重写 diff 解析'), true)
})

test('looksLikeSubject 拒绝截断/半句话/缺前缀的输出', () => {
  assert.equal(looksLikeSubject('fix:'), false)
  assert.equal(looksLikeSubject('feat'), false)
  assert.equal(looksLikeSubject('更新了一些文件'), false)
  assert.equal(looksLikeSubject('feat: 新增面板并'), false)
  assert.equal(looksLikeSubject('feat: 新增面板（改用'), false)
  assert.equal(looksLikeSubject('feat: 新增面板，'), false)
  assert.equal(looksLikeSubject(''), false)
})

test('sanitizeSubject 去掉代码块、引号与多余空白', () => {
  assert.equal(sanitizeSubject('```\nfeat: add x\n```'), 'feat: add x')
  assert.equal(sanitizeSubject('  "fix: y"  '), 'fix: y')
  assert.equal(sanitizeSubject('commit message: chore: z'), 'chore: z')
})

test('模型输出可用时直接使用', async () => {
  const result = await generateCommitMessage({
    runGit: makeRunGit(),
    cwd: CWD,
    llm: makeLlm('feat: add git manager panel'),
    selection: { provider: 'p', model: 'm' },
  })
  assert.deepEqual(result, {
    message: 'feat: add git manager panel',
    subject: 'feat: add git manager panel',
    body: '',
    model: 'p/m',
    fallback: false,
  })
})

test('parseCommitMessage 拆出标题与正文', () => {
  assert.deepEqual(parseCommitMessage('feat: 加面板\n\n因为原来要开终端，很麻烦。'), {
    subject: 'feat: 加面板',
    body: '因为原来要开终端，很麻烦。',
  })
  assert.deepEqual(parseCommitMessage('fix: 修个 bug'), { subject: 'fix: 修个 bug', body: '' })
  const fenced = ['```text', 'feat: 加面板', '', '正文一', '正文二', '```'].join('\n')
  assert.deepEqual(parseCommitMessage(fenced), { subject: 'feat: 加面板', body: '正文一\n正文二' })
  assert.equal(sanitizeBody('  说明：\n  - 甲\n  - 乙\n'), '说明：\n  - 甲\n  - 乙')
})

test('模型给出标题+正文时 message 用空行拼接', async () => {
  const result = await generateCommitMessage({
    runGit: makeRunGit(),
    cwd: CWD,
    llm: makeLlm('feat: 加面板\n\n原来要开终端，现在面板里就能做。'),
    selection: { provider: 'p', model: 'm' },
  })
  assert.equal(result.fallback, false)
  assert.equal(result.subject, 'feat: 加面板')
  assert.equal(result.body, '原来要开终端，现在面板里就能做。')
  assert.equal(result.message, 'feat: 加面板\n\n原来要开终端，现在面板里就能做。')
})

test('自定义系统提示词会替换默认提示词', async () => {
  let seen = null
  const llm = {
    stream(options) {
      seen = options.system
      return (async function* generate() {
        yield { type: 'text-delta', index: 0, text: 'feat: 自定义' }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })()
    },
  }
  const result = await generateCommitMessage({
    runGit: makeRunGit(), cwd: CWD, llm, selection: { provider: 'p', model: 'm' },
    systemPrompt: '只写 emoji，不要文字。',
  })
  assert.equal(seen, '只写 emoji，不要文字。')
  assert.equal(result.fallback, false)
  await generateCommitMessage({
    runGit: makeRunGit(), cwd: CWD, llm, selection: { provider: 'p', model: 'm' }, systemPrompt: '   ',
  })
  assert.equal(seen, DEFAULT_SYSTEM_PROMPT)
})

test('模型输出被 reasoning token 截断时走确定性降级', async () => {
  const result = await generateCommitMessage({
    runGit: makeRunGit(),
    cwd: CWD,
    llm: makeLlm('fix:'),
    selection: { provider: 'p', model: 'm' },
  })
  assert.equal(result.fallback, true)
  assert.match(result.message, /^chore: /)
  assert.equal(result.model, 'p/m')
})

test('没有 llm 或没有默认模型时直接降级', async () => {
  const noLlm = await generateCommitMessage({ runGit: makeRunGit(), cwd: CWD, ai: null })
  assert.equal(noLlm.fallback, true)
  const noSelection = await generateCommitMessage({
    runGit: makeRunGit(),
    cwd: CWD,
    llm: makeLlm('feat: x y z'),
  })
  assert.equal(noSelection.fallback, true)
})

test('模型流报错转成 ai-unavailable 的 GitError', async () => {
  await assert.rejects(
    () => generateCommitMessage({
      runGit: makeRunGit(),
      cwd: CWD,
      llm: makeLlm('', { kind: 'error', failure: { message: 'rate limited' } }),
      selection: { provider: 'p', model: 'm' },
    }),
    (error) => error instanceof GitError && error.code === 'ai-unavailable' && /rate limited/.test(error.message),
  )
})

test('最近提交为中文时降级文案也用中文', async () => {
  const result = await generateCommitMessage({
    runGit: makeRunGit({
      'log -8 --pretty=format:%s': { code: 0, stdout: 'feat: 新增功能\nfix: 修复缺陷\n', stderr: '' },
      'status --porcelain': { code: 0, stdout: ' M 面板.js\n M 解析.js\n', stderr: '' },
    }),
    cwd: CWD,
    llm: makeLlm('feat:'),
    selection: { provider: 'p', model: 'm' },
  })
  assert.equal(result.fallback, true)
  assert.match(result.message, /^chore: 更新 2 个文件$/)
})