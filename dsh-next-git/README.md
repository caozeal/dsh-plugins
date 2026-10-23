# dsh-next-git — DSH Web 右侧边栏 Git 管理面板

> npm: <https://www.npmjs.com/package/@caozeal/dsh-next-git>
>
> 原名 `dsh-plugin-git-manager`，2026-10 起包名改为 `@caozeal/dsh-next-git`（目录仍为 `dsh-next-git/`，功能不变）。

在 DSH Web GUI **会话的右侧边栏**加一个 Git tab（2026-10-22 从左侧全局面板迁移而来）：
会话头部点 **Git 图标**直接打开（会自动展开右栏），或在右栏的「+ → 开始」指南页里
选「Git 管理」。面板内容：

- **便捷分支切换**：顶栏下拉出全部本地/远程分支（含 ahead/behind 与最近提交），
  一键切换；点远程分支自动建同名跟踪分支；支持新建、删除分支。
- **变更管理**：staged / unstaged / untracked / conflicted 四组文件列表，
  单文件或全部暂存/取消暂存，点击文件看 diff。
- **提交 / 推送 / 拉取**：Fetch、Pull、Push 按钮，提交信息输入框，
  支持「提交」「提交并推送」；无 upstream 时自动 `push -u origin <branch>`。
- **AI 提交信息**：读取已暂存 diff + 最近提交风格，调用当前默认模型生成一行
  Conventional Commits 提交信息，填入输入框供编辑；模型不可用时降级为
  `chore: 更新 N 个文件`。
- **提交图（graph）**：`git log --graph --all` 的图形化渲染，可点击任意提交
  查看该 commit 的 diff。
- **Diff 查看**：hunk 逐行渲染，带旧/新行号、增删配色、文件头与统计。

面板跟随当前会话的工作目录：切换会话即切换仓库；非 Git 仓库 / 无会话 / 目录被删
时显示对应空态。右侧栏可以全屏（自带的「全屏」控件），窄列下是单列 tab 布局：
`变更 | 提交图 | 分支 | 差异`，提交区固定在底部。

打开方式：
1. 会话头部工具栏的 **Git 图标**（aria-label「打开 Git 管理」）——最快；
2. 右侧栏的 **+ → 开始** 指南页 →「Git 管理」；
3. 右侧栏已打开本 tab 时直接点 tab 切换。

## 目录

```
dsh-next-git/
  PROTOCOL.md         # Host ↔ Client 冻结协议（RPC 形状与 UI 约定）
  package.json        # dsh.bundle.patch + dsh.client
  cordis.patch.yml    # 插入 git-manager 行
  index.js            # Host 入口：注册 POST /api/git-manager
  src/git.js          # git 执行环境 + 输出解析（纯函数）
  src/operations.js   # 12 个 op 的实现
  src/ai-commit.js    # AI 提交信息（llm + 降级）
  lib/client.js       # 浏览器 bundle（单文件，无构建；右栏 tab + 头部按钮）
  locale/{zh,en}.json # 插件市场/设置页展示文案
  icon.svg            # 插件图标
  test/               # 解析 / op / 真实仓库集成测试
```

## 安装

```bash
# 在 dsh-plugins 仓库内
dsh plugin --profile web add /Users/caozeal/projects/dsh-plugins/dsh-next-git
# 或从 npm 安装：
dsh plugin --profile web add @caozeal/dsh-next-git
```

或由 agent 用 `plugin_manager` 的 `install_bundle` 安装（推荐，profile 配置由
插件管理器写入，不手改 `~/.dsh/profiles/web`）：

```
plugin_manager: action=install_bundle, target=/Users/caozeal/projects/dsh-plugins/dsh-next-git
```

安装后刷新/重开 Web 页面，左侧栏出现 Git 图标（在搜索/会话图标附近）。
Host 半区（`/api/git-manager` 路由）随 Loader 生效；若页面已加载但图标未出现，
刷新一次页面即可。

## 手动挂载（不装 bundle 时）

1. 把插件目录加入 profile 依赖（`file:` 或 `link:`），`pnpm install`。
2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加：
   ```yaml
   - id: git-manager
     name: "@caozeal/dsh-next-git"
   ```
3. 重启 Web 服务。

## 测试

```bash
cd git-manager
npm test          # = node --test test/*.test.mjs
```

- `test/parsers.test.mjs`：porcelain / 分支头 / for-each-ref / graph / unified diff 解析，
  以及 `cleanGitEnv` 的 undefined 墓碑（删除继承自父进程的坏 `GIT_CONFIG_*`）。
- `test/operations.test.mjs`：12 个 op 的假 exec 单测（含超时、非法参数、非仓库、降级）。
- `test/ai-commit.test.mjs`：AI 提交信息清理、截断/半句话回退、模型流错误转 `ai-unavailable`、
  中文仓库的降级文案（单测合计 32 条，全绿）。
- `test/integration.test.mjs`：临时真实仓库跑 snapshot → diff → stage → commit →
  graph → 建/切/删分支 → AI 降级；不依赖 dsh 运行时。
- `test/live/`：真实 Web GUI 的验证清单、smoke 脚本、截图证据与验证报告
  （由独立验证员维护）。

## 界面改版说明（2026-10-22）

最初版本把面板放在左侧「全局面板」位（`sidebar.panellist` + keyed `main`）。按用户
反馈「左侧是全局的，不适合放仓库级 Git 面板」，已改为**右侧边栏 tab**：
`sidebarRightTabs` 注册 tab 类型 → keyed `sidebar.right.pane.tab` 注册 body →
`conversation.session.header.utilities` 放入口按钮，左侧全局栏恢复原样。

