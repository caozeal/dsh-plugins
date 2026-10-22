# dsh-plugins — DeepSeek Harness 插件集

DSH（DeepSeek Harness）插件集合。每个子目录是一个独立插件，自带 README、配置模板和
测试，可按需装进 DSH Web profile 或某次会话的动态插件。

## 目录

| 插件 | 目录 | 状态 | 说明 |
| --- | --- | --- | --- |
| Git 管理 | `git-manager/` | ✅ 可用 | Web **右侧边栏** Git 面板：分支切换、暂存/提交/推送/拉取、AI 提交信息、提交图与 diff（32 单测 + 27 项 RPC smoke + 真机全链路验证） |

## 快速开始：Git 管理

仓库地址：<https://github.com/caozeal/dsh-plugins>

### 安装（Web profile）

本地插件以 bundle 形式安装（DSH 0.2.x，profile `~/.dsh/profiles/web`）：

- Web GUI → **插件** → 安装 bundle，选择本目录下的 `git-manager/`；或
- 用 `plugin_manager` 工具安装，`target=/path/to/dsh-plugins/git-manager`。

装好后刷新页面，在任意会话头部点 **Git 图标**，或从右侧栏的「+ → 开始」指南里选
「Git 管理」即可打开面板。面板跟随当前会话的 cwd，切换会话即切换仓库。

详细功能、Host RPC 协议与设计说明见 [git-manager/README.md](git-manager/README.md)
和 [git-manager/PROTOCOL.md](git-manager/PROTOCOL.md)。

## 约定

- 插件源码用**纯 ESM JavaScript + JSDoc**（零构建、可直接内联进动态插件；
  提升为 harness 包时再移植成 TypeScript）。
- 运行期配置走 Web GUI 插件配置页（settings 服务，持久化到 `settings.yaml`）；
  各插件目录的 `config.json` 仅作旧版/开发兜底。
- 每个插件至少带自测（`test/`）；涉及 UI 的插件附真机验证清单与证据
  （如 `git-manager/test/live/`）。

## 插件从「独立目录」提升为「harness 包」的路径

独立目录便于快速迭代；一旦要持久挂在 Host 组合里，标准做法是把它移植进
deepseek-harness 的 `packages/` workspace 成为 `@deepseek-ai/dsh-*` 包，
再在组合里加一行（参考 `dsh-lab/ui-schedule-integration.patch` 的做法：
新增包 + `cordis.patch.yml` 加行 + `package.json`/`tsconfig`/`pnpm-lock` 同步）。
