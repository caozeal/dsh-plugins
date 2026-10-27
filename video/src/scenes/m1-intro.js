import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';

export const CSS = `
.m1-wrap { position:absolute; inset:0; }
.m1-kicker { position:absolute; left:50%; top: 168px; transform: translateX(-50%); }
.m1-icon { position:absolute; left:50%; top: 248px; width: 176px; height: 176px; margin-left:-88px; }
.m1-icon img { width:100%; height:100%; border-radius: 42px; box-shadow: 0 30px 70px rgba(56,120,255,.42), 0 0 0 1px rgba(160,200,255,.35) inset; }
.m1-icon .ring { position:absolute; inset:-26px; border-radius: 50%; border:2px solid rgba(110,170,255,.6); animation: pulseRing 2.6s ease-out .4s infinite; }
.m1-icon .ring2 { animation-delay: 1.1s; }
.m1-orb { position:absolute; border-radius:50%; }
.m1-name { position:absolute; left:0; right:0; top: 458px; text-align:center; font-size: 130px; }
.m1-tag { position:absolute; left:0; right:0; top: 638px; text-align:center; font-size: 40px; color:#c9dbfb; font-weight:600; letter-spacing:.02em; }
.m1-tag em { font-style: normal; color:#8fd0ff; }
.m1-sub { position:absolute; left:0; right:0; top: 704px; text-align:center; font-size: 25px; color:#8fa6cc; }
.m1-install { position:absolute; left:50%; top: 794px; transform: translateX(-50%);
  display:flex; align-items:center; gap: 16px; padding: 16px 26px; border-radius: 18px;
  background: rgba(10,22,52,.78); border:1px solid rgba(110,150,255,.34); box-shadow: 0 20px 50px rgba(4,12,36,.6);
  font-size: 24px; color:#dbe8ff; backdrop-filter: blur(10px); white-space:nowrap; }
.m1-install .prompt { color:#5f7dbb; }
.m1-install b { color:#8fd0ff; font-weight:600; }
.m1-install .copy { margin-left: 8px; font-size: 17px; color:#9ab2dd; padding: 4px 12px; border-radius: 9px;
  border:1px dashed rgba(140,170,240,.4); }
`;

export const MEDIA_CSS = `@keyframes m1hover { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }`;

const PKG = '@caozeal/dsh-next-git';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function Scene() {
  const r = rng(21);
  const orbs = Array.from({ length: 18 }, () => ({
    x: r() * 1920,
    y: r() * 1080,
    s: 3 + r() * 7,
    d: 2.4 + r() * 3,
    dl: r() * 3,
    o: 0.12 + r() * 0.3,
  }));
  return (
    <div class="scene m1">
      <Stage variant="deep" />
      {orbs.map((o) => (
        <i
          class="m1-orb"
          style={{
            left: `${o.x}px`,
            top: `${o.y}px`,
            width: `${o.s}px`,
            height: `${o.s}px`,
            background: 'radial-gradient(circle,#9fd0ff,#3a7bff)',
            opacity: o.o,
            animation: `floatY ${o.d}s ease-in-out ${-o.dl}s infinite`,
          }}
        />
      ))}
      <div class="m1-wrap">
        <div class="m1-kicker" style={pop({ at: 0.15, dur: 0.8, from: 'translate(-50%, 18px)' })}>
          <span class="pill">
            <span style={{ color: '#8fd0ff' }}>◆</span> DeepSeek Harness 插件 · 免费开源
          </span>
        </div>
        <div class="m1-icon" style={pop({ at: 0.32, dur: 0.95, from: 'scale(.5) rotate(-10deg)' })}>
          <span class="ring" />
          <span class="ring ring2" />
          <img src="assets/icon.png" style={{ animation: 'm1hover 4.4s ease-in-out infinite' }} />
        </div>
        <div class="m1-name title-xl" style={pop({ at: 0.62, dur: 0.9, from: 'translateY(40px) scale(.94)' })}>
          <span class="grad-text">dsh-next-git</span>
        </div>
        <div class="m1-tag" style={pop({ at: 0.95, dur: 0.8 })}>
          把 Git 搬进会话侧栏，<em>让 AI 帮你写提交信息</em>
        </div>
        <div class="m1-sub" style={pop({ at: 1.12, dur: 0.8 })}>
          分支 · 暂存 · 提交 · 推送 · 提交图 · Diff —— 一个侧栏全部搞定
        </div>
        <div class="m1-install" style={pop({ at: 1.4, dur: 0.8, from: 'translate(-50%, 26px)' })}>
          <span class="prompt">$</span>
          <span class="code">
            dsh plugin --profile web add <b>{PKG}</b>
          </span>
          <span class="copy">npm 一键安装</span>
        </div>
      </div>
    </div>
  );
}
