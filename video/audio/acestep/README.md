# ACE-Step 生成的配乐（在 mini 上跑 ComfyUI）

BGM 由 **mini 上的 ComfyUI + ACE-Step 1.5 turbo (AIO)** 生成，再按分镜配速后混入成片。

## 环境（⚠️ 在 mini，不在本机）

- ComfyUI：`caozhiyong@mini:~/ComfyUI-Installs/ComfyUI/ComfyUI`，`.venv` 里跑
- 权重：`/Volumes/mac/ComfyUI-Shared/models/checkpoints/ace_step_1.5_turbo_aio.safetensors`（10 GB）
- 启动（后端默认没在跑，必须先拉起）：

```bash
ssh mini 'cd ~/ComfyUI-Installs/ComfyUI/ComfyUI && nohup ./.venv/bin/python3 -s main.py \
  --gpu-only --disable-auto-launch --port 8188 \
  --extra-model-paths-config "$HOME/Library/Application Support/Comfy Desktop/instance-model-paths/inst-1790753181021.yaml" \
  > /tmp/comfy_ace.log 2>&1 &'
# 轮询到 200 即可用
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8188/   # 在 mini 上
```

## 生成

工作流：`CheckpointLoaderSimple → ModelSamplingAuraFlow(shift=3) → TextEncodeAceStepAudio1.5
+ ConditioningZeroOut → EmptyAceStep1.5LatentAudio → KSampler(8 steps, euler/simple, cfg=1)
→ VAEDecodeAudio → SaveAudio`。

```bash
scp audio/acestep_gen.py mini:/tmp/
ssh mini 'cd /tmp && python3 acestep_gen.py <name> "<tags>" <秒> [seed] [bpm] [key-scale]'
# 产物：mini:~/ComfyUI-Installs/ComfyUI/ComfyUI/output/ace_<name>_00001.flac
```

实测 40 秒片约 10–30 秒出（并行跑 3 条也无压力）。

## 配到分镜上

```bash
python3 audio/acestep_fit.py audio/acestep/candA.flac audio/acestep/bgm-ace.wav
```

- ACE 按 110 BPM 出片（1 小节 2181.8 ms），片子按 2.5 s/小节剪 → `atempo=0.8727`
  把整首拉到 **96 BPM / 2.5 s 一小节**，节奏与画面切换对齐
- 两遍 loudnorm（先测后压）：目标 −14 LUFS / 真峰 −2.5 dBTP，mux 成 AAC 后实测
  **−14.7 LUFS / −1.0 dBFS**，与合成版（−15.3 LUFS）基本同响度，便于 A/B

## 试听（4 个候选 + 1 个合成参考，均已统一到 −15 LUFS）

| 文件 | 风格参数 |
| --- | --- |
| `listen/core-A-electronic-pop.mp3` | 110 bpm, D, 明亮电子流行（原始 `test1.flac`） |
| `listen/core-B-tech-promo.mp3` | 110 bpm, D, tech-promo（`candA.flac`，**成片 `-ace` 版用的就是它**） |
| `listen/core-C-minimal-corporate.mp3` | 100 bpm, G, 极简企业风钢琴+pad |
| `listen/core-D-future-bass.mp3` | 120 bpm, Am, future bass / chiptune 感 |
| `listen/core-Z-synthesised-reference.mp3` | 程序化合成版（无模型），作对照 |

## 已知差异（量化部分）

- ACE 原始输出**已经过响度压缩**（−10.5 ~ −12.8 LUFS，真峰 +0.2 ~ +1.4 dBFS 即已削波），
  所以它比程序化版“更响更满、动态更小”（LRA ≈ 4.5 LU vs 5.7 LU），也更像短视频成品；
  程序化版层次更干净但更“素”。
- 两版都是**纯器乐、无人声**。
