# 在线 Demo

一个**不重写 UI** 的可交互演示页。

```
demo/
├── index.html        页面外壳（假窗口 + 平台主题 token）
├── host-shim.js      假宿主：ModuleLoader / ctx 服务 / 拦截 fetch
├── boot.js           启动：加载 fixture → 渲染真实面板
├── fixtures.json     预录的真实仓库数据（由 gen-fixtures.mjs 生成）
├── gen-fixtures.mjs  录制脚本：直接调用 src/operations.js
└── check.mjs         自检：契约不匹配就报错
```

## 为什么这么做

Demo 里加载的是插件发布包里**同一份** `lib/client.js`，只是把它依赖的宿主能力
补了一个最小实现（约 200 行的 `host-shim.js`）：

| 真实宿主 | Demo 里 |
|---|---|
| `window.__ModuleLoader__` | 直接 `factory(require)`，`require('react')` 返回全局 React |
| `ctx.slots` / `locale` / `sessions` / `sidebarRight` / `sidebarRightTabs` | 各给一个最小实现，只覆盖 client.js 真正调用的方法 |
| `POST /api/git-manager` | 替换 `window.fetch`，按 op 返回 `fixtures.json` 里的数据 |
| 平台注入的 `--dsw-alias-*` CSS 变量 | `index.html` 里按 `dsh-client-ui-theme` 的原值补一份（含深色） |

所以这里看到的渲染、配色、交互，就是装好插件后的样子。**不存在「Demo 一套、
插件另一套」的漂移**——真漂移了 `check.mjs` 会报错。

## 数据是真的

`fixtures.json` 不是手写的，是 `gen-fixtures.mjs` 在一个真实 git 仓库上
调用**真实的** `src/operations.js` 录下来的：

```bash
# 1. 准备一个有多分支历史的仓库（示意）
mkdir -p /tmp/whale-notes/src && cd /tmp/whale-notes
git init && git commit --allow-empty -m "init: 项目骨架"
# ... 建分支、合并、留一些未提交改动 ...

# 2. 录制
node demo/gen-fixtures.mjs /tmp/whale-notes
```

录到的包括 `snapshot` / `graph`（含 `colors` 与 `refColor`）/ 每个变更文件的
`diff`（含词级 `inline` 片段）/ 每个提交的 `diff`。

## 写操作是禁用的

Demo 只读。点「暂存」「提交」「Push」会在底部状态条提示
「演示模式为只读快照」，**不会假装成功**——假装成功比报错更糟。

唯一的例外是 **Pull**：为了让「无上游 → 选远端分支 → 建立跟踪」这条交互可视，
Demo 里不带参数的 Pull 会模拟 `There is no tracking information` 失败并弹出
「拉取选项」；在面板里确认后返回一条只读的「已拉取」回执（不联网、不改仓库）。

## 本地预览

必须走 HTTP（`file://` 下浏览器会拦 `fetch`）：

```bash
cd dsh-next-git
python3 -m http.server 8099
# 打开 http://127.0.0.1:8099/demo/
```

注意服务根目录要是 `dsh-next-git/`（页面按 `../lib/client.js` 引用真实代码）。

## 改完插件记得

```bash
node demo/check.mjs
```

它检查三件事：

1. **fixture 结构**是否还符合真实协议（比如 `graph.lines[].colors` 还在不在）；
2. **shim 是否满足 client.js 的 `exports.inject` 契约**——client.js 新注入一个
   服务而 shim 没实现，这里直接失败，不用等浏览器白屏才发现；
3. **页面装配**是否还引用了真实 `client.js`。

若只改了 fixture 相关（比如协议加了字段），重新录制即可：
`node demo/gen-fixtures.mjs <仓库路径>`。

## 部署

线上地址：**<https://dsh.caozeal.cn/next-git/demo/>**

`demo/` 是纯静态的，和宣传片播放页一起由 `video/pages.mjs` 打进站点，
再用 Cloudflare Workers 静态资源发布（见 `video/wrangler.toml` 与
`.github/workflows/site.yml`）。站点挂在 `dsh.caozeal.cn/next-git/` 子路径下，
所以生成时要带前缀参数：`node video/pages.mjs video/site next-git`。

不挂 GitHub Pages 的原因：`caozeal.github.io` 仓库把 `www.caozeal.cn` 设为 Pages
自定义域，而该域名实际由 nginx 服务，项目站点会被 301 过去必然 404；而且 Pages
自定义域只能占域名根，不支持子路径。

React 走 unpkg CDN，其余零依赖。