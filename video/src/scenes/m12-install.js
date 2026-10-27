import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';

// 11 — 安装三步 + 收尾
export const CSS = `
.m12-title { position:absolute; left:0; right:0; top: 96px; text-align:center; }
.m12-title h2 { margin:0; font-size: 70px; font-weight:800; letter-spacing:-.02em; }
.m12-title p { margin: 14px 0 0; font-size: 24px; color:#93a9cf; }
.m12-steps { position:absolute; left: 160px; right: 160px; top: 280px; display:flex; gap: 26px; }
.m12-step { flex:1; border-radius: 22px; padding: 28px 26px; min-height: 300px;
  background: rgba(14,30,66,.66); border:1px solid rgba(110,160,255,.28); box-shadow: 0 24px 60px rgba(2,10,34,.5); }
.m12-step .no { width: 44px; height:44px; border-radius: 14px; display:grid; place-items:center;
  font-size: 22px; font-weight:800; color:#fff; background: linear-gradient(140deg,#4f7cff,#2b4fe0);
  box-shadow: 0 10px 24px rgba(43,79,224,.4); }
.m12-step h4 { margin: 20px 0 10px; font-size: 27px; font-weight:800; }
.m12-step p { margin: 0; font-size: 19px; color:#9fb4d8; line-height:1.65; }
.m12-cmd { margin-top: 18px; font: 500 17px "SF Mono","Maple Mono NF CN",Menlo,monospace; color:#bcd7ff;
  background: rgba(6,14,34,.72); border:1px solid rgba(110,160,255,.26); border-radius: 12px; padding: 14px 16px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m12-cmd b { color:#8fd0ff; font-weight:600; }
.m12-final { position:absolute; left:0; right:0; top: 660px; text-align:center; }
.m12-final .big { font-size: 116px; font-weight:800; letter-spacing:-.03em; line-height:1.02; }
.m12-final .sub { margin-top: 18px; font-size: 30px; color:#c6d9f7; font-weight:600; }
.m12-links { position:absolute; left:0; right:0; top: 900px; display:flex; justify-content:center; gap: 18px; }
.m12-link { display:flex; align-items:center; gap: 10px; font-size: 21px; color:#cfe0ff; padding: 12px 22px;
  border-radius: 14px; background: rgba(40,80,170,.26); border:1px solid rgba(110,160,255,.3); }
.m12-link b { color:#8fd0ff; font-weight:700; }
.m12-icon { position:absolute; left:0; right:0; top: 596px; text-align:center; }
.m12-icon img { width: 74px; height:74px; border-radius: 18px; box-shadow: 0 16px 40px rgba(56,120,255,.5); }
`;

export function Scene() {
  return (
    <div class="scene m12">
      <Stage variant="deep" />
      <div class="m12-title">
        <h2 class="grad-text" style={pop({ at: 0.08, dur: 0.85 })}>3 步装进你的 DSH</h2>
        <p style={pop({ at: 0.24, dur: 0.8 })}>装完刷新页面，会话头部就多了一个小鲸鱼入口</p>
      </div>

      <div class="m12-steps">
        <div class="m12-step" style={pop({ at: 0.42, dur: 0.85, from: 'translateY(46px)' })}>
          <div class="no">1</div>
          <h4>安装</h4>
          <p>一条命令，从 npm 直接装进 web profile。</p>
          <div class="m12-cmd">dsh plugin --profile web add <b>@caozeal/dsh-next-git</b></div>
        </div>
        <div class="m12-step" style={pop({ at: 0.58, dur: 0.85, from: 'translateY(46px)' })}>
          <div class="no">2</div>
          <h4>刷新页面</h4>
          <p>Host 路由随 Loader 生效，client 图标即刻出现。</p>
          <div class="m12-cmd">会话头部 → <b>Git 图标</b></div>
        </div>
        <div class="m12-step" style={pop({ at: 0.74, dur: 0.85, from: 'translateY(46px)' })}>
          <div class="no">3</div>
          <h4>开始用</h4>
          <p>侧栏跟随当前会话目录，切换会话就是切换仓库。</p>
          <div class="m12-cmd">分支 · 变更 · 提交图 · Diff</div>
        </div>
      </div>

      <div class="m12-icon" style={pop({ at: 1.0, dur: 0.7, from: 'scale(.6)' })}><img src="assets/icon.png" /></div>
      <div class="m12-final">
        <div class="big grad-text" style={pop({ at: 1.15, dur: 0.9 })}>dsh-next-git</div>
        <div class="sub" style={pop({ at: 1.38, dur: 0.8 })}>Git 不再离开会话 —— 现在就去装上</div>
      </div>
      <div class="m12-links">
        <span class="m12-link" style={pop({ at: 1.62, dur: 0.7 })}>npm <b>@caozeal/dsh-next-git</b></span>
        <span class="m12-link" style={pop({ at: 1.74, dur: 0.7 })}>GitHub <b>caozeal/dsh-plugins</b></span>
        <span class="m12-link" style={pop({ at: 1.86, dur: 0.7 })}>MIT <b>开源免费</b></span>
      </div>
    </div>
  );
}
