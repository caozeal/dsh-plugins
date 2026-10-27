import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';
import { PANEL_CSS, MOCK_CSS, MockPanel, DiffView } from '../core/ui.js';

// 07 — Diff 查看（全 mock 渲染）
export const CSS = `
${PANEL_CSS}
${MOCK_CSS}
.m7-shot { position:absolute; left: 760px; top: 120px; width: 1080px; height: 600px; border-radius: 22px; overflow:hidden;
  box-shadow: 0 50px 120px rgba(2,10,34,.72), 0 0 0 1px rgba(150,190,255,.30); background:#eef3fc; padding: 16px;
  display:flex; align-items:flex-start; justify-content:center; }
.m7-left { position:absolute; left: 110px; top: 250px; width: 580px; }
.m7-left h3 { margin:0; font-size: 50px; font-weight:800; line-height:1.16; }
.m7-left h3 span { color:#8fd0ff; }
.m7-left p { margin: 20px 0 0; font-size: 22px; color:#a4bade; line-height:1.7; }
.m7-legend { margin-top: 30px; display:flex; flex-direction:column; gap: 12px; }
.m7-row { display:flex; align-items:center; gap: 12px; font: 500 18px "SF Mono",Menlo,monospace; padding: 10px 14px; border-radius: 10px; }
.m7-row.add { background: rgba(34,197,94,.16); color:#8df0b4; border-left: 3px solid #22c55e; }
.m7-row.del { background: rgba(239,68,68,.16); color:#ffa3a3; border-left: 3px solid #ef4444; }
.m7-row.ctx { background: rgba(255,255,255,.05); color:#a9bcd8; border-left: 3px solid #56688a; }
.m7-row .no { color:#5f7ba6; width: 68px; display:inline-block; }
`;

export function Scene() {
  return (
    <div class="scene m7">
      <Stage variant="deep" />
      <div class="m7-shot" style={pop({ at: 0.05, dur: 1, from: 'translateX(70px) scale(.95)' })}>
        <MockPanel active="diff" counts={{}} body={<DiffView />} />
      </div>
      <div class="m7-left">
        <h3 style={pop({ at: 0.3, dur: 0.8, from: 'translateX(-30px)' })}>
          Diff 看得懂，<br /><span>细节不丢</span>
        </h3>
        <p style={pop({ at: 0.48, dur: 0.8 })}>逐 hunk 渲染，旧 / 新行号并列，增删配色一眼可辨。</p>
        <div class="m7-legend">
          <div class="m7-row add" style={pop({ at: 0.66, dur: 0.6, from: 'translateX(-24px)' })}><span class="no">116 117</span>+ 新增的行高亮为绿</div>
          <div class="m7-row del" style={pop({ at: 0.78, dur: 0.6, from: 'translateX(-24px)' })}><span class="no">116</span>- 删除的行高亮为红</div>
          <div class="m7-row ctx" style={pop({ at: 0.90, dur: 0.6, from: 'translateX(-24px)' })}><span class="no">114 114</span>  上下文行保持中性</div>
        </div>
      </div>
    </div>
  );
}
