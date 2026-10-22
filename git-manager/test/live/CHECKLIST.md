# Git Manager 插件 · 安装后 live 验证清单

> 适用对象：`dsh-plugin-git-manager`（本仓库 `git-manager/`），安装进 `~/.dsh/profiles/web` 后，
> 在**当前正在运行的** DSH Web GUI 上做端到端验证。
> 本文件中的每条命令都已在本机核对过可执行性；标注「实测」的行为本轮验证时已经跑过并记下结果。
> 修订基准：2026-10-22，dsh `0.2.1-rc.2`，GUI 进程 pid 80684。

---

## 0. 环境事实（先读，避免踩坑）

### 0.1 服务与地址

| 项目 | 值 |
| --- | --- |
| GUI（本清单统一用） | `http://127.0.0.1:3080` |
| 监听进程 | `node .../bin/dsh --profile web --no-open --port 3080 --trusted-host 10.0.0.2:3080`（pid 80684） |
| 另有 WL 入口 | `socat OPENSSL-LISTEN:10.0.0.2:3080` → `dsh-token-gate.mjs :3081` → `127.0.0.1:3080`。**本清单不碰 WL 路径** |
| 宿主日志 | `/Users/caozeal/projects/deepseek-harness/dsh-wg.log`（`dsh-ctl.sh` 的 `LOG`，本进程 stdout/stderr 都在这里） |
| profile | `~/.dsh/profiles/web`（`dsh.profile.bundles` 决定加载层） |
| HMR | profile 里 `patchReload: "live"`；`@deepseek-ai/dsh-hmr` entry 为 active → 安装/启用可能**无需重启**（插件管理器返回 `application: "applied"`；若返回 `"restart-required"` 才需要 Lead 重启） |

### 0.2 认证（实测）

- launch token 文件：`/Users/caozeal/projects/deepseek-harness/.dsh-launch-token`（当前 43 字节，**每次 dsh 进程启动轮换**，不要写进任何提交/报告）。
- 交换方式：`GET /?token=<token>` → **303** + `Set-Cookie: dsh-auth-<base64url(sha256(authority))>=…; HttpOnly; SameSite=Strict; Max-Age=31536000`，`Location: ./`。
  实测命令与响应头（2026-10-22 16:14）：

  ```bash
  TOKEN=$(cat /Users/caozeal/projects/deepseek-harness/.dsh-launch-token)
  curl -sS -o /dev/null -D - -c /tmp/gm-cookies.txt "http://127.0.0.1:3080/?token=$TOKEN"
  # HTTP/1.1 303 See Other
  # location: ./
  # set-cookie: dsh-auth-VPhEEcLKeqRDBoBalzN2Nm7CnfxKhLE00pKIDWxt1sw=…; Max-Age=31536000; Path=/; HttpOnly; SameSite=Strict
  ```

- cookie 名绑定 authority：`127.0.0.1:3080` 与 `10.0.0.2:3080` 是**两个不同的 cookie**。本清单只用 loopback，所以一次交换即可。
- 认证边界（实测）：

  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:3080/api/git-manager   # 401（无 cookie）
  curl -sS -X POST -b /tmp/gm-cookies.txt -H 'content-type: application/json' \
       -d '{"op":"snapshot","cwd":"/Users/caozeal/projects/dsh-plugins"}' http://127.0.0.1:3080/api/git-manager   # 安装前：404 "not found"
  ```

  即：**带 cookie 得 404 = 已认证但路由不存在（Host 半区没加载）；不带 cookie 得 401**。这两个状态足以区分「认证坏了」和「插件没装好」。

### 0.3 本机 git 环境坑（实测，务必带上）

本机 shell 里 `GIT_CONFIG_COUNT=2` 但 `GIT_CONFIG_KEY_0` 缺失，直接跑 git 会：

```
error: missing config key GIT_CONFIG_KEY_0
fatal: unable to parse command-line config
```

因此本清单所有 `git` 命令都要清环境（与 PROTOCOL §2 的 `cleanGitEnv()` 是同一个问题；插件 Host 端必须走 `cleanGitEnv`）：

```bash
G() { env -u GIT_CONFIG_COUNT -u GIT_CONFIG_KEY_0 -u GIT_CONFIG_VALUE_0 git "$@"; }
# 例：G -C /Users/caozeal/projects/dsh-plugins branch --show-current   → main
```

### 0.4 验证目标仓库基线（2026-10-22 16:20 实测）

```bash
G -C /Users/caozeal/projects/dsh-plugins branch --show-current   # main
G -C /Users/caozeal/projects/dsh-plugins log --oneline -1        # 6a6f122 fix: 手动停止的任务默认不发任何提醒
G -C /Users/caozeal/projects/dsh-plugins status --porcelain      #  M long-task-reminder/lib/client.js
                                                                 #  M long-task-reminder/package.json
                                                                 # ?? git-manager/
