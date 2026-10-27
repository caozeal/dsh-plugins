import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';

// 02 — 传统 Git 流程 vs 侧栏面板（简化流程图，非最终文案）
export const CSS = `
.m2-title { position:absolute; left:120px; top: 118px; }
.m2-title h2 { margin:0; font-size: 58px; font-weight: 800; letter-spacing:-.02em; }
.m2-title p { margin: 12px 0 0; font-size: 24px; color:#93a9cf; }
.m2-old, .m2-new { position:absolute; top: 300px; width: 780px; height: 540px; border-radius: 26px; }
.m2-old { left: 120px; background: rgba(16,26,50,.62); border:1px solid rgba(90,120,180,.26); }
.m2-new { left: 1020px; background: linear-gradient(160deg, rgba(24,48,110,.72), rgba(12,24,58,.72));
  border:1px solid rgba(110,160,255,.42); box-shadow: 0 26px 70px rgba(20,60,160,.36); }
.m2-h { display:flex; align-items:center; gap:12px; padding: 22px 28px; font-size: 24px; font-weight:700; }
.m2-old .m2-h { color:#93a5c6; }
.m2-new .m2-h { color:#dceaff; }
.m2-badge { font-size: 15px; font-weight:700; padding: 4px 12px; border-radius: 999px; }
.m2-old .m2-badge { background: rgba(120,140,180,.18); color:#9fb0cc; }
.m2-new .m2-badge { background: linear-gradient(135deg,#3b6bff,#2b4fe0); color:#fff; }
.m2-step { display:flex; align-items:center; gap: 14px; margin: 0 28px; padding: 14px 18px; border-radius: 14px; font-size: 22px; }
.m2-old .m2-step { background: rgba(255,255,255,.035); color:#a9b8d2; margin-bottom: 12px; }
.m2-new .m2-step { background: rgba(255,255,255,.06); color:#e7f0ff; margin-bottom: 12px; }
.m2-step .dot { width: 26px; height: 26px; border-radius: 9px; display:grid; place-items:center; font-size:15px; flex:none; }
.m2-old .dot { background: rgba(140,160,200,.18); color:#b8c6dd; }
.m2-new .dot { background: rgba(110,170,255,.24); color:#9fd0ff; }
.m2-step .kbd { margin-left:auto; }
.m2-arrow { position:absolute; left: 900px; top: 520px; width: 120px; text-align:center; font-size: 44px; color:#6f8fd0; }
.m2-cmp { position:absolute; left: 120px; bottom: 96px; font-size: 24px; color:#9fb4d8; display:flex; gap: 34px; }
.m2-cmp b { color:#8fd0ff; }
`;

export function Scene() {
  const oldSteps = [
    ['1', '打开终端，cd 到仓库'],
    ['2', 'git status / git diff 手敲'],
    ['3', 'git add -A 逐个确认'],
    ['4', 'git commit -m "…" 想破头'],
    ['5', 'git push origin …'],
  ];
  const newSteps = [
    ['✦', '点会话头部 Git 图标'],
    ['✦', '侧栏看变更、悬停看 diff'],
    ['✦', '一键暂存 / 取消暂存'],
    ['✦', 'AI 生成 Conventional 提交信息'],
    ['✦', '提交并推送'],
  ];
  return (
    <div class="scene m2">
      <Stage variant="blue" />
      <div class="m2-title" style={pop({ at: 0.1, dur: 0.8, from: 'translateX(-30px)' })}>
        <h2 class="grad-text">每个改动都在来回切窗口？</h2>
        <p>把 Git 放回它该在的地方 —— 正在写代码的这个对话旁边</p>
      </div>

      <div class="m2-old" style={pop({ at: 0.35, dur: 0.85, from: 'translateY(36px)' })}>
        <div class="m2-h">终端 + 各种 Git GUI <span class="m2-badge">来回切换</span></div>
        {oldSteps.map(([n, tx], i) => (
          <div class="m2-step" style={pop({ at: 0.6 + i * 0.13, dur: 0.6 })}>
            <span class="dot">{n}</span>{tx}
            {i === 2 ? <span class="kbd">⌘Tab</span> : i === 3 ? <span class="kbd">纠结</span> : null}
          </div>
        ))}
      </div>

      <div class="m2-arrow" style={pop({ at: 1.5, dur: 0.6, from: 'translateX(-20px)' })}>➜</div>

      <div class="m2-new" style={pop({ at: 1.5, dur: 0.9, from: 'translateY(36px) scale(.96)' })}>
        <div class="m2-h">dsh-next-git 侧栏 <span class="m2-badge">不离开会话</span></div>
        {newSteps.map(([n, tx], i) => (
          <div class="m2-step" style={pop({ at: 1.75 + i * 0.13, dur: 0.6 })}>
            <span class="dot">{n}</span>{tx}
          </div>
        ))}
      </div>

      <div class="m2-cmp" style={pop({ at: 2.5, dur: 0.7 })}>
        <span>一次改动 → <b>5 次窗口切换</b> 变成 <b>0 次</b></span>
      </div>
    </div>
  );
}
