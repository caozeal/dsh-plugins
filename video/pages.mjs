// 生成宣传片播放页：把 video/out/*.mp4 引用成相对路径，
// 由 .github/workflows/pages.yml 一起发到 GitHub Pages。
//
// 这里刻意不用模板引擎：输出是一段静态 HTML，任何 FFmpeg/渲染变化都不用改这个脚本。
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = process.argv[2] || 'site';
const VIDEO_DIR = 'video/out';

const CLIPS = [
  {
    file: 'dsh-next-git-promo-mockup.mp4',
    title: 'dsh-next-git 介绍片',
    note: '38 秒 · 1080p60 · 全片为渲染的界面示意，不含真实会话',
    primary: true,
  },
  {
    file: 'dsh-next-git-promo-silent.mp4',
    title: '无音轨版',
    note: '方便自行配音或当无声素材',
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function card(c) {
  const src = `${VIDEO_DIR}/${c.file}`;
  // 成片是在 CI 里用 video/frames 现场合成的；frames 没入库时文件不存在，
  // 这时不要渲染一个必然 404 的 <video>，而是明确说明去哪拿。
  const exists = fs.existsSync(path.join(OUT_DIR, src));
  if (!exists) {
    return `
    <section class="card${c.primary ? ' primary' : ''}">
      <h2>${esc(c.title)}</h2>
      <p class="note">${esc(c.note)}</p>
      <p class="missing">
        本页构建时没有合成视频（<code>video/frames</code> 未入库，需要本地跑
        <code>video/render.sh</code> 后推送）。上面的 Demo 不受影响，可以直接玩。<br />
        想看片：<a href="https://github.com/caozeal/dsh-plugins/releases">GitHub Releases</a>。
      </p>
    </section>`;
  }
  return `
    <section class="card${c.primary ? ' primary' : ''}">
      <h2>${esc(c.title)}</h2>
      <p class="note">${esc(c.note)}</p>
      <video controls preload="metadata" playsinline poster="poster.png" width="100%">
        <source src="${esc(src)}" type="video/mp4" />
        你的浏览器不支持 video 标签，<a href="${esc(src)}">点此下载</a>。
      </video>
      <p class="meta">${esc(c.file)} · <a href="${esc(src)}" download>下载原片</a></p>
    </section>`;
}

const DEMO_CSS = `
    .cta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
    .btn {
      display: inline-block; padding: 10px 20px; border-radius: 9px;
      background: #4d6bfe; color: #fff !important; font-weight: 600;
      text-decoration: none !important; font-size: 14px;
    }
    .btn:hover { background: #2f49d6; }
    .cta-note { font-size: 13px; color: #8a9099; }
    .missing {
      padding: 16px 18px; border-radius: 10px; font-size: 13px; line-height: 1.8;
      background: rgba(79,124,255,.08); border: 1px dashed rgba(79,124,255,.4);
      color: var(--dim);
    }
    .missing a { color: var(--accent); }
  `;

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>dsh-next-git 宣传片</title>
<meta name="description" content="DeepSeek Harness 侧栏 Git 管理插件 dsh-next-git 的 38 秒介绍片" />
<style>
  ${DEMO_CSS}
  :root {
    --bg: #050d24; --panel: #0d1733; --line: #21325c;
    --fg: #e7efff; --dim: #93a9cf; --accent: #4f7cff;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background:
      radial-gradient(120% 80% at 50% 0%, #0d1b45 0%, var(--bg) 60%, #02060f 100%);
    color: var(--fg); min-height: 100vh;
    font-family: "PingFang SC", "Hiragino Sans GB", -apple-system, "Helvetica Neue", sans-serif;
  }
  .wrap { max-width: 980px; margin: 0 auto; padding: 56px 24px 96px; }
  header { text-align: center; margin-bottom: 44px; }
  h1 { font-size: 40px; margin: 0 0 12px; letter-spacing: -.02em; }
  header p { color: var(--dim); margin: 0; font-size: 17px; line-height: 1.7; }
  header a { color: #8fd0ff; }
  .card {
    background: var(--panel); border: 1px solid var(--line); border-radius: 18px;
    padding: 22px; margin-bottom: 22px;
  }
  .card.primary { border-color: #3358e8; box-shadow: 0 18px 50px rgba(43, 88, 232, .18); }
  .card h2 { font-size: 20px; margin: 0 0 6px; }
  .card .note { color: var(--dim); font-size: 14px; margin: 0 0 16px; }
  .card video { display: block; width: 100%; border-radius: 12px; background: #000; }
  .card .meta { color: #6f86ad; font-size: 13px; margin: 12px 0 0; }
  .card .meta a { color: #8fd0ff; }
  footer { text-align: center; color: #5c739a; font-size: 13px; margin-top: 40px; line-height: 1.9; }
  footer a { color: #8fd0ff; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>dsh-next-git</h1>
      <p>
        把 Git 搬进 DeepSeek Harness 的会话侧栏 —— 分支、暂存、提交、推送、提交图、diff，<br />
        外加 AI 写的 Conventional Commits 提交信息。<br />
        <a href="https://github.com/caozeal/dsh-plugins">源码</a> ·
        <a href="https://www.npmjs.com/package/@caozeal/dsh-next-git">npm</a> ·
        <code>dsh plugin --profile web add @caozeal/dsh-next-git</code>
      </p>
      <p class="cta">
        <a class="btn" href="./dsh-next-git/demo/">打开在线 Demo →</a>
        <span class="cta-note">真实面板代码 + 真实仓库快照，可以直接点</span>
      </p>
    </header>
    ${CLIPS.map(card).join('\n')}
    <footer>
      片中的界面为渲染的示意，不含真实会话内容。<br />
      MIT License · 由 <a href="https://github.com/caozeal/dsh-plugins">caozeal/dsh-plugins</a> 构建
    </footer>
  </div>
</body>
</html>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);

// 把在线 Demo 一起打进站点。
// Demo 按 ../lib/client.js 引用真实插件代码，所以要保持 dsh-next-git/{demo,lib} 的
// 相对层级。放在这里而不是只写在 CI 里，是为了「本地生成 → 手工上传 Cloudflare」
// 这条既有发布路径也能一并带上 Demo，不必记两套命令。
const DEMO_SRC = 'dsh-next-git/demo';
const CLIENT_SRC = 'dsh-next-git/lib/client.js';
const DEMO_DEST = path.join(OUT_DIR, 'dsh-next-git', 'demo');
const LIB_DEST = path.join(OUT_DIR, 'dsh-next-git', 'lib');

if (fs.existsSync(DEMO_SRC) && fs.existsSync(CLIENT_SRC)) {
  fs.cpSync(DEMO_SRC, DEMO_DEST, { recursive: true });
  fs.mkdirSync(LIB_DEST, { recursive: true });
  fs.copyFileSync(CLIENT_SRC, path.join(LIB_DEST, 'client.js'));
  console.log(`bundled demo -> ${DEMO_DEST}`);
} else {
  console.warn('跳过 Demo：找不到 dsh-next-git/demo 或 lib/client.js');
}

// 海报：沿用仓库里的片头帧，Pages 站点根目录放一份
const poster = 'video/docs/poster-title.png';
if (fs.existsSync(poster)) {
  fs.copyFileSync(poster, path.join(OUT_DIR, 'poster.png'));
} else {
  console.warn('warning: poster not found, video 元素会退回黑底');
}

// .nojekyll：避免 Pages 用 Jekyll 处理，也能保证二进制文件不被过滤
fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');

const total = CLIPS.reduce((acc, c) => {
  const p = path.join(VIDEO_DIR, c.file);
  return acc + (fs.existsSync(p) ? fs.statSync(p).size : 0);
}, 0);
console.log(`built ${OUT_DIR}/index.html (${CLIPS.length} clips, ${(total / 1048576).toFixed(1)} MB video referenced)`);