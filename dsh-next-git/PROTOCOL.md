# Git Manager 插件 — 冻结协议（Host ↔ Client）

本文件是 Host 半区与 Client 半区之间**唯一的契约**。两侧的写入者必须严格按此实现；
协议变更须先改本文件并通知对侧。

## 1. 包与文件布局

```
dsh-next-git/
  package.json          # dsh.bundle.patch + dsh.client；名字 @caozeal/dsh-next-git
  cordis.patch.yml      # insert: id: git-manager, name: "@caozeal/dsh-next-git"
  index.js              # Host 插件入口：export const inject / export function apply
  src/git.js            # git 进程执行 + 输出解析（纯函数，可单测）
  src/operations.js     # op 分发：每个 op 的实现（可单测，注入 executor）
  src/ai-commit.js      # AI 提交信息生成（llm 服务，失败降级）
  lib/client.js         # 浏览器 bundle（单文件 classic script，见 §5）
  locale/zh.json        # {"meta":{"title","description"}} 中文
  locale/en.json        # 同上英文
  icon.svg              # 64x64 viewBox 图标
  test/*.mjs            # node:test 单测
  README.md
```

小组件（浏览器端）全部内联在 `lib/client.js` 一个 classic script 里：用
`window.__ModuleLoader__.load({ id, factory })` 注册，`require('react')` 拿 React。
**不得** import 任何 `@deepseek-ai/dsh-client-*` 运行时包（只有 `react` 可用；
`@deepseek-ai/dsh-client-runtime/client` 的 `createSnapshotStore` 也可 require，
但本插件不强制使用）。

## 2. Host 侧接入点（已核实）

- Host 插件入口 `index.js`：
  ```js
  export const name = 'git-manager'
  export const inject = ['connection', 'subprocess']
  export function apply(ctx) { /* 注册 /api/git-manager 路由 */ }
  ```
  可选服务用 `ctx.get('llm')` / `ctx.get('agentDefaultModel')` / `ctx.get('fs')`
  读取，读不到就降级，不要写进 inject（避免 profile 缺服务时整插件 pending）。

- 路由注册（认证由 connection 层处理，浏览器同源 fetch 自带凭据）：
  ```js
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/git-manager',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: handleRequest,
  }), 'git-manager: rpc route')
  ```
  `fetch` 返回 `Promise<Response>`，响应 `content-type: application/json; charset=utf-8`。

- git 进程：
  ```js
  const handle = ctx.subprocess.spawn({
    argv: ['git', ...args],          // 不要拼 shell
    cwd,                              // 仓库根目录
    stdio: { stdin: 'ignore', stdout: { maxBytes: 8 * 1024 * 1024 }, stderr: { maxBytes: 1024 * 1024 } },
    graceMs: 5000,
    signal,                           // AbortSignal（超时/断开）
    env: cleanGitEnv(),               // 见下
  })
  const outcome = await handle.done
  const stdout = handle.collected.stdout.readFrom(0).text
  const stderr = handle.collected.stderr.readFrom(0).text
  ```
  `cleanGitEnv()`：复制 `process.env` 并设置 `GIT_TERMINAL_PROMPT=0`、
  `GIT_PAGER=cat`、`LC_ALL=C`（解析稳定）。**删除** `GIT_CONFIG_COUNT` /
  `GIT_CONFIG_KEY_*` / `GIT_CONFIG_VALUE_*` 时必须传 `undefined` 墓碑：Host 的
  subprocess provider 会把显式 env 合并到父进程环境之上，只「不写这个键」并不会
  删除继承值——本机父环境里这组变量是坏的（有 COUNT、缺 KEY），会报
  `missing config key GIT_CONFIG_KEY_0`，导致所有 git 命令失败、snapshot 误报
  非仓库（已修复，`test/parsers.test.mjs` 覆盖）。

- 禁止在 Host 端使用任何凭据/交互式输入；pull/push 等网络操作失败时把 stderr
  原样返回给 UI。

## 3. RPC 协议