G -C /Users/caozeal/projects/dsh-plugins remote -v               # 空（没有 remote！）
```

> 「没有 remote」是**免费的错误可见性测试场**：Pull/Push 必然失败，正好验证「网络 op 失败时错误可见」。

### 0.5 GUI 基线（安装前，实测）

- 侧边栏全局面板 `nav[aria-label="全局面板"]` 只有 3 个按钮：`插件`(order 0) / `自动化任务`(order 10) / `上下文洞察`。
  git-manager 协议声明 `order: 24` → **预期成为第 4 个（最后一个）面板按钮**。
- 每个面板按钮的 DOM 形态（源码 `dsh-client-ui-sidebar/lib/client.js` 确认）：

  ```html
  <button type="button" aria-label="<label 文本>" [aria-current="page" 当且仅当面板被选中]>
    <span class="panelGlyph" aria-hidden="true"><!-- 注册的图标组件，props: {size, active} --></span>
    <span class="panelTitle wide"><!-- label 文本（侧边栏展开时） --></span>
  </button>
  ```

  → 判定「图标出现」最稳的方式不是猜文案，而是**对比安装前后 nav 内 button 的 aria-label 集合**。
- 客户端 boot manifest：`window.__DSH_BOOT__.entries` 共 **74** 条，无 `dsh-plugin-git-manager`；
  `window.__ModuleLoader__.mode === "live"`；`rev = b3f78bd561a9`；release `0.2.1-rc.2/332895e`。
- 主区域：`main` 是 keyed slot，`entryKey = activePanelId`（选中面板 id）；点侧边栏按钮 → layout 记录 `activePanelId` → 该 key 的注册项渲染到主区域。
  **注意（实测）**：页面里**没有** `<main>` 元素（`document.querySelectorAll('main').length === 0`）。主区域是 `div.pI_x6G_centerCol`，
  验证时统一用 **`[class*="centerCol"]`** 选择器（hash 前缀可能随构建变化，别写死 `pI_x6G`）。
- 面板切换行为（实测）：点侧边栏按钮 → 该按钮 `aria-current="page"`，centerCol 换成面板内容、输入框消失；
  **再点同一个按钮不会关闭面板**。回到会话视图 = 点侧边栏的会话行（`treeitem`，如 `新会话`）。
  实测命令：`agent-browser --session "$AGENT_BROWSER_SESSION" click @<会话行 ref>` → centerCol 回到「探索未至之境 / 输入框」。

---

## 1. 用 agent-browser 打开 GUI（第一条命令之前先开独立 session）

`agent-browser` 已装（0.38.1，`/Users/caozeal/.nvm/versions/node/v24.20.0/bin/agent-browser`）。
**必须用自己命名的 session**（默认 session 是全机共享的，会劫持别人的页面）。

```bash
cd /Users/caozeal/projects/dsh-plugins
export AGENT_BROWSER_SESSION="gmverify-1fd9340e3e0e"   # 本验证任务固定用这个
TOKEN=$(cat /Users/caozeal/projects/deepseek-harness/.dsh-launch-token)

agent-browser --session "$AGENT_BROWSER_SESSION" open "http://127.0.0.1:3080/?token=$TOKEN"
agent-browser --session "$AGENT_BROWSER_SESSION" get url    # 期望 http://127.0.0.1:3080/（token 已被消费并 303 掉）
agent-browser --session "$AGENT_BROWSER_SESSION" get title  # 期望 DeepSeek Harness
```

实测结果：`url=http://127.0.0.1:3080/`、`title=DeepSeek Harness`，页面正常（侧边栏/会话列表/输入框齐全）。
cookie 落在 agent-browser 自己的浏览器配置里，后续同 session 的所有命令都自动带 cookie，**不需要也不能在 URL 里重复 token**。

