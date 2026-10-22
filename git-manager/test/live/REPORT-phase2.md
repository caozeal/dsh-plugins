# Git Manager 插件 · 第二阶段 live 验证报告（终版）

- 验证时间：2026-10-22 16:36–17:20（CST）
- 验证对象：`dsh-plugin-git-manager` 0.1.0，安装方式 `link:/Users/caozeal/projects/dsh-plugins/git-manager` → profile `web`
- 运行环境：dsh `0.2.1-rc.2`，GUI `http://127.0.0.1:3080`（pid 80684，**全程未重启**）
- 最终复验 bundle：`bootRev=48cabb636063`，客户端模块 `dsh-plugin-git-manager` rev `303b900885e8`（boot entries 74 → **75**）
- 验证人：verifier（独立 agent-browser session `gmverify-1fd9340e3e0e`，headless Chrome，与 Lead 页面隔离）

> **最终结论：PASS。** Host RPC 全绿（smoke 27/27），单元测试 32/32，浏览器端全部关键链路真机点击通过（含临时仓库里的 提交/新建分支/切分支/删分支/暂存/推送拉取错误可见）。第一轮发现的 3 个问题（未跟踪字母、AI 截断、未知 op 状态码）已全部修复并复验通过。未覆盖项仅剩 2 条非核心边界（见 §5）。

---

## 1. 通过项（最终复验后）

| 编号 | 项 | 结果 | 证据 |
| --- | --- | --- | --- |
| H1 | `POST /api/git-manager` 带 cookie → 200 JSON，`repo.branch=main` | PASS | `smoke.mjs`；curl |
| H3 | plugin_manager：bundle 行 `fiberPhase=active`、`enabled=true`、`source=link:…/git-manager` | PASS | 页内 RPC `pluginManager/listPlugins` |
| H4 | 宿主日志有 `[git-manager] 已注册 /api/git-manager`，无 error/stack | PASS | `/Users/caozeal/projects/deepseek-harness/dsh-wg.log` |
| C1 | 刷新后 boot entries 含 `dsh-plugin-git-manager`（74→75），url=`plugins/??dsh-plugin-git-manager/client.js&rev=…` | PASS | 页内 eval（`bootRev=48cabb636063`，client rev `303b900885e8`） |
| C2/V1 | 侧边栏 3 → **4** 个面板按钮，新增 `aria-label="Git 管理"`、内联 SVG、order 24 最后 | PASS | `artifacts/V1-sidebar-4buttons.png` |
| V2 | 点按钮 → `aria-current="page"`，centerCol 切换为面板，无白屏/React 错误 | PASS | `artifacts/V2-panel-open.png` |
| V3 | 顶栏 `dsh-plugins` + 绝对路径 + `main ✓`；下拉仅 main；无 upstream/↑↓（无 remote） | PASS | `artifacts/V3-V4-panel-header-changes.png` |
| V4 | 未暂存 3 / 未跟踪 29，与 `git status --porcelain -uall` 逐条一致；**未跟踪字母已是 `?`**（修复复验） | PASS | `artifacts/V4-untracked-question-mark.png`（替换旧证据） |
| V5 | 点 `long-task-reminder/lib/client.js` → 工作区 diff `+1/-2`、hunk `@@ -279,8 +279,7 @@`，与 `git diff --numstat` 一致 | PASS（复验抽查） | `artifacts/V5-diff-worktree.png` |
| V7 | 提交图 9 行 hash/subject/`HEAD -> main`/作者/时间与 `git log --all` 逐条一致 | PASS | `artifacts/V7-commit-graph.png` |
| V8 | 点 `47be913` → 「提交 47be913d / +61 / -10」13 hunks，与 `git show --stat` 一致 | PASS（复验抽查） | `artifacts/V8-commit-diff.png` |
| 分支 tab | 本地分支 1 / main / 当前 / 最近 subject，与 `git branch -vv` 一致 | PASS | `artifacts/V2-panel-open.png` |
| V9 | AI 生成：按钮「生成中…」→ 结果填 textarea + 「由 magpie/group/deepseek-flash 生成，可继续编辑」；**连续 5 次全部可用**（详见 §1.2） | PASS（复验） | `artifacts/V9-ai-commit-message.png`、`artifacts/V17-ai-5runs.har` |
| 提交按钮禁用 | 空信息 / 无暂存 → 「提交」「提交并推送」disabled；有信息+有暂存 → enabled（实测切换） | PASS | eval 快照 |
| V10 | Fetch→「Fetch 完成」（无 remote 退出码 0，正确）；Pull→`There is no tracking information…`；Push→`fatal: 'origin' does not appear…`；与 CLI stderr 一致、错误可见、按钮 busy→恢复 | PASS | `artifacts/V10-push-error-visible.png`、`artifacts/V10-V11-network-git-manager.json` |
| V11 | 挂载即 snapshot+graph；12s 内 2 次 snapshot 轮询；`document.hidden=true` 后 12s **0 次**；恢复后立即补刷 | PASS | 网络采样 |
| V12 | 无会话空态文案 + 0 RPC（`status.noSession` 分支，代码未变；证据为修复前 bundle，新 bundle 重试遇到边界态，见 §5-2） | PASS（标注） | `artifacts/V12-empty-no-session.png` |
| V13 | 非仓库：`snapshot` → `{isRepo:false}`；写操作 → `not-a-repo`（200 + ok:false）；非仓库诊断字段 `repo.error` 按新 PROTOCOL §3.1 保留 | PASS | `smoke.mjs`；curl |
| V15 | 面板 957 元素内 0 处写死颜色，全走 `--dsw-alias-*` | PASS | eval 扫描 |
| V16 | 注入错误响应 → 「出错了：<message>」，面板存活，unroute 后恢复 | PASS | `artifacts/V16-error-boundary.png` |
| 未知 op | `POST {"op":"nonsense"}` → **HTTP 400** + `{"ok":false,"error":{"code":"invalid-params","message":"未知操作：nonsense"}}`（复验修复） | PASS | `artifacts/V17-unknown-op-400.txt` |
| 协议：错误码/JSON | 成功响应 `application/json; charset=utf-8`；非法 JSON 400；错误码均在 6 种内 | PASS | `smoke.mjs` |

