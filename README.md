# dsh-plugins — DeepSeek Harness 插件集

DSH（DeepSeek Harness）插件集合。每个子目录是一个独立插件，自带 README、配置模板和测试，
可按需装进 DSH Web profile 或某次会话的动态插件。

- npm：<https://www.npmjs.com/package/@caozeal/dsh-next-git>
- 许可证：MIT

## 为什么用这个 Git 面板（而不是其他十来个同类插件）

DSH 生态里「Web UI 里管 Git」的插件已经不少。我们不在功能清单上比谁多一项，而是把下面
四件事做到位——它们恰好是最容易被忽略、也最容易坑到你的地方：

| | dsh-next-git | 常见同类插件 |
| --- | --- | --- |
| **出错不静默** | git 非 0 退出时把 stderr 摘要回显到状态条；只读操作（snapshot / graph / diff）永不阻断面板 | 多数只在控制台报错或静默失败 |
| **AI 只做可选增强** | 缺少 `llm` / 默认模型时自动降级为 `chore: 更新 N 个文件`，**永远不挡提交** | 部分插件在模型不可用时提交按钮直接失效 |
| **协议冻结** | 有独立的 [`PROTOCOL.md`](dsh-next-git/PROTOCOL.md)，把 12 个 op 的请求/响应形状与 UI 约定写死（**冻结的只是我们自己的 Host↔Client 契约**，DSH 宿主升级仍可能要适配） | 通常只有 README 描述 |
| **工程验收** | 32 条单测（`npm test` 全绿）+ 27 项 RPC smoke + 真机全链路截图证据（[`test/live/`](dsh-next-git/test/live/)），CI 校验 tag 后自动发版 | 多数无测试或仅手测 |

另外几处细节：**跟随会话切换仓库**（面板 cwd 就是当前会话的 cwd）、**zh/en 全量文案**、
**`--` 分隔与 ref/hash 白名单**的参数校验、**npm Trusted Publishing（OIDC）** 发布（带 provenance，
不用 token）。

> 能力上我们**没有**独占项：AI 提交信息、提交图、diff 都有别家在做（有的还带 PR/CI 联动、
> 图片 diff、AI 解冲突）。选我们是因为稳定和可预期，不是因为别人做不到。

## 目录

| 插件 | 目录 | 状态 | 说明 |
| --- | --- | --- | --- |
| Git 管理 | [`dsh-next-git/`](dsh-next-git/) | ✅ 可用 | Web **右侧边栏** Git 面板：分支切换、暂存/提交/推送/拉取、AI 提交信息、提交图与 diff |

## 快速开始：Git 管理

```bash
dsh plugin --profile web add @caozeal/dsh-next-git
```

装好后刷新页面，在任意会话头部点 **Git 图标**（会自动展开右侧栏），或从右侧栏的
「+ → 开始」指南里选「Git 管理」。面板跟随当前会话的 cwd，切换会话即切换仓库。

其他安装方式：

- Web GUI → **插件** → 安装 bundle，选择本目录下的 `dsh-next-git/`；
- 用 `plugin_manager` 工具安装，`target=/path/to/dsh-plugins/dsh-next-git`。

详细功能、Host RPC 协议与设计说明见 [dsh-next-git/README.md](dsh-next-git/README.md)
和 [dsh-next-git/PROTOCOL.md](dsh-next-git/PROTOCOL.md)。

### 宣传片

38 秒功能介绍片（1080p60，配乐用 ACE-Step 生成）。成片全片为运行时渲染的 mock 面板，
不含真机截图与会话画面，可自由分发。

https://github.com/user-attachments/assets/c57169b4-df00-450d-b4f0-7a2c64db03b6

完整版（含无音轨版、可下载原片）：<https://dsh-next-git.1017835747.workers.dev/>
分镜、素材来源与重新渲染方式见 [video/README.md](video/README.md)。

## 发布（维护者）

`@caozeal/dsh-next-git` 通过 **npm Trusted Publishing（OIDC）** 自动发布，不需要 npm token：

1. 修改 `dsh-next-git/package.json` 的 `version`（如 `0.1.5`）
2. 提交后打同名 tag 并推送：

```bash
git tag v0.1.5
git push origin main --tags
```

GitHub Actions（`.github/workflows/publish.yml`）会校验 tag 与版本号一致、跑单测、执行
`npm publish --access public`，并由 npm 自动生成 provenance。

首次使用需在 npm 包设置页配好 trusted publisher（GitHub Actions / caozeal / dsh-plugins /
`publish.yml`，勾选 Allow npm publish）。

## 约定

- 插件源码用**纯 ESM JavaScript + JSDoc**（零构建、可直接内联进动态插件；
  提升为 harness 包时再移植成 TypeScript）。
- 运行期配置走 Web GUI 插件配置页（settings 服务，持久化到 `settings.yaml`）；
  各插件目录的 `config.json` 仅作旧版/开发兜底。
- 每个插件至少带自测（`test/`）；涉及 UI 的插件附真机验证清单与证据
  （如 `dsh-next-git/test/live/`）。

## 插件从「独立目录」提升为「harness 包」的路径

独立目录便于快速迭代；一旦要持久挂在 Host 组合里，标准做法是把它移植进
deepseek-harness 的 `packages/` workspace 成为 `@deepseek-ai/dsh-*` 包，
再在组合里加一行（参考 `dsh-lab/ui-schedule-integration.patch` 的做法：
新增包 + `cordis.patch.yml` 加行 + `package.json`/`tsconfig`/`pnpm-lock` 同步）。
