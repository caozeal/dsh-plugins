# long-task-reminder — 长任务结束提醒插件

DSH 插件：长任务（以 **goal** 为代表的跨轮次长目标）结束、受阻、暂停，或需要你
授权/审批、执行出错时，通过**飞书自定义机器人 webhook** 推送通知。手机、电脑上
的飞书都会响，适合「任务挂后台跑、人走开」的场景。

## 触发条件

| 事件 | 触发时机 | 默认开关 | 通知示例 |
| --- | --- | --- | --- |
| `goal/changed` → complete | 长目标完成 | `notifyOnComplete: true` | ✅ 长任务已完成 |
| `goal/changed` → blocked | 长目标受阻，需你介入 | `notifyOnBlocked: true` | ⛔ 长任务受阻，需要处理（含原因） |
| `goal/changed` → paused | 长目标暂停，等你确认 | `notifyOnPaused: true` | ⏸️ 长任务已暂停 |
| `goal/changed` → create | 新长目标开始 | `notifyOnCreate: false` | 🚀 长任务已开始 |
| `approval/request` | 需要你授权/审批（如跑危险命令、升级沙箱） | `notifyOnApproval: true` | 🛂 需要你的授权/审批 |
| `agent/error` | 某轮/某步执行出错 | `notifyOnError: true` | ❌ 任务执行出错 |

> 说明：「长任务」在本插件的语境里指 DSH 的 **goal**（`create_goal` 建立、跨
> 自动轮次推进、最终 `complete`/`blocked`/`paused`）。它正是「挂起来跑、结束或
> 卡住时通知你」的最贴合模型。`approval/request` 与 `agent/error` 不限于 goal，
> 任何会话需要你交互/出错都会提醒。

## 1. 配置飞书

1. 在飞书群里 → 设置 → 群机器人 → 添加机器人 → **自定义机器人**。
2. 复制生成的 **Webhook 地址**（形如
   `https://open.feishu.cn/open-apis/bot/v2/hook/<token>`），可加自定义关键词。
3. 打开 Web GUI 的**插件配置**页，在 `long-task-reminder` 一节把 webhook 填入
   `feishuWebhook`，保存后**实时生效**（无需重启 Web）。

   配置项（settings 命名空间 `long-task-reminder`，持久化到 `settings.yaml`）：

   | 字段 | 默认 | 说明 |
   | --- | --- | --- |
   | `feishuWebhook` | 空 | 飞书自定义机器人 webhook；留空 → dry-run 只打日志 |
   | `notifyOnComplete` | true | goal 完成时通知 |
   | `notifyOnBlocked` | true | goal 受阻时通知 |
   | `notifyOnPaused` | true | goal 暂停时通知 |
   | `notifyOnCreate` | false | 新 goal 开始时通知 |
   | `notifyOnApproval` | true | 需要授权/审批时通知 |
   | `notifyOnError` | true | 执行出错时通知 |
   | `notifyTurnEnd` | true | 未建目标时，普通任务/回合结束是否提醒 |
   | `notifyTurnMinMs` | 60000 | 普通任务运行达到该时长（ms）才提醒，避免快速问答刷屏 |
   | `dryRun` | false | 全局 dry-run，只打日志不发送 |
   | `cooldownMs` | 15000 | 同一类通知的最小间隔（ms） |

webhook 留空时插件自动 **dry-run**：事件触发只打日志、不发送，方便先验证链路。

每条通知自动带上 **项目名**（会话工作目录 basename）与 **进度简短总结**（会话
最近一条助手消息文本，截断 200 字），让你不用打开 Web 就知道是哪个项目、干到哪了。

## 2. 挂载方式

### A. Web profile 持久接入（推荐，标准 bundle 安装）

插件自带 **bundle patch**（`cordis.patch.yml` + package.json 的 `dsh.bundle`），
用 `dsh plugin` 一条命令安装即可，**自动**把插件行并入 profile 组合、随 Web 启动
加载、重启不丢：

```sh
dsh plugin --profile web add link:/Users/caozeal/projects/dsh-plugins/long-task-reminder
```

- `link:` 让 pnpm 以**符号链接**安装（代码改动即时生效，无需重新 install）。
- 安装成功后 `dsh plugin` 自动把它写进 `dsh.profile.bundles`（bundle 层），
  插件的 `cordis.patch.yml` 在下次 Web 启动时自动插入 `long-task-reminder` 行；
  无需再手动改 `~/.dsh/profiles/web/cordis.patch.yml`。
- 完成后 `dsh_ctl restart` 生效。

配置在 Web GUI 的插件配置页（settings 命名空间 `long-task-reminder`）管理，
改动**实时生效**；旧 `config.json` 首次启动自动迁移进 Web UI 设置。

### B. 动态插件（当前会话临时生效，改代码即测，开发期用）

以 Cordis 动态插件方式挂到当前会话。把 `src/plugin.js` 的 `apply` 主体（去掉
`import`）内联进 `cordis_define` 的 `code.host`，然后 `cordis_run`。开发期版本
仍读本目录 `config.json`（未接 settings）。⚠️ 进程重启后失效，需重新挂载。

### C. Host 组合 / harness 包（正式发布用）

提升为 `@deepseek-ai/dsh-*` 包并加进 Host 组合，参考 `cordis.example.yml`。
提升后可在 `config` 块直接写 webhook，不再读 `config.json`。

## 3. 验证

```sh
npm test   # 跑 dry-run 自测：文案构造 + 发送链路（不碰网络）
```

## 目录结构

```
long-task-reminder/
├── README.md              # 本文件
├── package.json           # dsh.bundle（组合 patch）+ dsh.client（Web 配置卡片）
├── cordis.patch.yml       # bundle patch：把插件行并入 profile 组合
├── config.example.json    # 配置模板
├── config.json            # 旧版配置（gitignore；首次启动自动迁移到 Web UI 设置）
├── cordis.example.yml     # Host 组合挂载示例
├── lib/
│   └── client.js          # 浏览器 bundle：插件配置页的「长任务提醒」卡片
├── src/
│   ├── plugin.js          # Cordis 插件入口：事件监听 + 通知编排 + 冷却
│   ├── messages.js        # 事件 → 通知文案（纯函数）
│   └── notifier.js        # 飞书 webhook 发送（subprocess + curl，支持 dry-run）
└── test/
    └── dry-run.mjs        # 自测脚本
```

## 已知限制 / 后续方向

- 目前只发飞书 **text** 消息；`card`（富文本卡片）模式待加。
- 渠道抽象预留了 `sendFeishu(ctx, config, message)`，后续加 QQ/Server酱/Bark
  只需新增发送器并按 `config.channel` 分发。
- 冷却按「通知种类」限流（默认 15s）；如需按会话限流可再细化。
- 配置以 Web UI 插件配置页（settings）为准；`config.json` 仅作一次性迁移来源。
- 设置项改动通过 `scope.watch` 实时生效，无需重启。