刷新页面（安装后客户端 bundle 要重新拉 manifest）：

```bash
agent-browser --session "$AGENT_BROWSER_SESSION" open "http://127.0.0.1:3080/"
```

> 若 HMR 已把新 client module 热加载进当前页，也可以不刷新直接看；**判定以 boot entries + 侧边栏按钮为准**（见 §3）。

---

## 2. 安装态确认（Host 侧）——先确认这个，再谈 UI

### H1. 路由活了（最快、最硬的信号）

```bash
TOKEN=$(cat /Users/caozeal/projects/deepseek-harness/.dsh-launch-token)
curl -sS -o /dev/null -c /tmp/gm-cookies.txt "http://127.0.0.1:3080/?token=$TOKEN"   # 303
curl -sS -b /tmp/gm-cookies.txt -H 'content-type: application/json' \
  -d '{"op":"snapshot","cwd":"/Users/caozeal/projects/dsh-plugins"}' \
  -w '\nHTTP %{http_code} %{content_type}\n' http://127.0.0.1:3080/api/git-manager
```

预期（安装成功）：`HTTP 200 application/json; charset=utf-8`，body `{"ok":true,"data":{"repo":{"isRepo":true,"root":"/Users/caozeal/projects/dsh-plugins","branch":"main",…}}}`
判定：**404 → 未装/未加载（FAIL）**；401 → 认证问题（用 §0.2 重新换 cookie）；200 且 `repo.branch === "main"` → PASS。

### H2. profile 里 bundle 已登记

```bash
node -e "const p=require('/Users/caozeal/.dsh/profiles/web/package.json'); console.log(JSON.stringify({bundles:p.dsh.profile.bundles, dep:p.dependencies['dsh-plugin-git-manager']},null,1))"
ls -l ~/.dsh/profiles/web/node_modules/dsh-plugin-git-manager      # 期望存在（link: 或软链）
```

预期：`bundles` 数组含 `"dsh-plugin-git-manager"`，`dependencies` 里有它的 spec（`link:/Users/caozeal/projects/dsh-plugins/git-manager` 或版本号）。
注意：**不要**自己改这个文件去“帮忙”，安装只走 `plugin_manager`。

### H3. 插件管理器状态（宿主内视角）

用 `plugin_manager` 工具（只读）：

```
plugin_manager action=list_plugins limit=100   # 必要时翻页 offset=100/200
```

预期：出现 **bundle 行**（`moduleName` = `dsh-plugin-git-manager`，`fiberPhase: "active"`）以及其 patch 行（`entryId` 形如 `git-manager`，`enabled: true`）。
判定：`fiberPhase` 为 active/PASS；若行存在但 `enabled:false` → 插件被启用策略挡住；若行不存在 → bundle 未登记。
「启用/禁用」操作只由 Lead 用 `plugin_manager action=set_plugin` 做，验证员只读观察。

### H4. 宿主日志尾部（错误/告警）

```bash
tail -n 120 /Users/caozeal/projects/deepseek-harness/dsh-wg.log | grep -iE 'git-manager|error|warn' || echo '（无相关行）'
tail -f /Users/caozeal/projects/deepseek-harness/dsh-wg.log   # 实时跟随，做 UI 操作时开一个窗口
```

预期：安装/加载后能看到 git-manager 相关加载行（或至少**没有** `git-manager` 的 error/stack）。
判定：出现 `Cannot find module`、`must export`、`pending`、`cannot get property … without inject` 之类 → FAIL，原文抄进报告。

### H5. （可选）bundle 自带 patch 的 insert 行

```bash
grep -n -A6 "id: git-manager" ~/.dsh/profiles/web/node_modules/dsh-plugin-git-manager/cordis.patch.yml
```

预期：`insert:` 下有 `id: git-manager`、`name: dsh-plugin-git-manager`。
（`dsh.bundle.patch` 机制：profile 的 `dsh.profile.bundles` 选中包 → 读它的 `cordis.patch.yml` 覆盖层，不需要往 profile 的 patch 里手写。）

---

## 3. 安装态确认（Client 侧 / 浏览器）

### C1. boot manifest 里有 client module

