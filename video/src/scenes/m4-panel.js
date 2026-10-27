import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';
import { PANEL_CSS, MOCK_CSS, MockPanel, ChangeList } from '../core/ui.js';

// 04 — 面板总览（全 mock 渲染，不依赖任何真机截图）
export const CSS = `
${PANEL_CSS}
${MOCK_CSS}
.m4-shot { position:absolute; left: 150px; top: 158px; width: 1080px; height: 590px; border-radius: 22px; overflow:hidden;
  box-shadow: 0 50px 120px rgba(2,10,34,.72), 0 0 0 1px rgba(150,190,255,.30); background:#eef3fc; padding: 16px;
  display:flex; align-items:flex-start; justify-content:center; }
.m4-right { position:absolute; left: 1290px; top: 210px; width: 520px; }
.m4-right h3 { margin:0; font-size: 44px; font-weight:800; line-height:1.18; }
.m4-right p { margin: 18px 0 0; font-size: 21px; color:#9fb4d8; line-height:1.7; }
.m4-tags { display:flex; flex-direction:column; gap: 12px; margin-top: 26px; }
.m4-tag { display:flex; align-items:center; gap: 12px; font-size: 20px; color:#d6e6ff;
  padding: 12px 16px; border-radius: 14px; background: rgba(40,80,170,.22); border:1px solid rgba(110,160,255,.26); }
.m4-tag i { width: 26px; height:26px; border-radius: 8px; display:grid; place-items:center; font-size: 14px; flex:none;
  background: linear-gradient(140deg,#3b6bff,#2b4fe0); color:#fff; font-style:normal; }
.m4-band { position:absolute; left:150px; bottom: 86px; display:flex; gap: 16px; }
.m4-stat { min-width: 300px; padding: 18px 22px; border-radius: 18px; background: rgba(14,28,64,.62);
  border:1px solid rgba(90,140,240,.28); }
.m4-stat b { display:block; font-size: 36px; font-weight:800; color:#8fd0ff; letter-spacing:-.02em; }
.m4-stat span { font-size: 16px; color:#9db2d6; }
`;

export function Scene() {
  return (
    <div class="scene m4">
      <Stage variant="blue" />
      <div class="m4-shot" style={pop({ at: 0.05, dur: 1, from: 'translateY(70px) scale(.93)' })}>
        <MockPanel active="changes" counts={{ changes: 3 }} body={<ChangeList />} />
      </div>
      <div class="m4-right">
        <h3 style={pop({ at: 0.45, dur: 0.8, from: 'translateX(30px)' })}>
          会话侧栏里的<br /><span style={{ color: '#8fd0ff' }}>完整仓库视图</span>
        </h3>
        <p style={pop({ at: 0.6, dur: 0.8, from: 'translateX(30px)' })}>
          不占地、不抢焦点。写代码的地方，就是看改动、提交、推送的地方。
        </p>
        <div class="m4-tags">
          <span class="m4-tag" style={pop({ at: 0.78, dur: 0.7, from: 'translateX(30px)' })}><i>1</i>顶栏分支 + ahead / behind</span>
          <span class="m4-tag" style={pop({ at: 0.90, dur: 0.7, from: 'translateX(30px)' })}><i>2</i>变更分四组：暂存 / 未暂存 / 未跟踪 / 冲突</span>
          <span class="m4-tag" style={pop({ at: 1.02, dur: 0.7, from: 'translateX(30px)' })}><i>3</i>提交区常驻底部</span>
        </div>
      </div>
      <div class="m4-band">
        <div class="m4-stat" style={pop({ at: 1.2, dur: 0.7 })}><b>12</b><span>个 RPC op 覆盖全部 Git 操作</span></div>
        <div class="m4-stat" style={pop({ at: 1.32, dur: 0.7 })}><b>0</b><span>次切窗口 / 开终端</span></div>
        <div class="m4-stat" style={pop({ at: 1.44, dur: 0.7 })}><b>1</b><span>个图标弹出全部</span></div>
      </div>
    </div>
  );
}
