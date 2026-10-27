import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';
import { PANEL_CSS, MOCK_CSS, MockPanel, BranchList } from '../core/ui.js';

// 05 — 分支切换（全 mock 渲染）
export const CSS = `
${PANEL_CSS}
${MOCK_CSS}
.m5-shot { position:absolute; left: 120px; top: 140px; width: 1240px; height: 600px; border-radius: 22px; overflow:hidden;
  box-shadow: 0 50px 120px rgba(2,10,34,.72), 0 0 0 1px rgba(150,190,255,.30); background:#eef3fc; padding: 16px;
  display:flex; align-items:flex-start; justify-content:center; }
.m5-spot { position:absolute; border-radius: 14px; border: 3px solid #7fb6ff;
  box-shadow: 0 0 0 9999px rgba(4,10,28,.42), 0 0 26px rgba(120,180,255,.7); }
.m5-right { position:absolute; left: 1420px; top: 220px; width: 420px; }
.m5-right h3 { margin:0; font-size: 46px; font-weight:800; line-height:1.16; }
.m5-right h3 span { color:#8fd0ff; }
.m5-right ul { margin: 22px 0 0; padding:0; list-style:none; }
.m5-right li { display:flex; gap: 12px; margin-top: 16px; font-size: 21px; color:#cadcf7; line-height:1.5; }
.m5-right li i { flex:none; width: 24px; height:24px; margin-top:3px; border-radius: 50%; display:grid; place-items:center;
  font-size:12px; font-style:normal; color:#04122e; background:#8fd0ff; font-weight:800; }
`;

export function Scene() {
  return (
    <div class="scene m5">
      <Stage variant="deep" />
      <div class="m5-shot" style={pop({ at: 0.05, dur: 0.95, from: 'translateY(60px) scale(.94)' })}>
        <MockPanel active="branches" counts={{}} body={<BranchList />} commitValue="" />
      </div>
      <div class="m5-spot" style={{ left: 120 + 16 + 470, top: 140 + 16 + 150, width: 660, height: 150,
        ...pop({ at: 1.0, dur: 0.6, from: 'scale(.94)' }) }} />
      <div class="m5-right">
        <h3 style={pop({ at: 0.3, dur: 0.8, from: 'translateX(30px)' })}>
          切分支，<br /><span>一次点击</span>
        </h3>
        <ul>
          <li style={pop({ at: 0.55, dur: 0.7 })}><i>1</i>下拉出全部本地 / 远程分支，带 ahead / behind</li>
          <li style={pop({ at: 0.70, dur: 0.7 })}><i>2</i>点远程分支自动建同名跟踪分支</li>
          <li style={pop({ at: 0.85, dur: 0.7 })}><i>3</i>新建 / 删除分支，历史一行预览</li>
        </ul>
      </div>
    </div>
  );
}