```bash
cat <<'EOF' | agent-browser --session "$AGENT_BROWSER_SESSION" eval --stdin
(() => {
  const b = window.__DSH_BOOT__
  const ids = (b.entries || []).map(e => e.id)
  return { rev: b.rev, entryCount: ids.length,
           hasGitManager: ids.some(id => id.includes('git-manager')),
           gitManagerEntries: (b.entries || []).filter(e => e.id.includes('git-manager')) }
})()
EOF
```

预期（安装后 + 页面刷新）：`hasGitManager: true`，`entryCount: 75`（74 + 1），且该 entry 的 `url` 指向 `dsh-plugin-git-manager/lib/client.js`。
判定：`false` → 客户端半区没进 boot manifest（bundle 未登记 / dsh.client 声明缺失 / 需刷新）。

### C2. 侧边栏多出一个面板按钮（不猜文案）

```bash
cat <<'EOF' | agent-browser --session "$AGENT_BROWSER_SESSION" eval --stdin
(() => {
  const nav = document.querySelector('nav[aria-label="全局面板"]')
  return Array.from(nav.querySelectorAll('button')).map((b, i) => ({
    i, label: b.getAttribute('aria-label'),
    current: b.getAttribute('aria-current') || null,
    hasIcon: !!b.querySelector('.panelGlyph svg, .panelGlyph svg *'),
  }))
})()
EOF
```

基线（安装前）=`["插件","自动化任务","上下文洞察"]`。
预期（安装后）= 3 + 1 = 4 条，新增一条：`hasIcon: true`（内联 SVG 分支图形），位置按 `order: 24` 排在最后。
判定：多出的那条就是 git-manager 图标；把它的 `label` 原样记进报告（文案由 locale 决定，**不要预先断言文案**）。
若 4 条里多的那条 `hasIcon:false` → 图标组件渲染失败（FAIL，抄报错）。

### C3. 页面控制台无红字（可选但推荐）

```bash
agent-browser --session "$AGENT_BROWSER_SESSION" console          # 直接输出缓冲的 log/warn/error
agent-browser --session "$AGENT_BROWSER_SESSION" console --clear  # 读完后清空
```

判定：出现 `git-manager` 相关的 `Error`/`Uncaught` 即 FAIL（把原文抄进报告）。

---

## 4. UI 逐条验证（真实点击；每条给操作、预期、判定方式）

> 取证统一落到 `git-manager/test/live/artifacts/`：
> ```bash
> mkdir -p /Users/caozeal/projects/dsh-plugins/git-manager/test/live/artifacts
> agent-browser --session "$AGENT_BROWSER_SESSION" screenshot --annotate \
>   /Users/caozeal/projects/dsh-plugins/git-manager/test/live/artifacts/V1-sidebar.png
> ```
> 网络证据：先 `network har start` 再操作，最后 `har stop`：记录面板真实发出的 op/cwd/响应。
> ```bash
> agent-browser --session "$AGENT_BROWSER_SESSION" network har start \
>   /Users/caozeal/projects/dsh-plugins/git-manager/test/live/artifacts/panel.har
> # …操作…
> agent-browser --session "$AGENT_BROWSER_SESSION" network har stop \
>   /Users/caozeal/projects/dsh-plugins/git-manager/test/live/artifacts/panel.har
> ```
>
> **读取主区域文本**（下面多条复用；每段独立粘贴即可，`<main>` 元素不存在）：
> ```bash
> cat <<'EOF' | agent-browser --session "$AGENT_BROWSER_SESSION" eval --stdin
> (() => {
>   const col = document.querySelector('[class*="centerCol"]')
>   return col ? col.innerText : null
> })()
> EOF
> ```

### V1 侧边栏图标出现

操作：见 C2（快照 + 截图）。
预期：`nav[aria-label="全局面板"]` 内 4 个按钮，新增者 `hasIcon:true`，hover 出现 tooltip（label 文案），宽侧边栏下 `span.panelTitle` 文本 = label。
判定：截图 + C2 的 JSON 都留档。

### V2 面板打开

操作：

