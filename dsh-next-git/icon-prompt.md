# 图标 / 形象生成记录

用 `custom-imagine` 生图技能（packy 网关，`gpt-image-2.5-sunburst`，1024×1024）生成，
参考社区 DeepSeek「鲸鱼娘 / Whale-chan」形象（蓝色渐变长发、呆毛、鲸鳍耳、蓝眼睛、
抱着白饭碗）与 dsh-pet「蓝色大肥鱼」的 Q 版贴纸风格。

## 1. 半身像（面板空态用）

> Chibi anime app icon of Whale-chan, the DeepSeek whale girl mascot: a cute chubby girl
> with long gradient blue hair (deep blue to cyan), one ahoge cowlick, whale-fin shaped
> hair flaps over her ears, big shiny blue eyes, slightly puffy shy cheeks, holding a
> small white rice bowl with chopsticks. Flat vector anime style, clean thick outlines,
> soft cel shading, centered bust portrait, plain white background, high contrast,
> no text, square composition, readable at 32-64 px.

产出：白底 1024×1024 → ImageMagick 去白底（corner floodfill, fuzz 6%）→ 裁剪留白 →
224×224 WebP（质量 88，约 20 KB）内嵌进 `lib/client.js` 作为空态大图。

## 2. 头像特写（插件图标用）

> Simple chibi head portrait of a cute blue-haired whale girl mascot: huge shiny blue
> eyes, soft round face, long gradient deep-blue to cyan hair, one ahoge cowlick,
> whale-fin shaped hair flaps over the ears, tiny white whale hairclip, gentle playful
> smile, flat anime sticker style, clean thick dark-blue outlines, soft cel shading,
> centered, plain white background, no body, no hands, no text, high contrast, designed
> as a small app icon readable at 32 px.

产出：去白底 → 取脸部正方形裁切（240,235,790,785）→ 合成 DeepSeek 蓝圆角徽章
（512×512 PNG，`icon.png`）；再缩放 256×256，base64 内嵌为 `icon.svg`
（`<image href="data:image/png;base64,…">`，约 150 KB，满足 DSH 图标 ≤256 KiB、
svg/png 约束）。

## 3. 小鲸鱼图标（顶栏 / 提交卡片用）

> Simple flat vector sticker icon of a cute chubby blue whale, side view facing right,
> round fat body, big white belly, small tail fin on the left, tiny water spout with
> three droplets above, one big friendly eye, DeepSeek blue body with cyan gradient
> shading, thick dark-navy outline, flat cel shading, centered, plain white background,
> no text, no background elements, designed to stay readable at 16-32 px.

产出：去白底 → 裁剪 → 128×128 WebP（约 7 KB）内嵌为 `WHALE_IMG`，顶栏 28px 圆角
胶囊内放 22px、提交卡片 22px 内放 18px；矢量小鲸鱼已移除。

## 4. 落库文件

- `icon.svg`：DSH 插件管理页图标（`exports['./icon']`，`iconOf` 内联为 data URL）。
- `icon.png`：512px 源图，保留便于替换 / 重新出图。
- `lib/client.js`：`MASCOT_IMG`（224px WebP base64）用于面板空态与右栏指南页图标；
  `WHALE_IMG`（128px WebP base64）用于顶栏与提交卡片的小鲸鱼。