请求：`POST /api/git-manager`，JSON——

```json
{ "op": "<操作名>", "cwd": "<绝对路径>", "...": "其余参数" }
```

响应 HTTP 200，JSON 二选一：

```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": { "code": "<机器码>", "message": "<人类可读，含 git stderr 摘要>" } }
```

错误码：`invalid-params` / `not-a-repo` / `cwd-unavailable` / `git-failed` / `timeout` /
`ai-unavailable` / `internal`。`cwd-unavailable` 表示 cwd 目录不存在或不可访问
（例如会话的目录被删除）：UI 应显示友好空态而不是原始 spawn 错误。`invalid-params`（含未知 op、非法 JSON）HTTP 400；git 业务失败 HTTP 200 +
`ok:false`（UI 统一按 body 判定）。两种响应 body 结构相同。

### 3.1 `snapshot` — 一次拉全量面板状态

参数：`{ cwd }`

```json
{
  "repo": {
    "isRepo": true,
    "root": "/abs/repo",
    "name": "dsh-plugins",
    "branch": "main",
    "detached": false,
    "head": "1a2b3c4",
    "upstream": "origin/main",
    "ahead": 1,
    "behind": 2,
    "remoteUrl": "git@github.com:foo/bar.git"
  },
  "branches": [
    {
      "name": "main",
      "kind": "local",            // local | remote
      "current": true,
      "upstream": "origin/main",
      "ahead": 1,
      "behind": 2,
      "commit": "1a2b3c4",
      "subject": "fix: xxx",
      "date": "2026-10-22 12:00:00 +0800"
    }
  ],
  "remotes": [{ "name": "origin", "url": "git@github.com:foo/bar.git" }],
  "status": {
    "clean": false,
    "staged":     [{ "path": "src/a.js", "status": "M", "oldPath": null }],
    "unstaged":   [{ "path": "src/b.js", "status": "M" }],
    "untracked":  [{ "path": "new.txt",  "status": "?" }],
    "conflicted": [{ "path": "both.js",  "status": "UU" }]
  },
  "stashes": [{ "index": 0, "message": "WIP on main: abc1234 msg" }]
}
```

非仓库目录：`{ "ok": true, "data": { "repo": { "isRepo": false, "error": "<git stderr>" } } }`
（不要报错；`error` 是诊断扩展字段，正常仓库不出现，UI 用它说明「为什么不是仓库」）。
`status` 里的 `status` 字段是 porcelain 的 1~2 个字符（`M`/`A`/`D`/`R`/`??`/`UU`…）。
未跟踪条目的 `status` 恒为 `?`（协议值）；UI 原样展示 `?`，不要映射成 `U`
（`U` 是 unmerged 的状态字母，会混淆）。

### 3.2 `graph` — 提交图

参数：`{ cwd, limit?: number }`（默认 80，钳制 20..300）

```json
{
  "lines": [
    { "graph": "* ", "hash": "1a2b3c4", "full": "<40位>",
      "refs": ["HEAD -> main", "origin/main"], "author": "Cao",
      "date": "2 hours ago", "subject": "feat: add git plugin" },
    { "graph": "|\\ ", "hash": null, "full": null, "refs": [], "author": "", "date": "", "subject": "" }
  ],
  "truncated": false
}
```

实现建议：`git log --graph --date=relative --decorate=short
--pretty=format:%H%x1f%h%x1f%an%x1f%ar%x1f%D%x1f%s -n <limit> --all`，
逐行解析；`graph` 是行内 40 位 hash 之前的前缀（含末尾空格），`refs` 用 `, ` 切分。

### 3.3 `diff` — 差异

参数：`{ cwd, mode: "worktree" | "staged" | "commit" | "untracked", path?: string, hash?: string }`