```bash
# 用 C2 里多出来的那个 label 定位（示例：label 为 "Git"）
agent-browser --session "$AGENT_BROWSER_SESSION" network requests --clear   # 清掉旧请求，便于看面板真实流量
agent-browser --session "$AGENT_BROWSER_SESSION" find role button click --name "<新增 label>"

# 主区域内容（注意：没有 <main> 元素，用 centerCol）
cat <<'EOF' | agent-browser --session "$AGENT_BROWSER_SESSION" eval --stdin
(() => {
  const nav = document.querySelector('nav[aria-label="全局面板"]')
  const col = document.querySelector('[class*="centerCol"]')
  return {
    buttons: Array.from(nav.querySelectorAll('button')).map(b => b.getAttribute('aria-label') + ':' + (b.getAttribute('aria-current') || '-')),
    centerHead: col.innerText.slice(0, 400),
    inputPresent: !!document.querySelector('textarea, [contenteditable="true"]'),
  }
})()
EOF
```

预期：
- 新增按钮 `aria-current="page"`，其余按钮为 `-`；
- centerCol 文本里出现当前仓库名 `dsh-plugins`、分支 `main`；`inputPresent: false`（不再显示会话输入框）；
- 页面无白屏/React 报错。
判定：`aria-current` + centerCol 文本含仓库名与分支 + 输入框消失。
失败时留 `centerHead` 原文 + 截图。
恢复会话视图：`snapshot -i` 找到会话行（`treeitem`）→ `click @<ref>`（实测：centerCol 回到「探索未至之境 + 输入框」，侧边栏按钮 aria-current 全清）。

### V3 顶栏仓库/分支/upstream/ahead/behind 与 CLI 一致

```bash
G -C /Users/caozeal/projects/dsh-plugins branch --show-current           # main
G -C /Users/caozeal/projects/dsh-plugins status --porcelain=v2 --branch | head -3
G -C /Users/caozeal/projects/dsh-plugins remote -v                       # 空 → 顶栏 remoteUrl 不显示/空
```

操作：读面板顶栏文本（§4 开头的「读取主区域文本」片段，或 `snapshot -i`）。
预期：分支显示 `main`；无 upstream 时不显示 ↑/↓ 或显示 0；仓库名 `dsh-plugins`。
判定：与上面 CLI 输出逐项对齐；不一致即 FAIL（附两边的值）。

### V4 变更列表分类与 `git status` 一致

```bash
G -C /Users/caozeal/projects/dsh-plugins status --porcelain
```

操作：读面板左列（变更区）文本。
预期基线（此刻）：`long-task-reminder/lib/client.js`（M，未暂存）、`long-task-reminder/package.json`（M，未暂存）、`git-manager/…`（未跟踪，porcelain 只列目录名 `git-manager/`，插件若用 `--untracked-files=all` 则列出具体文件——**两种都可接受**，只要与 API snapshot 的 `untracked` 一致）。
判定：分组（已暂存/未暂存/未跟踪/冲突）+ 状态字母 + 路径与 CLI 对齐；分组标题存在。

### V5 点击文件 → diff 显示正确

```bash
G -C /Users/caozeal/projects/dsh-plugins diff --numstat -- long-task-reminder/lib/client.js
# 记下 additions/deletions，作为对照
```

操作：在变更列表点击 `long-task-reminder/lib/client.js`。
预期：
- 切到「差异」tab；文件头显示路径 + `+additions / -deletions`，数值与 `--numstat` 一致；
- 至少 1 个 hunk，hunk 头 `@@ -x,y +a,b @@`；
- 行内容与 `G diff` 一致；`+` 行/`-` 行有可区分的前景色或背景（主题 token，非纯黑纯白）；
- 无 CSS/JS 报错。
判定：数值对齐 + 文本抽样 3 行对比 + 截图。

### V6 暂存 / 取消暂存（用无害探针文件，可回滚）

```bash
mkdir -p /Users/caozeal/projects/dsh-plugins/git-manager/test/live
printf 'probe\n' > /Users/caozeal/projects/dsh-plugins/git-manager/test/live/.tmp-probe.txt
G -C /Users/caozeal/projects/dsh-plugins status --porcelain | grep tmp-probe
```

操作（UI）：刷新面板 → 未跟踪组出现 `git-manager/test/live/.tmp-probe.txt`（或 `git-manager/`）→ 点该行「暂存」→ 期望移到「已暂存」组，状态字母 `A`；再点「取消暂存」→ 期望回到未跟踪/未暂存。
每次操作后底部状态条应显示该 op 的输出（`stage`/`unstage` 的 `output`）。
判定：三态（未跟踪 → 已暂存 → 未跟踪）都观察到 + `snapshot` 的 `status.staged` 与之同步。
清理（**必做**）：

