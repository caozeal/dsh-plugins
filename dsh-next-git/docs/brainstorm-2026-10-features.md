# dsh-next-git 特色功能头脑风暴（2026-10-27）

> 4 个独立视角并行调研：Agent 原生 Git / 可视化审阅 / 生态增长 / 平台可行性。
> 原始笔记：`/tmp/dsh-next-git-brainstorm/`（4 份，共 1000+ 行）。本文是交叉核实后的结论。

## 0. 先划边界：这些平台已经做了

| 已有能力 | 出处 | 结论 |
|---|---|---|
| 每轮对话末尾「本轮变更文件卡片」+ 右栏 changes-review tab | `dsh-client-ui-deliverables` 挂 `conversation.chat.turnTail`；数据来自 `dsh-workspace-changes` | **「看每轮改了什么」不是差异化**，不要再做一遍 |
| turn 级改动数据 | `ctx.workspaceChanges.summary(sessionId, seq)` | 当原料用 |
| 右侧栏 tab / 会话头按钮 | 本插件已在用 | — |
| worktree 创建服务 | `ctx.get('worktrees')` | ⚠️ 官方 web 组合**没挂**（web-app/base patch 均无），要用只能走纯 git |
| approval 服务 | `ctx.get('approval').request()` | ⚠️ **要求 open turn**，面板按钮（idle）调必被 reject |

**空白只有一句：turn 级改动从来没有变成 Git 操作。** 没人把它变成可提交的集合、可回滚的提交、可携带血缘的历史、可被拦截的危险动作。

---

## 1. 建议的身份升级

现在是「一个做得比较稳的 Git 面板」。亮点应该来自一个竞品**结构性做不到**的身份：

> **DSH 里第一个懂 agent 的 Git 面板：**
> **每轮对话都是一个可回滚的提交，每个提交都记得是哪一轮写的，AI 的每次危险 git 操作都要先过你这一关。**

三条支线共用一套 op（`turnState` / `commitTurn` / `provenance` / `guard` / `timeline`），不是三个独立功能。

---

## 2. 主线 A：轮次提交 + 提交血缘 —— ❌ 用户已否决（2026-10-27）

> 决策：**不做**。理由：用户判断价值不大（路径级串味只是导火索，核心是一轮一提交的工作流本身不是刚需）。
> 保留本节仅作记录，不要据此排期。下面主线 B/C 与观感层的结论不受影响。

**卖点**：「每轮对话，都是一个可回滚的提交」

- **数据**：`ctx.get('workspaceChanges').summary(sessionId, seq)`（平台已挂载）。
  seq 的取法（这是唯一实施坑）：summary 以 `workspace/changes` 事件的 seq 为键，而 turnTail props 给的只是 turn 号 →
  Host 侧用 `ctx.get('sessions').get(id).snapshotEvents()` 扫该会话事件、找最后一条 `workspace/changes` 拿 seq。**Host 可自足，不需要客户端传 seq。**
- **写入（关键，别用路径级）**：`git commit --only -- <paths>` 会串味 —— 实测复现：turn1 改 a,b（b=b1），turn2 又改 b（b=b2），只提交 turn1 时提交进去的是 **b2**，于是 turn2 的改动提前进了 turn1 的历史。
  正解是**自己打 turn 快照，直接用 tree 构造 commit，不经过工作区**（实测通过）：
  1. `turn/start` 与 `turn/end` 各打一次快照：`GIT_INDEX_FILE=.git/tmp-idx git add -A && git write-tree` → 得到 `treeBefore` / `treeAfter`（对象落**本仓库 objects**，不用私有 `GIT_OBJECT_DIRECTORY`，所以后续可读）
  2. 提交本轮（顺序提交的快路径）：`git commit-tree <treeAfter> -p HEAD` → `git update-ref refs/heads/<branch> <new>` → `git reset --mixed HEAD`（只同步 index，**工作区一个字节都不动**）
  3. 若 `HEAD^{tree} != treeBefore`（用户插了手动提交/乱序提交）：走慢路径 `git diff <treeBefore> <treeAfter> | git apply --cached --3way`，冲突则明确报错，绝不静默
