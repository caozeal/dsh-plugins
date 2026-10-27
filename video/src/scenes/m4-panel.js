import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';

// 03b — 面板整体（真机截图）
export const CSS = `
.m4-shot { position:absolute; left: 150px; top: 168px; width: 1180px; height: 532px; border-radius: 22px; overflow:hidden;
  box-shadow: 0 50px 120px rgba(2,10,34,.72), 0 0 0 1px rgba(150,190,255,.30); background:#fff; }
.m4-shot img { width:100%; height:100%; object-fit: cover; }
.m4-shot .chrome { position:absolute; inset:0 0 auto 0; height: 44px; background: linear-gradient(180deg,#f4f7fe,#eef3fc);
  border-bottom:1px solid #e2e9f6; display:flex; align-items:center; gap:7px; padding: 0 16px; }
.m4-shot .chrome i { width: 11px; height:11px; border-radius:50%; display:block; }
.m4-shot .chrome .path { margin-left: 14px; font: 600 13px "SF Mono",Menlo,monospace; color:#8b9ab6; }
.m4-shot .inner { position:absolute; inset: 44px 0 0 0; overflow:hidden; }
.m4-shot .inner img { width:100%; height:auto; }
.m4-right { position:absolute; left: 1400px; top: 230px; width: 420px; }
.m4-right h3 { margin:0; font-size: 44px; font-weight:800; line-height:1.18; }
.m4-right p { margin: 18px 0 0; font-size: 22px; color:#9fb4d8; line-height:1.7; }
.m4-tags { display:flex; flex-direction:column; gap: 12px; margin-top: 30px; }
.m4-tag { display:flex; align-items:center; gap: 12px; font-size: 21px; color:#d6e6ff;
  padding: 12px 16px; border-radius: 14px; background: rgba(40,80,170,.22); border:1px solid rgba(110,160,255,.26); }
.m4-tag i { width: 26px; height:26px; border-radius: 8px; display:grid; place-items:center; font-size: 14px;
  background: linear-gradient(140deg,#3b6bff,#2b4fe0); color:#fff; font-style:normal; }
.m4-band { position:absolute; left:150px; bottom: 120px; display:flex; gap: 18px; }
.m4-stat { min-width: 268px; padding: 20px 24px; border-radius: 18px; background: rgba(14,28,64,.62);
  border:1px solid rgba(90,140,240,.28); }
.m4-stat b { display:block; font-size: 40px; font-weight:800; color:#8fd0ff; letter-spacing:-.02em; }
.m4-stat span { font-size: 17px; color:#9db2d6; }
`;

export function Scene() {
  return (
    <div class="scene m4">
      <Stage variant="blue" />
      <div class="m4-shot" style={pop({ at: 0.05, dur: 1, from: 'translateY(70px) scale(.93)' })}>
        <div class="inner"><img src="assets/shot-changes.png" /></div>
      </div>
      <div class="m4-right">
        <h3 style={pop({ at: 0.45, dur: 0.8, from: 'translateX(30px)' })}>
          会话侧栏里的<br /><span style={{ color: '#8fd0ff' }}>完整仓库视图</span>
        </h3>
        <p style={pop({ at: 0.6, dur: 0.8, from: 'translateX(30px)' })}>
          不占地、不抢焦点。写代码的地方，就是看改动、提交、推送的地方。
        </p>
        <div class="m4-tags">
          <span class="m4-tag" style={pop({ at: 0.78, dur: 0.7, from: 'translateX(30px)' })}><i>1</i>顶栏分支 + ahead/behind</span>
          <span class="m4-tag" style={pop({ at: 0.90, dur: 0.7, from: 'translateX(30px)' })}><i>2</i>变更分组：暂存 / 未暂存 / 未跟踪 / 冲突</span>
          <span class="m4-tag" style={pop({ at: 1.02, dur: 0.7, from: 'translateX(30px)' })}><i>3</i>提交区常驻底部</span>
        </div>
      </div>
      <div class="m4-band">
        <div class="m4-stat" style={pop({ at: 1.2, dur: 0.7 })}><b>12</b><span>Git 操作全部走 RPC</span></div>
        <div class="m4-stat" style={pop({ at: 1.32, dur: 0.7 })}><b>0</b><span>需要切换窗口或终端</span></div>
        <div class="m4-stat" style={pop({ at: 1.44, dur: 0.7 })}><b>1</b><span>个图标弹出全部</span></div>
      </div>
    </div>
  );
}