```bash
G -C /Users/caozeal/projects/dsh-plugins restore --staged -- git-manager/test/live/.tmp-probe.txt 2>/dev/null || true
rm -f /Users/caozeal/projects/dsh-plugins/git-manager/test/live/.tmp-probe.txt
```

### V7 提交图显示

```bash
G -C /Users/caozeal/projects/dsh-plugins log --all --oneline -5
```

操作：点面板「提交图」tab；读文本 / 截图。
预期：等宽字体逐行渲染；首行 `*` + refs 徽章（当前仓库应有 `HEAD -> main`）；每行有短 hash、subject、author、相对日期；行数与后端 `graph` 的 `lines` 数量一致（可从 HAR 里的 `graph` 响应取）。
判定：首 5 条的 hash/subject 与 `git log` 一致；`HEAD -> main` 徽章存在。

### V8 点开提交 → 展示该提交 diff

```bash
HEAD7=$(G -C /Users/caozeal/projects/dsh-plugins rev-parse --short HEAD)   # 例：6a6f122
G -C /Users/caozeal/projects/dsh-plugins show --stat --format= $HEAD7
```

操作：在提交图点击该提交行。
预期：自动切到「差异」tab，显示该提交的 patch（文件头 + hunk），文本含该提交改动的文件路径；HAR 里出现 `{"op":"diff","mode":"commit","hash":"<full 40 位>"}`。
判定：patch 内容与 `git show --patch --format= <hash>` 抽样一致；`mode === "commit"`。

### V9 AI 提交信息

操作：点「AI 生成信息」。
预期（二选一，都算 PASS）：
- 成功：textarea 被填入一行提交信息（≤72 字、无 code fence），HAR 里 `aiCommit` 响应 `{"ok":true,"data":{"message":"…","model":"<provider>/<model>","fallback":false}}`；
- 降级：UI 明确提示 AI 不可用（HAR 里 `{"ok":false,"error":{"code":"ai-unavailable"}}`）。
生成中按钮文案应为「生成中…」且不可重复点击。
判定：文本/错误可见 + 产出结构符合 PROTOCOL §3.5。**不要在真实仓库点提交**，本项只生成不提交。

### V10 Fetch / Pull / Push 按钮存在，失败时错误可见

操作：确认顶栏三按钮存在；依次点击 `Pull`、`Push`（本仓库**没有 remote**，必然失败，白盒安全）。
预期：
- 请求真的发出（HAR：`{"op":"pull"}` / `{"op":"push"}`）；
- UI 可见错误（底部状态条 / toast），文本含 git stderr 摘要（例如 `There is no tracking information for the current branch` / `fatal: No configured push destination`）；
- 错误不被吞掉、不白屏；按钮在请求期间禁用（`busy`），结束后恢复。
判定：错误文本与 `G pull` / `G push` 的真实 stderr 对得上；HAR 中响应 `ok:false` 且 `error.message` 非空。
> `Fetch` 在无 remote 时可能 `ok:true`（空输出），属正常；只要 UI 不崩即 PASS。

### V11 数据流证据（轮询 / cwd / 切会话）

```bash
agent-browser --session "$AGENT_BROWSER_SESSION" network requests --clear
# …在面板里做操作（或等 11s 看轮询）…
agent-browser --session "$AGENT_BROWSER_SESSION" network requests \
  --filter '/api/git-manager' --method POST --json > /tmp/gm-net.json
node -e "
const j = JSON.parse(require('node:fs').readFileSync('/tmp/gm-net.json','utf8'));
const rows = j.data?.requests ?? j.requests ?? [];
console.log('count =', rows.length);
for (const r of rows) console.log(r.status, r.url, 'body=', (r.postData||'').slice(0,160));
"
```

> `--json` 的结构（实测）：`{ success, data: { requests: [ { url, method, status, postData, timestamp, … } ] } }`；
> 面板的请求是 `POST /api/git-manager`，`content-type: application/json`，`postData` 就是 `{op, cwd, …}`。
> 安装前实测能在其中看到 `{"op":"snapshot","cwd":"/Users/caozeal/projects/dsh-plugins"}` → **404**，可用同一方法做证据留档。