### 1.1 临时工作区 UI 写操作（新增，V17）

环境：`mktemp -d` → `git init -b main` → config user → `chore: init` 提交 → 改 `a.txt` + 新增 `c.txt`（dirty）。
GUI：添加工作区（路径输入）→ 自动选中该工作区会话 → 打开「Git 管理」面板（root 显示 `/private/tmp/gm-ui-write-7hAJlb`）。

| 步骤 | 操作（真实点击） | 预期 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| V17-01 | 打开面板 | 仓库 `gm-ui-write-7hAJlb` / main / 未暂存 1(M a.txt) / 未跟踪 1(`?` c.txt)，空 diff 提示 | PASS | `V17-ui-write-01-temp-repo-panel.png` |
| V17-02 | a.txt 行点 `+`（单文件暂存） | 已暂存 1（M a.txt），`stage` toast；CLI `M  a.txt` | PASS | `V17-ui-write-02-stage-single.png` |
| V17-03 | 点「全部暂存」 | 已暂存 2（M a.txt、A c.txt），toast「已暂存全部变更」；CLI `M  a.txt` / `A  c.txt` | PASS | `V17-ui-write-03-stage-all.png` |
| V17-04 | 填提交信息 → 点「提交」 | toast「已提交 b5a3380」；面板「工作区干净」；CLI 新提交 `b5a3380 test: ui write ops from verifier`；提交图 2 行 | PASS | （文本证据见下） |
| V17-05 | ＋新建分支 → 名 `ui-verify-branch` → 创建 | 分支 select 出现两项且当前为 `ui-verify-branch`；提交图 refs `HEAD -> ui-verify-branch` + `main`；toast「已创建分支 ui-verify-branch」；CLI 一致 | PASS | `V17-ui-write-04-new-branch.png` |
| V17-06 | 分支下拉选 `main` | 切回 main，toast「已切换到 main」；CLI `main` | PASS | `V17-ui-write-05-switch-back-main.png` |
| V17-07 | 分支 tab → 该分支「删除」→ JS confirm「确定删除分支 ui-verify-branch？」→ 接受 | 本地分支 1 / main 当前；toast「已删除分支 ui-verify-branch」；CLI 仅 main | PASS | `V17-ui-write-06-delete-branch.png` |
| V17-08 | 点 Push | 无 remote → 错误可见：`git push -u origin main 失败：fatal: 'origin' does not appear…` | PASS | `V17-ui-write-07-push-error.png` |
| V17-09 | 点 Pull | 无 tracking → 错误可见：`There is no tracking information for the current branch…` | PASS | `V17-ui-write-08-pull-error.png` |