- **血缘**：message 尾部追加 trailers —— `Agent-Session: <短id>` / `Agent-Turn: <n>` / `Agent-Model: <provider/model>` / `Agent-Worktree: <path>`。
  用 `git log --format='%(trailers)'` **脱离本插件也永远可读** —— 这是最强的「技术观点」传播物。
  （注意：用户历史里 Co-Authored-By 规范已废除，所以默认只写 Session/Turn，其余做成开关。）
- **精度**：自建快照后是**内容级**（不是路径级），这是本功能能成立的前提。注意 `workspaceChanges` 自带的快照不可用 —— 它写在私有 object 目录（`GIT_OBJECT_DIRECTORY`），tree OID 我们的进程读不到（源码已核实）；但它的 `diff()` 逐文件 hunk 可作为「无法自建快照」时的降级输入。
- **语义定义**：第 N 轮改动 = `treeBefore(N)` → `treeAfter(N)`。用户在两轮之间手改的内容会算进**下一轮**（不是上一轮），UI 要写清这一点。
- **代价与边界**：每轮两次全仓库 `add -A`（大仓库要实测耗时，超阈值降级并提示）；快照对象会堆积 → 定期 `gc` 或用 `refs/dsh/turns/<n>` 保活后按策略清理；merge/rebase 进行中直接拒绝。
- **降级链**：无 workspaceChanges → 扫 `tool/call` 的 write/edit 参数路径 → 再不行 `git status --porcelain` 全量并标 `approximate:true`。
- **难度**：M。**Demo 帧**：对话尾部卡片「🐋 Turn 42 · 3 files +42 −7 · [提交本轮]」→ 右栏滑入 `feat: … (turn 42)`；终端 `git log --format='%(trailers)'` 同屏 = README 首图。

## 3. 主线 B：Agent Git 护栏（★★★★★，唯一结构性差异）

**卖点**：「AI 会执行 git，所以这个面板管得住 AI 的 git」

- **机制**：`ctx.on('tools/pre-execute', (exec, next) => ...)` 是 waterfall，可在**任何工具调用前**决定 allow / deny / ask。
  匹配 bash/pwsh 里的危险命令（`reset --hard` / `push --force|-f` / `clean -fd` / `branch -D` / `checkout -- .` / `rebase` / `stash drop|clear`）。
- **动作**：先 `git update-ref refs/dsh-git/rescue/<UTC ts>` 建救援点，再 `return {kind:'ask'}` 弹审批。
  `approval.request` 要求 open turn —— pre-execute 恰好就在 turn 内，两个约束严丝合缝。
  **面板按钮（idle 状态）走审批是技术上不可行的**，所以这个能力只能以「护栏」形态存在 —— 这反而成了独特性来源。
- **安全阀（必须做）**：`ctx.get('approval')` 缺失时 **必须 allow**（缺 approval 会 fail-closed 变 deny，把 agent 卡死）；handler 抛错也 allow；必须 `next()` 不短路。
- **附赠**：**Agent Git 时间线** —— 从会话事件解析本会话 agent 跑过的每条 git 命令，红/黄/绿分级，一键建/恢复救援点。
- **竞品为什么抄不走**：所有同类插件（含 4542★ 的 better-sidebar）都是被动查看器；只有 agent 运行时的插件能在工具执行前介入。
- **难度**：M（逻辑简单，风险全在误伤和降级）。
- **Demo 帧**：红色审批卡「⚠ 拦截：git reset --hard HEAD~2」+ 右栏「已建救援点 …/恢复」。

## 4. 主线 C：Git 变成模型的一等工具（★★★★）

**卖点**：「AI 不用再拼 bash 命令：它有结构化的 git 工具，每次调用在对话里是一张可读的卡片」

- `ctx.get('tools').register({name, description, parameters: JSONSchema, output:{schema, render}, execute})` —— 纯 JSON Schema 即可，不必 import defineTool（已核实用法样例：`dsh-tool-working-directory`）。
- 配 `tool.call.toolview`（按工具名 keyed）把调用渲染成卡片：`已提交 a1b2c3d · feat: …`，点开定位到面板。
- 价值：模型参数结构化（比 bash 字符串可靠）、危险动作可走 approval（**这是 approval 唯一可用路径**）、面板与模型共用同一套校验。
- **风险**：全局注册影响所有 agent → 必须带开关；工具名不能撞（`run_code` 是保留名）。
- **难度**：M。**Demo 帧**：对话里蓝色 Git 卡片 + 右侧面板同步高亮。

