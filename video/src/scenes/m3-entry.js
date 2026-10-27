import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';
import { PANEL_CSS, PanelHead, PanelBar, Tabs, Status, CommitBox, FileRow } from '../core/ui.js';

// 03 — 入口：会话头部 Git 图标 / 右栏 + → 开始 → Git 管理
export const CSS = `
${PANEL_CSS}
.m3-left { position:absolute; left: 110px; top: 210px; width: 660px; }
.m3-left h2 { margin:0; font-size: 66px; font-weight:800; letter-spacing:-.02em; }
.m3-left h2 span { color:#7fb0ff; }
.m3-left p { margin: 20px 0 0; font-size: 26px; color:#9fb4d8; line-height:1.7; }

.m3-chat { position:absolute; left: 830px; top: 116px; width: 980px; height: 850px; border-radius: 22px; overflow:hidden;
  background:#fff; box-shadow: 0 40px 110px rgba(3,12,40,.62); color:#1b2340; }
.m3-top { height: 66px; display:flex; align-items:center; gap: 12px; padding: 0 22px; border-bottom:1px solid #eef2fa; }
.m3-brand { display:flex; align-items:center; gap:10px; font-weight:800; font-size:19px; letter-spacing:-.01em; }
.m3-brand .logo { width: 26px; height:26px; border-radius:8px; background: linear-gradient(135deg,#2b4fe0,#4f7cff); }
.m3-brand .tag { font-size: 11px; font-weight:800; letter-spacing:.08em; color:#fff; background:#0f172a; padding:3px 8px; border-radius:6px; }
.m3-utils { margin-left:auto; display:flex; align-items:center; gap: 8px; }
.m3-util { width: 34px; height: 34px; border-radius: 10px; display:grid; place-items:center; color:#5b6b8c; background:#f5f8ff; border:1px solid #e6ecf8; }
.m3-util.git { background: linear-gradient(140deg,#e8f0ff,#dbe7ff); border-color:#c9dbff; }
.m3-util.git img { width: 22px; height:22px; }
.m3-main { display:flex; height: 784px; }
.m3-conv { flex:1; padding: 26px 28px; display:flex; flex-direction:column; gap: 16px; background: linear-gradient(180deg,#fbfcff,#f7f9ff); }
.m3-bubble { border-radius: 16px; padding: 16px 18px; font-size: 19px; line-height:1.6; }
.m3-bubble.u { align-self:flex-end; background: linear-gradient(135deg,#e8f0ff,#dce8ff); color:#1e3a8a; max-width: 78%; }
.m3-bubble.a { background:#fff; border:1px solid #eaeff9; color:#2c3853; box-shadow: 0 8px 24px rgba(30,58,138,.06); }
.m3-lines i { display:block; height: 9px; border-radius: 5px; background:#eef2fa; margin-top: 9px; }
.m3-lines i:nth-child(1) { width: 86%; } .m3-lines i:nth-child(2) { width: 72%; } .m3-lines i:nth-child(3) { width: 91%; }
.m3-lines i:nth-child(4) { width: 48%; }
.m3-panel { width: 388px; border-left:1px solid #eef2fa; display:flex; flex-direction:column; background:#fff; }
.m3-panel .gm-body { flex:none; }
.m3-zoom { position:absolute; left: 1736px; top: 122px; width: 64px; }
.m3-zoom .box { width: 64px; height: 54px; border-radius: 14px; border: 3px solid #6ea8ff; box-shadow: 0 0 0 6px rgba(110,168,255,.18); }
.m3-callout { position:absolute; left: 110px; top: 560px; display:flex; align-items:center; gap: 12px; font-size: 21px; color:#cfe2ff; }
.m3-callout .line { width: 74px; height:2px; background: linear-gradient(90deg, #8fd0ff, rgba(140,180,255,0)); }
.m3-chips { display:flex; gap:12px; margin-top: 34px; flex-wrap: wrap; }
.m3-chip { font-size: 19px; color:#c7dbfa; padding: 9px 16px; border-radius: 12px; background: rgba(60,110,220,.16); border:1px solid rgba(110,160,255,.3); }
`;

export function Scene() {
  return (
    <div class="scene m3">
      <Stage variant="deep" />
      <div class="m3-left">
        <h2 style={pop({ at: 0.12, dur: 0.8, from: 'translateX(-30px)' })}>
          一个图标，<br /><span>就在会话里打开</span>
        </h2>
        <p style={pop({ at: 0.34, dur: 0.8 })}>
          会话头部的 <b style={{ color: '#dbe8ff' }}>Git 图标</b> 一点即开，自动展开右侧栏；
          也可以在 <span class="kbd">+</span> → 开始 里选「Git 管理」。
        </p>
      </div>

      <div class="m3-chat" style={pop({ at: 0.2, dur: 1, from: 'translateY(60px) scale(.95)' })}>
        <div class="m3-top">
          <span class="m3-brand"><span class="logo" />deepseek <span class="tag">HARNESS</span></span>
          <span class="m3-utils">
            <span class="m3-util git" style={{ transform: 'scale(1.06)' }}><img src="assets/whale.png" /></span>
            <span class="m3-util">◫</span>
            <span class="m3-util">⚙</span>
          </span>
        </div>
        <div class="m3-main">
          <div class="m3-conv">
            <div class="m3-bubble u" style={pop({ at: 0.5, dur: 0.6, from: 'translateY(16px)' })}>帮我把这次改动提交一下</div>
            <div class="m3-bubble a" style={pop({ at: 0.66, dur: 0.6, from: 'translateY(16px)' })}>
              好，改完的 3 个文件已经在侧栏里了
              <div class="m3-lines"><i /><i /><i /><i /></div>
            </div>
            <div class="m3-bubble a" style={pop({ at: 0.82, dur: 0.6, from: 'translateY(16px)' })}>
              要我顺手生成提交信息吗？
              <div class="m3-lines"><i /><i /></div>
            </div>
          </div>
          <div class="m3-panel" style={pop({ at: 0.42, dur: 0.85, from: 'translateX(40px)' })}>
            <PanelHead />
            <PanelBar />
            <Tabs active="changes" />
            <div class="gm-body">
              <Status text="就绪" />
              <FileRow kind="mod" path="src/client.js" />
              <FileRow kind="mod" path="src/git.js" />
              <FileRow kind="mod" path="README.md" />
            </div>
            <CommitBox />
          </div>
        </div>
      </div>
      <div class="m3-zoom" style={pop({ at: 1.1, dur: 0.7, from: 'scale(.6)' })}>
        <div class="box" />
      </div>
      <div class="m3-callout" style={pop({ at: 1.35, dur: 0.7, from: 'translateX(18px)' })}>
        <span class="line" />入口就在头部工具栏
      </div>
    </div>
  );
}
