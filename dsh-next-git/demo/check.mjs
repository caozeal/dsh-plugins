#!/usr/bin/env node
/**
 * Demo 自检：确认 demo/ 能独立跑起来，且关键交互真的生效。
 *
 * 为什么需要它：Demo 直接复用 lib/client.js，插件改了这个页面可能悄悄坏掉
 * （比如 RPC 字段改名、slot key 变了）。这些检查不依赖浏览器，纯静态 + Node。
 *
 * 用法：node demo/check.mjs
 * 退出码：0 全绿；1 有断言失败。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

let failed = 0
function check(name, condition, detail) {
  if (condition) {
    console.log('  ✓ ' + name)
  } else {
    // detail 是「失败时该看什么」，成功时不打印，否则会误导读日志的人。
    console.log('  ✗ ' + name + (detail ? ' — ' + detail : ''))
    failed += 1
  }
}

console.log('[1] 文件齐备')
for (const file of ['index.html', 'host-shim.js', 'boot.js', 'fixtures.json', 'gen-fixtures.mjs']) {
  check(file, existsSync(join(HERE, file)))
}

console.log('[2] fixtures 结构与真实协议一致')
const fixtures = JSON.parse(readFileSync(join(HERE, 'fixtures.json'), 'utf8'))
check('snapshot.repo', !!fixtures.snapshot && !!fixtures.snapshot.repo)
check('snapshot.status 四组', ['staged', 'unstaged', 'untracked', 'conflicted']
  .every((key) => Array.isArray(fixtures.snapshot.status[key])))
check('graph.lines 非空', Array.isArray(fixtures.graph.lines) && fixtures.graph.lines.length > 0)
check('graph 带 colors 字段', fixtures.graph.lines.some((line) => Array.isArray(line.colors)))
check('graph 带 refColor 字段', fixtures.graph.lines.some((line) => line.refColor !== undefined))
const inlineLines = Object.values(fixtures.diffs)
  .flatMap((diff) => (diff.hunks || []).flatMap((hunk) => hunk.lines))
  .filter((line) => Array.isArray(line.inline) && line.inline.some((part) => part.changed))
check('diff 带 inline 词级片段', inlineLines.length > 0,
  '没有 inline 说明词级高亮没生效，跑 node demo/gen-fixtures.mjs 重新录制')
check('commitDiffs 覆盖所有提交',
  fixtures.graph.lines.filter((line) => line.full).length === Object.keys(fixtures.commitDiffs).length)

console.log('[3] shim 与 client.js 的契约')
const shim = readFileSync(join(HERE, 'host-shim.js'), 'utf8')
const client = readFileSync(join(ROOT, 'lib/client.js'), 'utf8')
// client.js 声明的 inject 列表，shim 必须全部提供，否则 apply 会抛错。
const injectMatch = client.match(/exports\.inject = \[([^\]]+)\]/)
check('client.js 有 inject 声明', !!injectMatch)
if (injectMatch) {
  const required = injectMatch[1].split(',').map((item) => item.trim().replace(/['"]/g, '')).filter(Boolean)
  for (const service of required) {
    check('shim 提供 ctx.' + service, shim.includes(service + ':'))
  }
}
// 面板组件从 slot 里取，key 必须对得上。
const tabKeyMatch = client.match(/var TAB_ID = '([^']+)'/)
check('TAB_ID 与 shim 取值一致',
  !!tabKeyMatch && shim.includes("'" + tabKeyMatch[1] + "'"))
check('shim 拦截 /api/git-manager', shim.includes('/api/git-manager'))

console.log('[4] 页面装配')
const html = readFileSync(join(HERE, 'index.html'), 'utf8')
check('引入 host-shim.js', html.includes('host-shim.js'))
check('引入真实 client.js', html.includes('../lib/client.js'))
check('引入 boot.js', html.includes('boot.js'))
check('提供平台主题 token', html.includes('--dsw-alias-file-diff-added-bg'))
check('提供 lane 调色板兜底', html.includes('--dsw-alias-label-primary'))

console.log('')
if (failed > 0) {
  console.log('失败 ' + failed + ' 项 ❌')
  process.exit(1)
}
console.log('全部通过 ✅')