---

## 5. 观感层：决定第一眼（成本低、收益高）

| 功能 | 卖点 | 关键事实 |
|---|---|---|
| **词级 + 原生语法色 diff** | 「只有真正改动的那个词会亮」 | 平台 CSS 已注入 `--dsw-alias-file-diff-{added,deleted}-{bg,gutter,marker}` 和 `--shiki-token-*`（已核实），零依赖就能做出「和 GUI 代码块同色温」的 diff |
| **hunk 级暂存**（图形化 `git add -p`） | 「只提交半个文件」 | `ctx.subprocess` 的 stdin 支持 `{ data }`（已核实）→ `git apply --cached -` 可行。**这是唯一「竞品都没有」的硬功能** |
| **彩色提交图** | 「每条分支一种颜色，能截图发推」 | 只改 Client，约 120 行；ref 名 hash → 色相，HEAD 发光 |
| 大仓库性能 | 门槛不是卖点 | diff 行虚拟化、graph 增量；上述三项都依赖它 |

## 6. 分发层

- **在线可玩 Demo**：client.js 的数据全收口在一个 `rpc()` 里 → 加一个 demo 旁路 + 静态页挂现有 workers.dev。
  解决「宣传片全是渲染示意」的可信度漏洞，是把已有投入变成点击漏斗的最便宜一步。
- **会话行 Git 徽章**：侧栏每个会话行显示分支 + 脏文件数（纯 Client，sessions 快照已有 cwd）。⚠️ 该席位只在 **idle** 会话行挂载，文案别承诺 always。
- **SSE 实时刷新**：`connection.fetch` 支持 GET + 流式 Response（已核实，官方 HMR 就是先例），可以去掉 5s 轮询 —— 「别人 5 秒一刷，我们文件一变就亮」。
- **零凭据 PR**：复用本机 `gh` 登录态（不落任何 token），推完顺手开 PR；没有 gh 就回退成 compare URL。打的是竞品「要装 GitHub App + PAT」的摩擦点。
- **共享 Git RPC**：`@caozeal/dsh-next-git/rpc` + PROTOCOL.md 第三方调用节，被别的插件依赖 = 反向曝光。

## 7. 明确不做（做了会被看穿）

| 想法 | 原因 |
|---|---|
| 每轮变更卡片 / turn 级 diff 展示 | **平台 deliverables 已做** |
| PR/CI 徽章、Issues/Actions 页签 | Dayi-Z/dsh-git-manager、LinXueyuanStdio/dsh-git 已做深 |
| 图片 diff | xbzbing/dsh-git-panel 已有（19★），只是完整度补齐 |
| 独立「AI 解冲突」 | chzisnull/dsh-git-tree 已做；只保留「派给 live 会话」形态 |
| worktree 面板 | vibeinging/dsh-desktop 已 483★；且 `worktrees` 服务在 web 组合里没挂 |
| 「Agent 写的 vs 我手写的」精确归属 | **不可验证**（同 turn 内用户编辑也算该 turn；token ≠ 行数） |
| CHANGELOG 生成 / 后台定时 fetch / 仓库健康度 / 贡献热力图 | 与 agent 原生无关的 LLM 套壳或纯噱头 |

## 8. 如果只做 3 件事（Turn Commit 被否决后更新）

1. **词级 diff + hunk 级暂存**（★★★★★）—— 观感 + 硬功能双收：原生 diff/shiki token 已在平台里（零依赖），
   hunk 级暂存是全生态唯一「竞品都没有」的功能。实测：`git diff -U3` 切出单个 hunk → `git apply --cached --recount` 成功只暂存该 hunk，另一处改动仍在工作区。
2. **Agent Git 护栏 + 时间线**（★★★★★）—— 唯一竞品结构性做不到的点（`tools/pre-execute` + rescue ref），一句话讲得清，一帧就炸。
3. **彩色提交图**（★★★★）—— 只改 Client 约 120 行，决定 README 首图；是上面两项的免费放大器。

