# 界面改版验证：左栏全局面板 → 右侧边栏 tab（2026-10-22）

## 改版动机

用户反馈：「放在左侧不合适吧，左侧是全局的，右侧侧边栏可以放么」。
Git 面板是**仓库级 / 会话级**工具，占用全局导航位不合适；改为会话右侧边栏的 tab。

## 改动（只动 Client 半区，Host RPC 协议不变）

| 旧（左侧全局面板） | 新（右侧边栏 tab） |
| --- | --- |
| `sidebar.panellist` 注册 Git 图标（order 24） | 移除；左侧恢复只有 插件 / 自动化任务 / 上下文洞察 |
| keyed `main` 注册全局面板 | 移除 |
| — | `ctx.sidebarRightTabs.register({ id/kind: 'git-manager', priority: 'extension', title, guide })` |
| — | keyed `sidebar.right.pane.tab`（key `git-manager`）注册面板 body（session scope） |
| — | `conversation.session.header.utilities` 注册入口图标按钮（`id: git-manager`, order 10）→ `ctx.sidebarRight.openTab('git-manager')` |
| 会话推导：`retainedBy.mainView` 找当前会话 | tab body 直接使用标准 prop `sessionId`，从 `ctx.sessions.list.byId[sessionId]` 取 `cwd` |
| 两栏布局（左 320px 变更列表 + 右 graph/diff） | 单列 tab 布局：`变更 \| 提交图 \| 分支 \| 差异`，提交区固定底部 |

`package.json`：`dsh.client.inject` 增加 `@deepseek-ai/dsh-client-ui-conversation`、
`@deepseek-ai/dsh-client-ui-sidebar-right`；`exports.inject` 增加
`sidebarRight`、`sidebarRightTabs`。`PROTOCOL.md` §4.1 / §4.4 已同步。

## 实测（本机 Web GUI，headless Chrome，bundle 热重载后）

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 左侧全局面板恢复原样（3 个按钮，无 Git） | PASS | 页面快照 `全局面板` 按钮集合 = 插件/自动化任务/上下文洞察 |
| 会话头部出现 Git 入口（aria-label「打开 Git 管理」） | PASS | 会话头部工具栏快照 |
| 点入口 → 右栏自动展开并出现「Git 管理」tab | PASS | `artifacts/V18-right-tab-changes.png` |
| 面板数据：仓库 dsh-plugins / 分支 main ✓ / 未暂存 3 / 未跟踪 41（`?` 字母） | PASS | 同上 |
| tab 切换：变更 → 提交图 → 分支 → 差异 | PASS | `V18-right-tab-graph.png`、分支页文本 |
| 点提交 47be913 → 差异 tab「提交 47be913d / +61 / -10」+ hunk | PASS | `V18-right-tab-commit-diff.png` |
| 点 README.md → 工作区 diff「+1 / -0」与 `git diff` 一致 | PASS | 面板文本 |
| 单文件暂存 → 已暂存 1；再取消暂存 → 回到未暂存 3（net zero，真实仓库已还原） | PASS | 面板文本 + `git status --porcelain` 前后一致 |
| 右栏「+」→ 指南页列出「Git 管理」条目，点条目回到本 tab（去重） | PASS | `V18-right-guide-entry.png` |
| 右栏「全屏」→ Git 面板铺满视口；「退出全屏」恢复标准宽度 | PASS | `V18-right-tab-fullscreen.png` |
| 关闭 tab → 头部入口再次点击可重新打开 | PASS | 面板文本 + 快照 |
| 收起右侧栏后布局恢复（colWidth=0，头部入口仍在） | PASS | DOM 测量 |

未覆盖 / 说明：

1. 本轮**未重跑**独立验证员的完整 UI 矩阵；`REPORT-phase2.md` 与 V1–V17 截图对应
   **旧版左侧面板布局**，其 Host RPC / git 行为结论仍然有效。新版界面证据为
   `V18-*.png` 与本文件。
2. 会话头部按钮只做「打开/聚焦 tab」；右栏关闭状态由右侧栏自己的「收起」控件管理，
   插件不额外接管。
3. 超窄窗口（<768px）下右侧栏自动全屏的既有行为沿用产品实现，未单独验证。

## 仓库与 profile 状态

- 真实仓库 `dsh-plugins`：验证中只对 README.md 做过「暂存 → 取消暂存」，结束时仍是
  `3 modified + ?? git-manager/`、`staged=0`。
- profile（`~/.dsh/profiles/web`）：仅由 `plugin_manager` 管理 bundle 行，未手改；
  改版全程只做 `lib/client.js` 等源码热重载，未重启 dsh。
- 测试：`node --test test/*.test.mjs` = 32/32 PASS（Host 未改动）。
