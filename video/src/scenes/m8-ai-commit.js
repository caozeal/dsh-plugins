import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';
import { PANEL_CSS, MOCK_CSS, MockPanel, ChangeList } from '../core/ui.js';

// 07 — AI 提交信息（逐字打字 + mock 面板佐证）
export const CSS = `
${PANEL_CSS}
${MOCK_CSS}
.m8-left { position:absolute; left: 120px; top: 210px; width: 760px; }
.m8-left h2 { margin:0; font-size: 62px; font-weight:800; letter-spacing:-.02em; line-height:1.14; }
.m8-left h2 span { color:#8fd0ff; }
.m8-left p { margin: 20px 0 0; font-size: 23px; color:#a4bade; line-height:1.7; }
.m8-flow { display:flex; align-items:center; gap: 9px; margin-top: 30px; flex-wrap: wrap; }
.m8-step { font-size: 18px; color:#cfe0ff; padding: 10px 14px; border-radius: 12px;
  background: rgba(40,80,170,.26); border:1px solid rgba(110,160,255,.28); white-space:nowrap; }
.m8-flow .ar { color:#6f92d6; font-size: 18px; }

.m8-card { position:absolute; left: 940px; top: 150px; width: 780px; }
.m8-ai { border-radius: 18px; border:1px solid rgba(140,180,255,.32); background: rgba(14,30,66,.78); overflow:hidden;
  box-shadow: 0 40px 100px rgba(2,10,34,.62); backdrop-filter: blur(8px); }
.m8-hint { display:flex; align-items:center; gap: 8px; padding: 15px 18px; font-size: 17px; color:#93aacd; border-bottom:1px solid rgba(120,160,255,.16); }
.m8-hint b { color:#8fd0ff; }
.m8-ta { padding: 22px 20px 26px; font: 500 25px "SF Mono","Maple Mono NF CN",Menlo,monospace; color:#eaf2ff; min-height: 92px; }
.m8-caret { display:inline-block; width: 2px; height: 26px; background:#8fd0ff; vertical-align: -5px; animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0 } }
.m8-bar { display:flex; align-items:center; gap: 10px; padding: 13px 18px; background: rgba(8,18,42,.6); border-top:1px solid rgba(120,160,255,.16); }
.m8-chip { font-size: 15px; font-weight:700; padding: 5px 11px; border-radius: 8px; background: rgba(90,140,255,.2); color:#bcd6ff; }
.m8-spacer { margin-left:auto; }
.m8-btn { font-size: 16px; font-weight:700; padding: 9px 18px; border-radius: 10px; color:#fff;
  background: linear-gradient(135deg,#4f7cff,#3358e8); box-shadow: 0 8px 18px rgba(51,88,232,.34); }
.m8-note { margin-top: 14px; font-size: 17px; color:#8ba0c2; }
.m8-note b { color:#8fd0ff; }
.m8-shot { position:absolute; left: 900px; top: 505px; width: 880px; height: 440px; border-radius: 18px;
  background:#f2f6fd; padding: 12px; box-shadow: 0 30px 70px rgba(2,10,34,.6), 0 0 0 1px rgba(150,190,255,.26); }
.m8-shot .cap { position:absolute; left: 14px; bottom: 6px; font-size: 14px; color:#8ea3c4; }
`;

export const MEDIA_CSS = `
@keyframes typeIn { from { width: 0 } to { width: var(--len) } }
.typing {
  display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom;
  width: var(--len); border-right: 0;
}
`;

const MSG = 'feat(diff): 支持 hunk 逐行高亮与行号并列';

export function Scene() {
  const chars = Array.from(MSG).length;
  const rate = 16; // chars per second on the authoring timeline
  const start = 0.55;
  const dur = fmt(chars / rate / RATE_NUM);
  const delay = fmt(start / RATE_NUM);
  return (
    <div class="scene m8">
      <Stage variant="deep" />
      <div class="m8-left">
        <h2 style={pop({ at: 0.1, dur: 0.8, from: 'translateX(-30px)' })}>
          提交信息，<br /><span>交给 AI 写</span>
        </h2>
        <p style={pop({ at: 0.3, dur: 0.8 })}>
          读取已暂存 diff 与仓库最近的提交风格，生成一行符合 Conventional Commits 的 subject，填进输入框等你确认。
        </p>
        <div class="m8-flow">
          <span class="m8-step" style={pop({ at: 0.5, dur: 0.6 })}>已暂存 diff</span>
          <span class="ar" style={pop({ at: 0.57, dur: 0.5 })}>+</span>
          <span class="m8-step" style={pop({ at: 0.62, dur: 0.6 })}>最近提交风格</span>
          <span class="ar" style={pop({ at: 0.69, dur: 0.5 })}>→</span>
          <span class="m8-step" style={{ ...pop({ at: 0.74, dur: 0.6 }), borderColor: '#7fb6ff', color: '#fff' }}>当前默认模型</span>
        </div>
      </div>

      <div class="m8-card">
        <div class="m8-ai" style={pop({ at: 0.25, dur: 0.9, from: 'translateY(46px) scale(.96)' })}>
          <div class="m8-hint"><b>✦</b> AI 已根据 3 个已暂存文件生成</div>
          <div class="m8-ta">
            <span class="typing" style={{ '--len': `${chars}ch`, animation: `typeIn ${dur}s steps(${chars}, end) ${delay}s both` }}>{MSG}</span>
            <span class="m8-caret" />
          </div>
          <div class="m8-bar">
            <span class="m8-chip">Conventional Commits</span>
            <span class="m8-chip">防截断校验</span>
            <span class="m8-spacer" />
            <span class="m8-btn">⌘↵ 提交</span>
          </div>
        </div>
        <div class="m8-note" style={pop({ at: 1.75, dur: 0.7 })}>
          模型不可用？自动降级为 <b>chore: 更新 N 个文件</b>，从不挡你提交
        </div>
      </div>

      <div class="m8-shot" style={pop({ at: 1.3, dur: 0.85, from: 'translateY(44px)' })}>
        <MockPanel active="changes" counts={{ changes: 3 }} body={<ChangeList />} commitValue={MSG} />
        <span class="cap">提交信息框已填好，等你确认</span>
      </div>
    </div>
  );
}

// Scene rate is injected by the renderer as a global before the module is
// imported; pop()/s() already handle it, the raw keyframes above need it too.
let RATE_NUM = 1;
export function setSceneRate(r) {
  RATE_NUM = r;
}
function fmt(v) {
  return v.toFixed(4);
}