清理（已执行并校验）：
- GUI「删除工作区」确认框 → 删除临时工作区；刷新后侧边栏无该条目，`document.body` 无 `gm-ui-write` 残留；
- 产品语义（locale `delete.desc` 明确）：删除工作区只移除工作区条目，**会话记录保留并落到「未分组」**；实测确实出现一个残留空白会话（其 cwd 指向已删 temp repo），刷新页面后应用已自动清理，最终侧边栏无该条目；
- 验证结果：`~/.dsh/storages/workspace.json` 恢复为原有 8 个工作区路径、无临时路径；`session_projcache.json` 无临时路径引用；
- `rm -rf /tmp/gm-ui-write-*`（已删除）；
- 真实仓库 `dsh-plugins`：`staged=0`、3 modified（README.md、long-task-reminder/lib/client.js、long-task-reminder/package.json）、untracked 仅 `git-manager/` —— **与验证前一致**；
- `~/.dsh/profiles/web` 未被本人改动（`dsh.profile.bundles` 含 `dsh-plugin-git-manager`、dep=`link:…/git-manager`，为 Lead 安装时状态）。

### 1.2 AI 生成质量复测（连续 5 次，HAR 记录）

| # | 输出 | fallback | 请求耗时 | 可用性 |
| --- | --- | --- | --- | --- |
| 1 | `fix: 设置页插件槽改用 settings 命名空间注册并补 inject 依赖，README 新增 git-manager` | false | 5.8s | 可用 |
| 2 | `feat: 新增 git-manager 插件并修复插件配置卡片插槽注册` | false | 2.6s | 可用 |
| 3 | `feat: 新增 git-manager 插件；修复设置卡片 slot 注册方式与 inject 依赖` | false | 3.7s | 可用 |
| 4 | `fix: 修正设置页插件卡片注册参数并补充 git-manager 条目` | false | 3.3s | 可用 |
| 5 | `feat: 新增 git-manager 插件；修复长任务提醒设置卡片 slot 注册` | false | 4.1s | 可用 |

结论：修复后 **5/5 可用**（无一截断、无 `fix:`/`feat` 类碎片输出、无需要 fallback），请求耗时 2.6–5.8s。
对照修复前同一 prompt 的 8 次采样曾出现 `fix:`、`feat`、「…（改用 key）并」等截断（原 `maxTokens:200`），现已通过 `maxTokens:600` + `looksLikeSubject()` 校验修复（`src/ai-commit.js:68,163,186`；UI 降级文案 `status.aiFallback = 模型输出不可用，已生成降级文案`）。
注：本轮 5 次均由 UI 触发；`smoke.mjs` 的 aiCommit 断言同时覆盖 ok:true 与 `fallback:true` 两种形态。

## 2. Host 全量核对

- `node git-manager/test/live/smoke.mjs` → **通过 27，失败 0（EXIT=0）**：认证/401、content-type、非法 JSON 400、未知 op 400、snapshot 结构/CLI 一致/非仓库、graph 结构+limit、diff 5 种模式、stage/unstage(paths|all)、commit、空 message、switchBranch/deleteBranch、pull/push 错误可见、fetch、aiCommit、非仓库写操作。写操作全在 `mkdtemp` 仓库执行。
- 独立跑插件单测：`node --test test/*.test.mjs` → **32/32 pass**（与 Lead 声明一致）。

## 3. 问题跟踪（全部闭环）

