# dsh-plugins — 我们的 dsh 插件项目

DSH（DeepSeek Harness）插件开发项目。每个子目录是一个独立插件，自己带 README、
配置模板和测试，可按需挂载进 DSH 的 Host 组合或某次会话的动态插件。

## 目录

| 插件 | 目录 | 状态 | 说明 |
| --- | --- | --- | --- |
| 长任务结束提醒 | `long-task-reminder/` | ✅ 可用 | 长任务结束 / 需要交互时通过飞书自定义机器人 webhook 推送通知 |

## 快速开始（以 long-task-reminder 为例）

1. 在飞书群里添加「自定义机器人」，复制生成的 webhook URL。
2. 打开 Web GUI 的**插件配置**页，在 `long-task-reminder` 一节把 webhook 填入
   `feishuWebhook` 字段，保存即**实时生效**（无需重启）。
   （旧版 `config.json` 首次启动会自动迁移进 Web UI 设置。）

3. 两种挂载方式任选其一：

   - **动态插件**（当前会话临时生效，改代码即测）：参考各插件 README 中的
     「动态挂载」一节，把 `src/plugin.js` 的 `apply` 主体内联到
     `cordis_define` 的 `code.host` 里，然后 `cordis_run`。
   - **Host 组合**（持久生效、进程级）：把 `cordis.example.yml` 里的行合并进
     Host 组合的 `cordis.yml`（需要先把插件源码提升为 harness 包，见下方说明）。

4. 未配置 webhook 时插件自动进入 **dry-run**：事件触发后只在日志打印
   「本应发送的通知」，方便先验证链路再接真实 webhook。

## 持久化接入（Web profile，推荐，已配置）

动态插件随 DSH 进程重启而失效（进程级、临时）。要让提醒**长期生效**，把插件挂进
Web profile（`~/.dsh/profiles/web`），已按 `dsh-image-relay` 的本地插件先例配好：

1. `~/.dsh/profiles/web/package.json` 增加本地依赖（直接引用本项目，单一源码/配置源）：
   `"dsh-plugin-long-task-reminder": "file:/Users/caozeal/projects/dsh-plugins/long-task-reminder"`
2. `cd ~/.dsh/profiles/web && pnpm install`（已执行，node_modules 已链接）
3. `~/.dsh/profiles/web/cordis.patch.yml` 增加补丁行（已加）：
   ```yaml
   - insert:
       - id: long-task-reminder
         name: 'dsh-plugin-long-task-reminder'
   ```
4. `dsh_ctl restart` 重启 Web GUI 生效（重启会短暂刷新页面，会话数据保留）。

插件配置在 Web GUI 的插件配置页管理（settings 命名空间 `long-task-reminder`），
持久化到 `settings.yaml`，改动**实时生效**、无需重启。旧 `config.json` 仅作
一次性迁移来源。

## 插件从「独立目录」提升为「harness 包」的路径

独立目录便于快速迭代；一旦要持久挂在 Host 组合里，标准做法是把它移植进
deepseek-harness 的 `packages/` workspace 成为 `@deepseek-ai/dsh-*` 包，
再在组合里加一行（参考 `dsh-lab/ui-schedule-integration.patch` 的做法：
新增包 + `cordis.patch.yml` 加行 + `package.json`/`tsconfig`/`pnpm-lock` 同步）。

## 约定

- 插件源码用**纯 ESM JavaScript + JSDoc**（零构建、可直接内联进动态插件；
  提升为 harness 包时再移植成 TypeScript）。
- 运行期配置走 Web GUI 插件配置页（settings 服务，持久化到 `settings.yaml`）；
  各插件目录的 `config.json` 仅作旧版/开发兜底。
- 每个插件至少带一个 dry-run 自测脚本（`test/`），不依赖真实 webhook。