```json
{
  "mode": "worktree",
  "path": "src/a.js",        // 无单文件时为空字符串
  "binary": false,
  "additions": 3,
  "deletions": 1,
  "truncated": false,
  "hunks": [
    { "header": "@@ -1,5 +1,7 @@",
      "lines": [
        { "kind": "ctx", "text": "const a = 1", "old": 1, "new": 1 },
        { "kind": "add", "text": "const b = 2", "new": 2 },
        { "kind": "del", "text": "const c = 3", "old": 2 }
      ] }
  ],
  "raw": "<原始 unified diff 全文>"
}
```

- `worktree` → `git diff --no-color [-U3] -- [path]`
- `staged` → `git diff --no-color --cached -- [path]`
- `commit` → `git show --no-color --format= --patch <hash> [-- path]`
- `untracked` → `git diff --no-color --no-index -- /dev/null <path>`
- `raw` 上限 400 000 字符，超出置 `truncated: true` 截断；`hunks` 同样受 `raw` 截断影响可只含前部。
- 空 diff 返回 `hunks: []`、`raw: ""`，仍 `ok: true`。

### 3.4 写操作

| op | 参数 | git 命令 | data |
| --- | --- | --- | --- |
| `stage` | `{ cwd, paths?: string[], all?: true }` | `git add -- <paths>` / `git add -A` | `{ output }` |
| `unstage` | `{ cwd, paths?, all? }` | `git restore --staged -- <paths>` / `git reset -q` | `{ output }` |
| `switchBranch` | `{ cwd, name, create?: boolean, from?: string }` | `git checkout -b <name> [from]` / `git checkout <name>` | `{ branch, output }` |
| `deleteBranch` | `{ cwd, name, force?: boolean }` | `git branch -d\|-D <name>` | `{ output }` |
| `commit` | `{ cwd, message, stageAll?: boolean }` | 可选 `git add -A` 后 `git commit -m <message>` | `{ hash, subject, output }` |
| `fetch` | `{ cwd, remote?: string }` | `git fetch --all --prune`（有 remote 时 `git fetch <remote>`） | `{ output }` |
| `pull` | `{ cwd }` | `git pull` | `{ output, branch }` |
| `push` | `{ cwd, setUpstream?: boolean }` | 无 upstream 时 `git push -u origin <branch>`，否则 `git push` | `{ output, branch }` |
| `aiCommit` | `{ cwd, hint?: string }` | 见 §3.5 | `{ message, model, fallback }` |

写操作失败（非 0 退出）返回 `ok:false`，`error.message` 里带 `stderr` 首 2000 字符。

### 3.5 `aiCommit`

Host 端流程：

1. `git diff --cached`（若为空再用 `git diff`，再为空则用 `git status --porcelain` +
   未跟踪文件名列表）；diff 截断到 12 000 字符。
2. `git log -8 --pretty=format:%s` 作为风格参考。
3. `const llm = ctx.get('llm')`, `const sel = ctx.get('agentDefaultModel')?.currentSelection()`；
   缺任一个 → 返回 `ok:false` `code: "ai-unavailable"`。
4. `llm.stream({ provider: sel.provider, model: sel.model, reasoningEffort: sel.reasoningEffort,
   system: <中文/英文都行的系统提示>, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
   maxTokens: 200, temperature: 0.2, signal })`，累积 `text-delta` 得到文本。
5. 清理输出：去掉 code fence、首尾空白、取第一行；再校验（`looksLikeSubject`）：长度 <8、
   无 Conventional 前缀、以连接词/标点/未闭合括号结尾都视为模型输出不可用。为空或不可用则走降级：根据变更文件生成
   `chore: 更新 N 个文件`（中文环境）/`chore: update N files`，并置 `fallback: true`。
6. `data.model` 为 `"<provider>/<model>"`。

系统提示要求：只输出一行提交信息，遵循仓库最近的提交风格（中文仓库用中文），
不超过 72 字符，不要引号、不要解释。

### 3.6 超时

- 只读 op（snapshot/graph/diff）：30s；aiCommit：120s（模型可能较慢）。
- 网络写 op（fetch/pull/push）：180s。
- 其余写 op：30s。
超时由 `setTimeout(() => controller.abort(), ms)` 实现，`abort` 后返回 `code: "timeout"`。

