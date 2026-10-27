import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';

// 05 — 变更 / 暂存（真机截图 + 高亮）
export const CSS = `
.m6-shot { position:absolute; left: 130px; top: 150px; width: 1240px; height: 558px; border-radius: 22px; overflow:hidden;
  box-shadow: 0 50px 120px rgba(2,10,34,.72), 0 0 0 1px rgba(150,190,255,.30); background:#fff; }
.m6-shot img { width:100%; height:100%; object-fit: cover; }
.m6-spot { position:absolute; border-radius: 12px; border: 3px solid #8fd0ff;
  box-shadow: 0 0 0 9999px rgba(4,10,28,.46), 0 0 26px rgba(120,180,255,.7); }
.m6-right { position:absolute; left: 1410px; top: 214px; width: 420px; }
.m6-right h3 { margin:0; font-size: 46px; font-weight:800; line-height:1.16; }
.m6-right h3 span { color:#8fd0ff; }
.m6-right p { margin: 20px 0 0; font-size: 22px; color:#a4bade; line-height:1.7; }
.m6-grid { display:flex; flex-direction:column; gap: 12px; margin-top: 26px; }
.m6-cell { display:flex; align-items:center; gap: 12px; padding: 13px 16px; border-radius: 14px;
  background: rgba(20,44,96,.5); border:1px solid rgba(110,160,255,.26); font-size: 20px; color:#d8e7ff; }
.m6-cell .sw { width: 12px; height:12px; border-radius: 4px; }
.m6-zoom { position:absolute; right: 96px; bottom: 96px; width: 620px; }
`;

export function Scene() {
  const chips = [
    ['#f59e0b', '未暂存 M'],
    ['#22c55e', '未跟踪 ?'],
    ['#3b82f6', '已暂存 A'],
    ['#ef4444', '冲突 UU'],
  ];
  return (
    <div class="scene m6">
      <Stage variant="blue" />
      <div class="m6-shot" style={pop({ at: 0.05, dur: 0.95, from: 'translateY(60px) scale(.94)' })}>
        <img src="assets/shot-changes.png" />
      </div>
      <div class="m6-spot" style={{ left: 130 + 717, top: 150 + 166, width: 480, height: 156, ...pop({ at: 0.75, dur: 0.6, from: 'scale(.94)' }) }} />
      <div class="m6-right">
        <h3 style={pop({ at: 0.28, dur: 0.8, from: 'translateX(30px)' })}>
          改动一眼看清，<br /><span>暂存随手切换</span>
        </h3>
        <p style={pop({ at: 0.46, dur: 0.8 })}>四组状态分门别类，单文件或整批暂存都只要点一下。</p>
        <div class="m6-grid">
          {chips.map(([c, tx], i) => (
            <span class="m6-cell" style={pop({ at: 0.62 + i * 0.12, dur: 0.6 })}>
              <span class="sw" style={{ background: c }} />{tx}
            </span>
          ))}
        </div>
      </div>
      <div class="m6-zoom" style={pop({ at: 1.2, dur: 0.7 })}>
        <span style={{ fontSize: 20, color: '#9fb8dd' }}>悬停文件 → 即时看该文件 diff</span>
      </div>
    </div>
  );
}