| # | 问题 | 状态 |
| --- | --- | --- |
| 3.1 | 未跟踪状态字母显示 `U`（协议要求 `?`） | **已修复并复验**：`lib/client.js:329 return '?'`；UI 实测 `未跟踪 29 / ? …`，证据 `V4-untracked-question-mark.png` |
| 3.2 | aiCommit 输出偶发截断（`fix:` / `feat` / 以「并」结尾） | **已修复并复验**：maxTokens 200→600 + `looksLikeSubject()` 校验 + fallback 文案；连续 5 次可用（§1.2） |
| 3.3 | 未知 op 返回 200（协议要求参数非法 400） | **已修复并复验**：HTTP 400 + `invalid-params`（`index.js:134`） |
| 3.4 | 非仓库 `repo` 带额外 `error` 诊断字段 | **保留为合理扩展**，已写入 PROTOCOL §3.1；正常仓库不带（smoke 断言） |

## 4. 证据文件（`git-manager/test/live/artifacts/`）

- `V1-sidebar-4buttons.png`、`V2-panel-open.png`、`V3-V4-panel-header-changes.png`
- `V4-untracked-question-mark.png`（未跟踪 `?` 复验）、`V5-diff-worktree.png`、`V7-commit-graph.png`、`V8-commit-diff.png`
- `V9-ai-commit-message.png`、`V17-ai-5runs.har`（5 次 AI 生成的请求/响应原文）
- `V10-push-error-visible.png`、`V10-V11-network-git-manager.json`、`V16-error-boundary.png`、`V12-empty-no-session.png`
- `V17-ui-write-01…08-*.png`（临时工作区的暂存/提交/分支/错误可见全过程）
- `V17-unknown-op-400.txt`（未知 op → 400 的 curl 原文）

复跑：
```bash
cd /Users/caozeal/projects/dsh-plugins
node git-manager/test/live/smoke.mjs          # Host RPC 27 项
node --test git-manager/test/*.test.mjs       # 插件单测 32 项
cat git-manager/test/live/CHECKLIST.md        # 浏览器端逐条操作/判定
```

## 5. 未覆盖项（明确声明）

1. **超大 diff（`truncated:true`）的 UI 呈现**：未构造 >400k 字符 diff；API 侧未实测截断路径。
2. **V12 无会话空态（新 bundle 未重拍到干净空态）**：旧 bundle 证据见 `V12-empty-no-session.png`；新 bundle 中 `status.noSession` 分支（`lib/client.js:87`）未改动。新 bundle 重试时遇到的是一条**边界态**而非干净空态，详见 §5-3。
3. **边界态（非阻塞，已记录）**：删除临时工作区后，其空白会话按产品语义保留到「未分组」，且 cwd 指向已删目录；此时若该会话仍被选为当前会话，Git 面板会显示 `出错了：无法执行 git rev-parse --show-toplevel：spawn git ENOENT`（错误可见、面板未崩溃、切到正常会话后恢复）。属「cwd 目录已不存在」的兜底：可考虑在 UI 侧做目录存在性判断并显示空态，本轮不改代码。
4. **`document.hidden` 以外的焦点/切会话刷新时序**：只验证了 hidden 跳过与恢复补刷，未做窗口 focus 的独立计时。

## 6. 仓库与配置完整性

```bash
git -C /Users/caozeal/projects/dsh-plugins diff --cached --name-only | wc -l   # 0
git -C /Users/caozeal/projects/dsh-plugins status --porcelain                  # 3 modified + ?? git-manager/
```
- 全程未重启 dsh、未改 `~/.dsh` 配置、未改插件源码；所有新增文件都在 `git-manager/test/live/**`。
- 临时工作区/会话/temp repo 均已删除并校验无残留（§1.1 清理）。
- 验证期间 GUI 页面最终恢复到会话视图（`Git 管理` 无 aria-current），不会给用户留下打开的面板。
- 最终 bundle 上的回拍：`V1-sidebar-4buttons.png`、`V2-panel-open.png`、`V7-commit-graph.png` 均已在 `bootRev=48cabb636063` 下重拍（此前版本的同名文件已覆盖）。