## 4. Client 侧（`lib/client.js`）

### 4.1 注册的 UI（右侧边栏方案，2026-10-22 改版）

面板挂在**会话的右侧边栏（right sidebar）**，不再占用左侧全局面板位。

1. **Tab 类型（stage one）**：
   ```js
   ctx.effect(() => ctx.sidebarRightTabs.register({
     id: 'git-manager', kind: 'git-manager', priority: 'extension',
     title: () => t('panel.title'),
     guide: [{ order: 30, title: () => t('panel.title'), description: () => t('panel.guide') }],
   }), 'git-manager: right sidebar tab type')
   ```
   `guide` 条目让右侧栏「+ → 开始」指南页里出现「Git 管理」，从那里也能打开。
2. **Tab body（stage two）**：keyed 槽位 `sidebar.right.pane.tab`，key 用定义 id：
   ```js
   ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () =>
     ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'git-manager', locale: NS }, GitTabBody)))
   ```
   该槽位 **session scope**，body 的标准 props 自带 `sessionId`；据此从
   `ctx.sessions.list` 的 `byId[sessionId]` 取 `cwd`（会话摘要 row 上就有）。
   `SessionListState` 没有 `current` 字段，别再用 `retainedBy.mainView` 推导当前会话
   （那是全局面板时代为了 root-scope 才需要的；tab body 直接拿 sessionId）。
3. **入口按钮**：`conversation.session.header.utilities`（list、session scope）注册
   一个 `id: 'git-manager'`, `order: 10` 的内联 SVG 图标按钮（aria-label
   `t('panel.open')`），onClick = `ctx.sidebarRight.openTab('git-manager')`。
   右侧栏折叠时 seat 仍挂载，binding 存在，`openTab` 会自动展开右栏并定位到本 tab。
4. `exports.inject = ['slots', 'locale', 'sessions', 'sidebarRight', 'sidebarRightTabs']`；
   `dsh.client.inject` 需要列 `@deepseek-ai/dsh-client-ui-sidebar-right`、
   `@deepseek-ai/dsh-client-ui-conversation`、`@deepseek-ai/dsh-api-session-controller`
   以固定激活顺序。

### 4.2 文案 / 主题

- 通过 Client locale 服务注册字典：
  `ctx.effect(() => ctx.locale.register('git-manager', { zh: {...}, en: {...} }), 'git-manager: dictionaries')`，
  然后 `const t = ctx.locale.bind('git-manager')`。所有可见文案走 `t('key', {n: 1})`。
- 只用 `--dsw-alias-*` 主题 token（见下），禁止写死颜色（图标/差异色可用 token）。
  可用 token：`--dsw-alias-bg-base` `--dsw-alias-bg-layer-1` `--dsw-alias-bg-layer-2`
  `--dsw-alias-bg-overlay` `--dsw-alias-border-l1` `--dsw-alias-border-l2`
  `--dsw-alias-brand-primary` `--dsw-alias-label-primary` `--dsw-alias-label-secondary`
  `--dsw-alias-state-error-primary` `--dsw-alias-state-idle-primary`
  `--dsw-alias-state-success-primary` `--dsw-alias-state-warn-primary`
  `--dsw-specific-sidebar-fill`。
- 组件内联 style（React style object），不注入全局 CSS，不读写组件外的 DOM。

### 4.3 数据流

- 全部数据来自 `fetch('/api/git-manager', { method:'POST', credentials:'same-origin',
  headers:{'content-type':'application/json'}, body: JSON.stringify({op, cwd, ...}) })`
  （封装成 `rpc(op, params)`；`json.ok === false` 抛 `Error(json.error.message)`，
  带 `code` 属性）。
- 面板挂载时：立即 `snapshot` + `graph`；每 5s 轮询一次 `snapshot`（`document.hidden`
  时跳过）；窗口 `focus` 时再刷新；每次写操作成功后刷新 snapshot（push/pull/fetch 后
  也刷新 graph）。