`test/live/` 下 V1–V17 的截图对应**旧版左侧面板布局**（RPC 协议、Host 行为与功能
结论仍然有效）；新版右栏界面的实测证据是 `test/live/artifacts/V18-*.png`，
说明见 `test/live/REPORT-v2-right-sidebar.md`。所有截图已打码（会话列表/对话区模糊），
处理规则见 [`test/live/artifacts/README.md`](test/live/artifacts/README.md)。

## 协议摘要

浏览器 → `POST /api/git-manager`（connection 层做同源凭据认证）：

```json
{ "op": "snapshot", "cwd": "/abs/repo" }
→ { "ok": true, "data": { "repo": {...}, "branches": [...], "status": {...} } }
```

op 一览：`snapshot` `graph` `diff` `stage` `unstage` `switchBranch` `deleteBranch`
`commit` `fetch` `pull` `push` `aiCommit`。完整字段见 `PROTOCOL.md`。

## 设计要点

- **Host 只做数据**：所有 git 操作在 Host 半区用 `ctx.subprocess` 执行，
  参数校验（绝对路径、ref/hash 白名单、`--` 分隔）在 `src/operations.js`。
- **图标 / 形象**：插件图标与空态形象是用 `custom-imagine` 生图技能生成的 Q 版
  鲸鱼娘（蓝色渐变长发、呆毛、鲸鳍耳、抱着白饭碗），参考社区 DeepSeek 鲸鱼娘与
  dsh-pet「蓝色大肥鱼」风格；prompt 与处理流程见 [`icon-prompt.md`](icon-prompt.md)。
  `icon.svg` 内嵌 256px PNG 以满足 DSH 图标约束，空态用 224px WebP 内嵌；顶栏/
  提交卡片的小鲸鱼也是生图产出（128px WebP），不再用手绘 SVG。
- **Client 只做展示**：单文件 classic script + 组件内 `<style>`（class 前缀 `gm-`，
  卸载即移除；窄列容器查询收按钮为图标），向 `ctx.sidebarRightTabs` 注册
  tab 类型、向 keyed `sidebar.right.pane.tab` 注册 body、向
  `conversation.session.header.utilities` 注册入口按钮；文案走 Client locale 服务
  （zh/en 108 个 key）。视觉以 DeepSeek 蓝为基调 + 胖鲸鱼吉祥物：圆角胶囊 tab、
  渐变主按钮、鲸鱼空态（bob 动画 + 气泡）、状态药丸、diff/commit 卡片，全部是
  组件内 CSS + 主题 token（见 `lib/client.js` 里的 `PANEL_CSS`）。提交图用
  SVG lane 渲染（20px 行高、最多 10 lane），长历史/多分支下不会挤掉文字。
- **失败可见**：git 非 0 退出把 stderr 摘要带回 UI，在底部状态条展示；
  只读操作（snapshot/graph/diff）不会阻断面板。
- **AI 是可选能力**：缺少 `llm` / `agentDefaultModel` 时 `aiCommit` 自动降级，
  不影响提交本身。

## 实现要点（踩过的坑）

- **删除继承环境变量必须用 `undefined` 墓碑**：Host 的 subprocess provider 把显式
  `env` 合并到父进程环境之上，只“不写这个键”删不掉继承值。本机父环境里有坏的
  `GIT_CONFIG_COUNT`（缺 `KEY_*`），最初导致所有 git 命令 fatal、snapshot 误报
  “不是仓库”。现在 `cleanGitEnv()` 对 `GIT_CONFIG_COUNT` / `KEY_*` / `VALUE_*`
  一律传 `undefined`。
- **右侧栏 tab 是 session scope**：body 的标准 props 直接带 `sessionId`，
  `cwd` 从 `ctx.sessions.list.getSnapshot().byId[sessionId]` 取。不要再依赖
  root-scoped `main` 槽的 standard hooks（那套是旧方案，实测取不到）。右栏折叠时
  seat 仍挂载，`ctx.sidebarRight.openTab()` 能直接展开并定位到本 tab。
- **AI 提交信息用 600 output tokens**：reasoning 模型会先花思考 token，200 会截断成
  `fix:` 之类半句话；再加 `looksLikeSubject()` 校验，不合格就回退确定性文案并置
  `fallback: true`（UI 显示「模型输出不可用，已生成降级文案」）。
- **错误码分层**：`invalid-params`（含未知 op）HTTP 400；git 业务失败 HTTP 200 +
  `ok:false`，UI 统一按 body 判定。
- **文案全部走 Client locale**（zh/en 共 104 个 key），tab 标题与头部按钮都是
  「Git 管理 / 打开 Git 管理」；面板只用 `--dsw-alias-*` 主题 token。

## 已知限制

- Pull 使用 `git pull`（遵循仓库配置），不做冲突自动处理；冲突会在变更列表
  的 conflicted 组里以红色显示。
- 大仓库的 graph 默认取 80 条（上限 300）；diff 超过 400k 字符会截断。
- 会话的工作目录被删除/不可访问时，面板显示「工作目录不存在或无法访问」空态
  （Host 返回 `cwd-unavailable`），不会展示原始 spawn 错误。
- AI 提交信息只生成一行 subject，不生成 body。
- 网络操作超时 180s；无凭据的私有仓库会失败并把 git stderr 显示出来。
