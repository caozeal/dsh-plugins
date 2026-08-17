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
3. 写入本目录 `config.json`（从 `config.example.json` 复制）：

   ```json
   { "feishuWebhook": "https://open.feishu.cn/open-apis/bot/v2/hook/<你的token>" }
   ```

webhook 留空时插件自动 **dry-run**：事件触发只打日志、不发送，方便先验证链路。

## 2. 挂载方式（二选一）

### A. 动态插件（当前会话临时生效，改代码即测，推荐开发期用）

以 Cordis 动态插件方式挂到当前会话。把 `src/plugin.js` 的 `apply` 主体（去掉
`import`）内联进 `cordis_define` 的 `code.host`，然后 `cordis_run`。插件会从
本目录 `config.json` 读取配置；未配置 webhook 时进入 dry-run。

### B. Host 组合（持久生效、进程级，推荐正式用）

需要先把插件源码提升为 harness 包（`@deepseek-ai/dsh-*`）并在 Host 组合加一行，
参考项目根 README「提升为 harness 包」与 `cordis.example.yml`。提升后可在
`config` 块直接写 webhook，不再读 `config.json`。

## 3. 验证

```sh
npm test   # 跑 dry-run 自测：文案构造 + 发送链路（不碰网络）
```

## 目录结构

```
long-task-reminder/
├── README.md              # 本文件
├── package.json
├── config.example.json    # 配置模板
├── config.json            # 实际配置（gitignore，含 webhook）
├── cordis.example.yml     # Host 组合挂载示例
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
- 提升为 harness 包时，配置优先走组合 `config` 块，`config.json` 只作开发兜底。