预期：
- 面板挂载后立即发 `snapshot` + `graph`；
- 之后约每 5s 一次 `snapshot`（等 11s 观察应约 2 次）；写操作成功后额外刷新 `snapshot`；
- 每个请求 body 的 `cwd` = 当前会话 cwd（`/Users/caozeal/projects/dsh-plugins`）。
判定：请求序列 + body 的 cwd 与当前会话一致；`document.hidden` 跳过轮询属加分项（headless 下不便构造，可只做代码走查）。

### V12 空态：无会话

操作：切到一个「没有会话」的状态（例如侧边栏点工作区行但不进会话；或新建空会话后不发送）。读主区域文本。
预期：提示先选择会话（cwd 为空 → 不发 RPC 或发空 cwd 请求被拦），无报错、无白屏。
判定：出现提示文案 + HAR 证明 cwd 为空时没有发非法请求（PROTOCOL §4.3：`cwd` 为空时显示空态提示）。
> 若 GUI 不好构造，退化为代码走查（`lib/client.js` 里 cwd 空分支）+ 记录说明，不要伪造 PASS。

### V13 空态：非仓库目录

先拿 API 侧硬证据（`smoke.mjs` 已覆盖，可手动重放）：

```bash
NONREPO=$(mktemp -d /tmp/gm-nonrepo-XXXXXX)
curl -sS -b /tmp/gm-cookies.txt -H 'content-type: application/json' \
  -d "{\"op\":\"snapshot\",\"cwd\":\"$NONREPO\"}" http://127.0.0.1:3080/api/git-manager
# 期望 {"ok":true,"data":{"repo":{"isRepo":false}}}
```

UI 侧（**可选，需 Lead 同意**，因为要给 GUI 添加一个临时工作区）：
`添加工作区` → 选 `$NONREPO`（非 git 目录）→ 新建会话 → 点 Git 图标 → 期望显示「当前目录不是 Git 仓库」，且**不**弹错误、不崩溃。验证完删除该临时工作区并 `rm -rf "$NONREPO"`。
若不做 UI 侧：在报告里明确写「UI 空态未做真实点击，仅有 API 证据 + 代码走查」，不得写成已验证。

### V14 加载中态（可选）

首次点开面板的极短时间内应有「加载中…」。可用慢网络模拟观察：

```bash
agent-browser --session "$AGENT_BROWSER_SESSION" network route '**/api/git-manager' --body '{"ok":true,"data":{"repo":{"isRepo":true}}}'
# 该命令是即时返回，无法造延迟；建议改用 HAR/代码走查
agent-browser --session "$AGENT_BROWSER_SESSION" network unroute
```

判定：不作为阻塞项；有则记录，无则标注「未覆盖」。

### V15 主题 token / 双语（可选）

- 颜色：面板内不得出现写死颜色。粗查：
  ```bash
  cat <<'EOF' | agent-browser --session "$AGENT_BROWSER_SESSION" eval --stdin
  (() => {
    const root = document.querySelector('[class*="centerCol"]')
    const bad = []
    for (const el of root.querySelectorAll('*')) {
      const s = el.getAttribute('style') || ''
      if (/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(s)) bad.push({ tag: el.tagName, style: s.slice(0, 120) })
    }
    return { hardcodedCount: bad.length, sample: bad.slice(0, 5) }
  })()
  EOF
  ```
  预期 `hardcodedCount: 0`（`color-mix()` 里引用 `var(--dsw-alias-*)` 不算写死）。
- 双语：设置里把语言切到 English → 面板文案应跟随变化 → 切回中文。验证完恢复原语言。

### V16 错误边界（可选）

用 `network route` 造一次 500/异常响应，面板应显示错误条而不是整块 slot 崩掉：

```bash
agent-browser --session "$AGENT_BROWSER_SESSION" network route '**/api/git-manager' --body '{"ok":false,"error":{"code":"internal","message":"synthetic smoke failure"}}'
agent-browser --session "$AGENT_BROWSER_SESSION" click "<刷新按钮 ref>"
agent-browser --session "$AGENT_BROWSER_SESSION" network unroute
```

预期：出现错误提示（含 synthetic smoke failure），面板其余部分仍可交互。

---

## 5. API 逐 op 核对（机器可跑）

```bash
cd /Users/caozeal/projects/dsh-plugins
node git-manager/test/live/smoke.mjs                # 全绿退出码 0
node git-manager/test/live/smoke.mjs --keep         # 失败时保留 disposable 仓库排查
```

