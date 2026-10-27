# 插件市场截图素材

`screenshots.json`（本目录上一级）里声明的 6 张图，供 dsh-market 等插件市场详情页展示。
它们由 `test/live/artifacts/` 里的真机验证截图加工而来，**都做过打码**。

| 文件 | 来源 | 处理 |
| --- | --- | --- |
| `01-changes.png` | `V19-style-changes.png` | 左栏 + 对话区（x < 708）高斯模糊 σ=28 |
| `02-commit-graph.png` | `V25-colored-graph-refs.png` | 同上 |
| `03-word-level-diff.png` | `V24-word-level-diff.png` | 同上 |
| `04-branches.png` | `V20-whale-branches.png` | 同上 |
| `05-graph-multibranch.png` | `V26-colored-graph-multibranch.png` | 纯提交图渲染，裁掉下方空白（1280×320） |
| `06-fullscreen.png` | `V18-right-tab-fullscreen.png` | 面板全屏，不含界面外内容，无需处理 |

重新生成（`ffmpeg`，需 `gblur` 滤镜）：

```sh
IN=test/live/artifacts
ffmpeg -i "$IN/V24-word-level-diff.png" -filter_complex \
  "[0:v]split[a][b];[b]crop=708:577:0:0,gblur=sigma=28[c];[a][c]overlay=0:0" \
  assets/screenshots/03-word-level-diff.png
```

换图时保持文件名不变，市场下次构建自动生效；增删条目改 `screenshots.json`，1–8 张。
