# dsh-next-git 宣传片（video/）

给 [`@caozeal/dsh-next-git`](../dsh-next-git/README.md) 做的 38 秒产品宣传片：H.264 / 1920×1080 / 60fps，
带配乐与音效（AAC 192k）。

**定稿**：`out/dsh-next-git-promo.mp4` —— mini 的 ComfyUI + ACE-Step 1.5 生成配乐，
−14.7 LUFS / 真峰 −1.0 dBFS。两个备选（同画面，仅换音轨）：

| 文件 | 配乐 | 响度 |
| --- | --- | --- |
| `out/dsh-next-git-promo.mp4` | **ACE-Step 生成** ← 定稿 | −14.7 LUFS / −1.0 dBFS |
| `out/dsh-next-git-promo-synth.mp4` | 程序化合成（numpy/scipy 硬编码音效点） | −15.3 LUFS / −1.5 dBFS |
| `out/dsh-next-git-promo-silent.mp4` | 无音轨，方便另外配音 | — |

ACE-Step 那条见 [`audio/acestep/README.md`](audio/acestep/README.md)（含 4 个候选的试听
文件与生成/配速命令）。

`out/`、`audio/*.wav`、`audio/acestep/*.flac` 都在 `.gitignore` 里（都能本地重新生成，
成片改一版就翻倍，不适合进 git）。进仓库的是：渲染器源码 `src/`、素材 `assets/`、
预览帧 `docs/`、配乐脚本，以及 `audio/acestep/listen/` 那 5 个候选试听 mp3（每个约 0.9 MB，
本来就为试听而存在）。成片要分发时放 GitHub Release 附件。

![标题](docs/poster-title.png)

| 帧 | 内容 |
| --- | --- |
| ![标题](docs/poster-title.png) | 片头：插件图标 + 一句话价值主张 + 安装命令 |
| ![分支](docs/frame-branches.png) | 分支切换（真机截图 + 高亮） |
| ![AI 提交信息](docs/frame-ai-commit.png) | AI 生成 Conventional Commits 提交信息 |
| ![提交图](docs/frame-graph.png) | SVG lane 提交图 |
| ![片尾](docs/poster-end.png) | 三步安装 + npm / GitHub / MIT |

## 分镜

| # | 时长 | 画面 | 要点 |
| --- | --- | --- | --- |
| 01 | 4.6s | 片头 | 「把 Git 搬进会话侧栏，让 AI 帮你写提交信息」 |
| 02 | 4.6s | 痛点对比 | 终端 5 步来回切窗口 → 侧栏 5 步不离开会话 |
| 03 | 4.2s | 入口 | 会话头部 Git 图标 / 右栏「+ → 开始」→ Git 管理 |
| 04 | 3.4s | 面板总览 | 真机截图 + 三块卖点 |
| 05 | 3.0s | 分支 | 本地/远程分支、ahead/behind、跟踪分支 |
| 06 | 3.0s | 变更 | staged / unstaged / untracked / conflicted 四组 |
| 07 | 3.0s | Diff | hunk 逐行渲染、旧新行号、增删配色 |
| 08 | 4.4s | AI 提交信息 | diff + 历史风格 → 一行 subject，可编辑，降级兜底 |
| 09 | 4.0s | 提交图 | SVG lane、分支标签、点击看该 commit 的 diff |
| 10 | 3.6s | 细节 | 鲸鱼娘空态、右栏指南入口、失败可见、全屏、zh/en |
| 11 | 4.2s | 收尾 | 3 步安装 + 安装命令 + 仓库链接 |

## 怎么改再渲染

渲染器是一套「无构建依赖」的 CSS/SVG 动效页面：`bun` 把 `.jsx`（classic runtime，JSX → `h()`）
转成浏览器模块，Chrome 渲染，`agent-browser` 逐帧 seek 截图，`ffmpeg` 合成 60fps 视频。

```bash
cd video
./render.sh            # 全流程：构建 → 起服务 → 逐帧截图 → ffmpeg 出 out/dsh-next-git-promo.mp4
```

- 需要：`bun`、`ffmpeg`、`agent-browser`（`npm i -g agent-browser && agent-browser install`）。
- 配乐两条路线都要跑：`audio/acestep_fit.py`（默认，即定稿音轨）与
  `audio/synth.py`（程序化合成，见 [`audio/README.md`](audio/README.md)）。ACE-Step 需要
  mini 上的 ComfyUI，步骤见 [`audio/acestep/README.md`](audio/acestep/README.md)；scripted
  那条的音效点是硬编码的，改分镜时要同步改。
- 逐帧截图放在 `/tmp/dsh-next-git-promo-frames`（可用 `FRAMES_DIR` 改），约 1100 张 PNG / 400MB。
- 时间轴在 [`src/core/timeline.js`](src/core/timeline.js)：`dur` 是场景自身动画时长，`slot` 是它在
  成片里占的时长（渲染器用动画 playbackRate 拉伸），`XFADE` 是交叉淡入时长。
- 只重编码（帧已缓存）：`FRAMES_DIR=/tmp/dsh-next-git-promo-frames node encode.mjs`
- 单场景预览：`node server.mjs` 后打开 `http://127.0.0.1:8899/?capture=1&t=12.5`（拖进度条的
  非 capture 模式也支持，点画面播放）。
- 视觉：`src/core/engine.js`（基础样式、pop 入场 helper），`src/core/stage.js`（背景/光晕/网格），
  `src/core/ui.js`（面板 UI 的 CSS mock，配色对齐 DeepSeek 蓝 `#3b6bff`）。

## 素材

`assets/` 全部来自仓库自身，没有外部版权素材：

- `icon.png`：插件图标（`dsh-next-git/icon.png`）
- `whale.png`：小鲸鱼贴纸（从 `lib/client.js` 的 `WHALE_IMG` 抽出并放大）
- `shot-*.png`：`dsh-next-git/test/live/artifacts/` 里的真机验证截图（已打码）

因为截图里有打码区，画面用「白色卡片 + 侧栏内容」的构图，把打码区留在视觉边缘。