`smoke.mjs` 的行为（安装前已验证：路由 404 时以退出码 2 明确报「Host 半区未注册路由」）：

| 覆盖 | 断言要点 |
| --- | --- |
| 认证 | token→303+cookie；无 cookie → 401；非法 JSON → 400 + `{ok:false,error.code}` |
| `snapshot` | 结构完整（repo/branches/remotes/status/stashes）；root+branch 与 CLI 一致；staged/unstaged/untracked/conflicted 与 `git status --porcelain` 集合一致；`clean` 与总行数一致 |
| `snapshot` 非仓库 | `ok:true` + `repo.isRepo:false`（不报错） |
| `graph` | 行结构（graph/hash/full/refs/author/date/subject）；full=40 位 hex；首条与 `git log -1 --all` 一致；`limit=1/9999` 不炸 |
| `diff` | worktree：hunk 头 `@@`、行 kind ∈ {ctx,add,del}、行号字段、hunks 统计==additions/deletions；untracked；空 diff → `hunks:[] raw:""`；staged；commit 模式含 `diff --git` |
| 写操作 | `stage(paths)`/`unstage(paths)`/`stage(all)`/`unstage(all)` 后 snapshot 同步；`commit` 的 hash/subject 与 `git log -1` 一致；空 message → invalid-params；`switchBranch`(create)/切回/`deleteBranch` |
| 网络 op | 无 remote 仓库：`pull`/`push` 必须 `ok:false` 且 `error.message` 非空含 git 关键词（错误可见）；`fetch` 成功/失败都必须结构化 |
| `aiCommit` | `ok:true` → `message` 非空 ≤200、`model` 含 `/`、`fallback` 布尔；否则 `ok:false code=ai-unavailable` |
| 错误码 | 所有失败响应 `error.code ∈ {invalid-params, not-a-repo, git-failed, timeout, ai-unavailable, internal}` |

> 写操作全部在 `mkdtemp` 的 disposable 仓库里做，**不碰真实仓库**；加 `--keep` 才会保留临时目录。

---

## 6. 通过/失败判定汇总（报告用）

必须全部满足才算验证通过：

1. H1 `POST /api/git-manager` → 200 + `repo.branch=main`；
2. H3 plugin_manager 中 bundle 行 `fiberPhase=active`；
3. C1 boot entries 含 `dsh-plugin-git-manager`；
4. C2 侧边栏多一个带图标的按钮；
5. V2 面板可打开（`aria-current="page"` + 主区域内容）；
6. V3/V4/V5/V7/V8 的数据与 CLI 逐项一致；
7. V6 暂存/取消暂存三态可观察且可回滚（干净收尾）；
8. V9 AI 信息生成成功或明确 `ai-unavailable`；
9. V10 网络 op 按钮存在且失败错误可见；
10. V13 API 非仓库 `isRepo:false`（UI 空态如未做真实点击，报告须显式标注「未覆盖」）；
11. `smoke.mjs` 退出码 0；
12. 宿主日志无 git-manager 相关 error，浏览器控制台无相关红字。

任何一条不满足：把「命令 + 实际输出摘录 + 截图/截图路径」写进报告，**不要写“应该可以”**。

---

## 7. 纪律与清理

- 禁止：重启 dsh（`dsh-ctl.sh`）、改 `~/.dsh` 下任何配置、改插件 `src/` `lib/` `index.js` `package.json` `cordis.patch.yml`、跑 `pnpm install`、向真实仓库 commit / 切分支 / push。
- 唯一可写目录：`git-manager/test/live/**`（含 `artifacts/`）。探针文件、截图、HAR 都放这里。
- 每轮 UI 验证结束：
  ```bash
  rm -f /Users/caozeal/projects/dsh-plugins/git-manager/test/live/.tmp-probe.txt
  G -C /Users/caozeal/projects/dsh-plugins status --porcelain | grep -E 'tmp-probe|live/' || echo '工作区干净'
  ```
- agent-browser 收尾：验证结束后 `agent-browser --session "$AGENT_BROWSER_SESSION" close`（避免常驻 daemon）。
- token 属凭据：任何命令输出、报告、提交里都不得出现 token 或 cookie 值（本清单里只出现文件名与 cookie 名前缀）。
