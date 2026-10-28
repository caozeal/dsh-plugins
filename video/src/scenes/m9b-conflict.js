import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';

// 10 — AI 解决冲突：三份版本 → 建议 → 确认落盘
export const CSS = `
.m9b-left { position:absolute; left: 110px; top: 205px; width: 720px; }
.m9b-left h2 { margin:0; font-size: 58px; font-weight:800; letter-spacing:-.02em; line-height:1.16; }
.m9b-left h2 span { color:#8fd0ff; }
.m9b-left p { margin: 20px 0 0; font-size: 21px; color:#a4bade; line-height:1.7; }
.m9b-flow { display:flex; align-items:center; gap: 8px; margin-top: 28px; flex-wrap: wrap; }
.m9b-step { font-size: 17px; color:#cfe0ff; padding: 9px 13px; border-radius: 11px;
  background: rgba(40,80,170,.26); border:1px solid rgba(110,160,255,.28); font-family:"SF Mono",Menlo,monospace; }
.m9b-step.on { background: linear-gradient(135deg,#4f7cff,#3358e8); border-color:#7fb6ff; color:#fff; font-weight:700; }
.m9b-flow .ar { color:#6f92d6; font-size: 17px; }

.m9b-card { position:absolute; left: 880px; top: 150px; width: 900px; border-radius: 18px; overflow:hidden;
  background: rgba(12,26,58,.86); border:1px solid rgba(140,180,255,.30);
  box-shadow: 0 42px 100px rgba(2,10,34,.66); backdrop-filter: blur(8px); }
.m9b-head { display:flex; align-items:center; gap:8px; padding: 14px 18px; border-bottom:1px solid rgba(120,160,255,.16);
  font-size: 16px; font-weight:700; color:#8fd0ff; }
.m9b-head .x { margin-left:auto; color:#7f93b5; font-size: 18px; }
.m9b-body { padding: 14px 18px 18px; display:flex; flex-direction:column; gap:10px; }
.m9b-path { font: 600 18px "SF Mono",Menlo,monospace; color:#eaf2ff; }
.m9b-note { font-size: 14.5px; color:#8ba0c2; }
.m9b-input { height: 40px; border-radius: 10px; border:1px solid rgba(120,160,255,.26);
  background: rgba(8,18,42,.6); color:#7488aa; font-size: 15px; display:flex; align-items:center; padding: 0 12px; }
.m9b-btns { display:flex; gap: 8px; flex-wrap: wrap; }
.m9b-btn { font-size: 15px; font-weight:600; padding: 7px 14px; border-radius: 9px;
  background: rgba(90,140,255,.18); border:1px solid rgba(120,160,255,.26); color:#bcd6ff; }
.m9b-btn.primary { background: linear-gradient(135deg,#4f7cff,#3358e8); border-color:#5b86ff; color:#fff;
  box-shadow: 0 8px 20px rgba(51,88,232,.36); }
.m9b-btn.ghost { background: transparent; color:#9fb0cd; }
.m9b-code { margin-top: 4px; border-radius: 12px; background: rgba(6,14,34,.72);
  border:1px solid rgba(120,160,255,.18); padding: 10px 0; }
.m9b-line { display:flex; gap: 14px; font: 15px/1.75 "SF Mono","Maple Mono NF CN",Menlo,monospace; padding: 0 14px; }
.m9b-line .no { width: 26px; text-align:right; color:#4f6488; flex:none; }
.m9b-line .tx { color:#cfe0ff; white-space:pre; }
.m9b-line.hl { background: rgba(34,197,94,.14); }
.m9b-line.hl .tx { color:#8df0b4; }
`;

const CODE = [
  { n: 1, t: '{' },
  { n: 2, t: '  "name": "demo",' },
  { n: 3, t: '  "version": "1.5.1",', hl: true },
  { n: 4, t: '  "deps": {' },
  { n: 5, t: '    "lib": "2.3.0"', hl: true },
  { n: 6, t: '  }' },
  { n: 7, t: '}' },
];

export function Scene() {
  return (
    <div class="scene m9b">
      <Stage variant="deep" />
      <div class="m9b-left">
        <h2 style={pop({ at: 0.1, dur: 0.8, from: 'translateX(-30px)' })}>
          冲突不是靠猜，<br /><span>AI 读三份版本</span>
        </h2>
        <p style={pop({ at: 0.3, dur: 0.8 })}>
          base / ours / theirs 三份内容交给模型，给出一份合并后的完整文件——只生成建议，确认后才写盘。
        </p>
        <div class="m9b-flow">
          <span class="m9b-step" style={pop({ at: 0.5, dur: 0.6 })}>base</span>
          <span class="ar" style={pop({ at: 0.56, dur: 0.5 })}>+</span>
          <span class="m9b-step" style={pop({ at: 0.62, dur: 0.6 })}>ours</span>
          <span class="ar" style={pop({ at: 0.68, dur: 0.5 })}>+</span>
          <span class="m9b-step" style={pop({ at: 0.74, dur: 0.6 })}>theirs</span>
          <span class="ar" style={pop({ at: 0.80, dur: 0.5 })}>→</span>
          <span class="m9b-step on" style={pop({ at: 0.88, dur: 0.6 })}>合并结果</span>
        </div>
      </div>

      <div class="m9b-card" style={pop({ at: 0.12, dur: 0.95, from: 'translateY(46px) scale(.96)' })}>
        <div class="m9b-head"><span>✦</span><span>冲突解决</span><span class="x">×</span></div>
        <div class="m9b-body">
          <div class="m9b-path" style={pop({ at: 0.42, dur: 0.6 })}>package.json</div>
          <div class="m9b-note" style={pop({ at: 0.52, dur: 0.6 })}>
            AI 建议的解决结果 · 确认后才会写入文件 · 由 deepseek-flash 生成
          </div>
          <div class="m9b-input" style={pop({ at: 0.6, dur: 0.6 })}>补充说明（可选），例如「版本号取上游」</div>
          <div class="m9b-btns" style={pop({ at: 0.7, dur: 0.6 })}>
            <span class="m9b-btn primary">✧ 重新生成</span>
            <span class="m9b-btn">取当前分支</span>
            <span class="m9b-btn">取对方分支</span>
          </div>
          <div class="m9b-code">
            {CODE.map((line, i) => (
              <div
                class={'m9b-line' + (line.hl ? ' hl' : '')}
                style={pop({ at: 0.95 + i * 0.06, dur: 0.5, from: 'translateX(-14px)' })}
              >
                <span class="no">{line.n}</span>
                <span class="tx">{line.t}</span>
              </div>
            ))}
          </div>
          <div class="m9b-btns" style={pop({ at: 1.65, dur: 0.7 })}>
            <span class="m9b-btn primary">应用并标记已解决</span>
            <span class="m9b-btn ghost">放弃</span>
          </div>
        </div>
      </div>
    </div>
  );
}