- `cwd` 变化（切换会话）时清空选中状态并重新加载。`cwd` 为空时显示空态提示。
- 写操作进行中禁用对应按钮（`busy` 字符串标记）。

### 4.4 面板布局（右侧栏窄列，必须实现）

```
┌ 松栏顶栏：仓库名 + 分支下拉 + ↑ahead ↓behind + upstream 徽章
│            [刷新] [Fetch] [Pull] [Push] [＋新建分支]              ┐
├ tab 条：[变更 n] [提交图] [分支] [差异]                           │
├ 内容（flex 1，可滚动，按 tab 切换）                               │
│   变更：全部暂存/全部取消 + 冲突/已暂存/未暂存/未跟踪 分组行      │
│         行内 + / − 单文件暂存、点行看 diff                       │
│   提交图：等宽 graph 前缀 + refs 徽章 + subject + author/date     │
│         点行 → 差异 tab 显示该 commit patch                      │
│   分支：本地/远程列表，切换 / 删除（confirm）                     │
│   差异：文件头 + 增删统计 + hunk 行号/± 着色                      │
├ 状态条（toast / 错误 / 最近一次操作输出）                         │
└ 提交区（固定底部）：提交信息 textarea + AI 提示输入 + AI 生成按钮  │
                      + [提交] [提交并推送]                        │
```

窄列（约 360–560px，可全屏）适配：单列、不并排；顶栏按钮允许换行；
样式全部走组件内 `<style>` 元素（class 前缀 `gm-`，卸载即移除），主题色只从
`--dsw-alias-*` token 取；品牌视觉固定为 DeepSeek 蓝（`#4d6bfe` / `#2f49d6` /
`#43c9ff`）——胶囊 tab、渐变主按钮、状态药丸、diff/commit 卡片、胖鲸鱼空态
（bob + 气泡动画）；窄列用容器查询（`@container gm (max-width:430px)`）把顶栏
按钮收成纯图标、隐藏 graph 行尾作者/时间；宽屏（全屏）内容占满右栏；
提交图不再直接贴 `git log --graph` 的 ASCII 字符，而是按 lane 解析成每行 SVG
（20px 行高、8px lane、最多 10 lane，超出淡出），保证多分支/大量提交时竖线连续、
hash 与 subject 列对齐；顶栏/tab/提交卡片/状态条固定 `flex:none`，长列表只压缩
`.gm-scroll`（`flex:1 1 0`），不会再把顶栏挤扁；
全部暂存/取消按钮放内容顶部；提交区固定在底部始终可见。

- 空态：无会话 → 提示先选择会话；`repo.isRepo === false` → 提示当前目录不是 Git 仓库；
  `cwd-unavailable` → 「工作目录不存在或无法访问」；加载中 → 「加载中…」。
- 冲突文件（conflicted）单独分组并红色提示。
- 差异行用 token 前景色区分 add/del；禁止写死颜色。
- 提交前 `message.trim()` 为空或没有已暂存文件时禁用提交按钮。
- AI 生成的提交信息填进 textarea，用户可编辑；生成中按钮显示「生成中…」。

### 4.5 生命周期

- `apply` 内所有副作用（locale 注册、slot inject）用 `ctx.effect(...)` 包裹。
- 组件卸载清理定时器/监听（`useEffect` 返回 cleanup）。
- 组件内任何异常都不能让整个 slot 崩掉：用一个小 ErrorBoundary 组件包住面板。

## 5. Client bundle 壳（照抄，改 id 与内容）

```js
window.__ModuleLoader__.load({
  id: '@caozeal/dsh-next-git',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    var React = require('react')
    // ... 组件与 store ...
    exports.inject = ['slots', 'locale']
    exports.apply = function (ctx) { /* 注册 */ }
    return module.exports
  },
})
```

注意：`id` 必须等于 package name（`@caozeal/dsh-next-git`）；`apply` 里不要有
factory 期副作用。