顺序建议：**1 出图（最快见效）→ 2 造独特性 → 3 补观感**；
分发层（在线 Demo / 会话行徽章 / SSE 替换轮询）随时可并行，不占主路径。

**如果只能做一件：hunk 级暂存。** 它是唯一「竞品做不到 + 演示零风险 + 一帧讲得完」的功能，
而词级 diff 是它的免费搭售（共用同一套渲染改造）。

## 9. 实施前必须先解决的风险

1. **hunk apply 失败会改坏索引**：必须逐 hunk 单独 apply、失败即回滚已应用部分（成功后重拉 diff，不做乐观更新）；
   重命名 / 二进制 / 子模块 / 无末尾换行 / CRLF 一律禁用 hunk 级暂存，退回文件级。
2. **pre-execute 误伤**：保守正则 + 可关 + 不确定只审计不拦；handler 抛错一律 fail-open。
3. **approval 只在 open turn 可用**：护栏是唯一形态，面板按钮别试图走审批。
4. **平台版本耦合**：pre-execute / tools.register 都是平台服务，写降级矩阵 + 单测（无 approval / 无 agents / handler 抛错 → 全 allow）。
5. **大仓库性能**：diff 行虚拟化、graph 增量刷新——词级 diff 和彩色 graph 都依赖它，不做会卡。

## 10. 本轮已实测验证的事实（避免实施时返工）

环境：git 2.50.1 (Apple Git-155)、DSH 0.2.1-rc.3。

| 结论 | 验证方式 |
|---|---|
| ⚠️ **路径级提交会串味**：turn1 改 a,b（b1）、turn2 改 b（b2），只提交 turn1 时提交进去的是 **b2** | 按真实场景复现：`git show HEAD:b.txt` → `b2`（期望 b1） |
| ✅ 自建 tree 快照 + `commit-tree` 可实现内容级 turn commit（**方案已否决，仅存档**） | 实测：两轮各 `write-tree` → `commit-tree <treeAfter> -p HEAD` → `update-ref` → `reset --mixed`，逐提交 b 依次为 b0 → b1 → b2 |
| ✅ **hunk 级暂存可行**：切出单个 hunk 后 `git apply --cached --recount` 只暂存该处，另一处留在工作区 | 20 行文件改 2 处 → 提取第 1 个 hunk 成 patch → `apply --cached`；`diff --cached` 只有 line2，`diff` 仍剩 line18 |
| `git commit --only -F - -- <paths>` 只提交指定路径，**用户已 staged 的内容不被带走** | 实测：staged a.txt + 改 b.txt → `--only -- b.txt` 后 `git status` 仍为 `M  a.txt` |
| trailer 可写入并在**任何工具**里读回 | `git log -1 --format='%(trailers)'` 与 `git interpret-trailers --parse` 均输出 `Agent-Session: …` / `Agent-Turn: 42` |
| 平台 CSS 已有 diff 配色与语法高亮 token | 安装包内 `--dsw-alias-file-diff-{added,deleted}-{bg,gutter,marker}`、`--shiki-token-*` 均存在 |
| `ctx.subprocess` stdin 支持 `{ data: string }` | `dsh-subprocess/lib/types/types.d.ts:30-32` `SubprocessStdinMode = 'ignore' \| 'pipe' \| { data: string }` |
| `ctx.on('tools/pre-execute')` 是 waterfall，可返回 `{kind:'ask'}` | `dsh-tools/lib/index.js:3321`；`dsh-workspace-changes`、`dsh-tool-jobs` 已有先例 |
| `approval.request()` 在 idle 会话上直接抛错 | `dsh-user-approval/lib/index.js:130` 原文：outside an open turn 即 reject |
| `ctx.get('worktrees')` 在官方 web 组合里没有挂载 | `dsh-base` / `dsh-web-app` 的 cordis.patch.yml 均无 `experimental-worktree` 行 |
| `workspaceChanges` 快照不可被我们的 git 进程读取 | `dsh-workspace-changes/lib/index.js:249-258` 使用私有 `GIT_OBJECT_DIRECTORY` |

**仍待验证（不要写进 README）**：`ctx.get('tools').register` 在第三方插件加载路径下是否生效、`connection.fetch` 的 GET 流式响应是否真逐块 flush。

