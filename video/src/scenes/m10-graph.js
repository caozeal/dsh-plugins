import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';

// 09 — 提交图（自绘 SVG lane 图，模拟真实面板渲染）
export const CSS = `
.m10-left { position:absolute; left: 120px; top: 250px; width: 710px; }
.m10-left h2 { margin:0; font-size: 62px; font-weight:800; line-height:1.14; letter-spacing:-.02em; }
.m10-left h2 span { color:#8fd0ff; }
.m10-left p { margin: 20px 0 0; font-size: 23px; color:#a4bade; line-height:1.7; }
.m10-meta { display:flex; gap: 12px; margin-top: 28px; flex-wrap:wrap; }
.m10-pill { font-size: 18px; color:#cfe0ff; padding: 9px 15px; border-radius: 11px;
  background: rgba(40,80,170,.24); border:1px solid rgba(110,160,255,.28); }

.m10-card { position:absolute; left: 860px; top: 150px; width: 900px; border-radius: 20px; overflow:hidden;
  background:#fff; box-shadow: 0 46px 110px rgba(2,10,34,.66); color:#1b2340; font-family: "PingFang SC",-apple-system,sans-serif; }
.m10-head { display:flex; align-items:center; gap:10px; padding: 13px 18px; border-bottom:1px solid #eef2fa; }
.m10-head img { width: 26px; height:26px; }
.m10-head b { font-size: 16px; }
.m10-head .b { margin-left:auto; font-size: 12px; font-weight:700; color:#1d4ed8; background:#eef4ff; border:1px solid #d7e3fb; padding: 4px 10px; border-radius: 8px; }
.m10-tabs { display:flex; gap:6px; padding: 10px 14px 0; border-bottom:1px solid #eef2fa; }
.m10-tab { font-size: 13px; font-weight:600; color:#a3afc6; padding: 7px 13px; border-radius: 11px 11px 0 0; }
.m10-tab.on { color:#fff; background: linear-gradient(135deg,#4f7cff,#3358e8); }
.m10-body { padding: 10px 12px; }
.grow { display:flex; align-items:center; gap: 9px; height: 27px; font-size: 12.5px; border-radius: 7px; padding: 0 6px; }
.grow .hash { font: 500 11.5px "SF Mono",Menlo,monospace; color:#8492ae; width: 78px; flex:none; }
.grow .ref { font-size: 10.5px; font-weight:700; padding: 1px 7px; border-radius: 999px; background:#eef3ff; color:#2f57c9; border:1px solid #dbe6fb; flex:none; }
.grow .ref.head { background:#3358e8; color:#fff; border-color:#3358e8; }
.grow .ref.remote { background:#f4f7ff; color:#6079b5; border-color:#e3eaf9; }
.grow .ref.dev { background:#ecfdf5; color:#15803d; border-color:#c9f2da; }
.grow .sub { flex:1; color:#2f3d5c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.grow .who { font-size: 11px; color:#a3aec4; flex:none; }
.grow.on { background: linear-gradient(90deg,#eef4ff,#f8fbff); box-shadow: inset 0 0 0 1px #dbe7fb; }
`;

const LANE = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b'];

// rows: [laneDots, edges, hash, refs[], subject, who]
const ROWS = [
  [[0], [], 'a41c9e7', [['HEAD → main', 'head'], ['origin/main', 'remote']], 'feat(ai-commit): 用默认模型生成 Conventional 提交信息', '曹智勇 · 2 分钟前'],
  [[0], [], '5d4e1b2', [], 'feat(graph): SVG lane 渲染，长历史不挤文字', '曹智勇 · 12 分钟前'],
  [[1], [['M1.5,0 C1.5,10 0.5,18 13.5,27'], ['M13.5,0 C13.5,14 1.5,16 1.5,27']], 'e77a03c', [['origin/feature/panel', 'remote']], 'feat(panel): 右侧栏 tab + 会话头部入口按钮', '曹智勇 · 40 分钟前'],
  [[1], [], '9b2f5d1', [['feature/panel', 'dev']], 'style: DeepSeek 蓝 + 胖鲸鱼视觉与动效', '曹智勇 · 1 小时前'],
  [[1], [], '2c8d64a', [], 'fix: cleanGitEnv 用 undefined 墓碑删继承的坏 GIT_CONFIG', '曹智勇 · 3 小时前'],
  [[0], [], 'b91e7f5', [], 'fix(ai-commit): 600 output tokens 防止半句话截断', '曹智勇 · 昨天'],
  [[0], [], '3f6a2c8', [], 'docs: 协议冻结 PROTOCOL.md 与 27 项 RPC smoke', '曹智勇 · 昨天'],
  [[0], [], '78bd914', [], 'test: 32 条单测 + 临时真实仓库集成测试', '曹智勇 · 昨天'],
  [[0], [], '0d47ba6', [], 'init: dsh-next-git 插件骨架与 bundle patch', '曹智勇 · 3 天前'],
];

const ROW_H = 27;

export function Scene() {
  // Build the lane svg once: dots for each row's lane index.
  const laneW = 66;
  const laneH = ROWS.length * ROW_H;
  const parts = [];
  // main line
  parts.push(<path d={`M9,13.5 L9,${laneH - 14.5}`} stroke={LANE[0]} strokeWidth="2.2" fill="none" opacity=".75" />);
  // feature lane from row2 down to row4, then merge back into row5
  const y2 = 13.5 + 2 * ROW_H;
  const y4 = 13.5 + 4 * ROW_H;
  const y5 = 13.5 + 5 * ROW_H;
  parts.push(<path d={`M9,${y2 - 6} C9,${y2 + 8} 24,${y2 - 4} 24,${y2 + 14} L24,${y4 - 6} C24,${y4 + 10} 9,${y4 + 6} 9,${y5 - 4}`} stroke={LANE[1]} strokeWidth="2.2" fill="none" opacity=".8" />);
  ROWS.forEach(([lanes], i) => {
    lanes.forEach((ln) => parts.push(<circle cx={9 + ln * 15} cy={13.5 + i * ROW_H} r="5" fill={LANE[ln]} stroke="#fff" strokeWidth="2" />));
  });

  return (
    <div class="scene m10">
      <Stage variant="blue" />
      <div class="m10-left">
        <h2 style={pop({ at: 0.1, dur: 0.8, from: 'translateX(-30px)' })}>
          提交历史，<br /><span>看成一棵树</span>
        </h2>
        <p style={pop({ at: 0.3, dur: 0.8 })}>
          <span style={{ color: '#dbe8ff' }}>git log --graph --all</span> 的图形化渲染：<strong style={{ color: '#fff' }}>每条分支线一种颜色</strong>，跨行不换色，分支徽章与它自己的线严格同色。
        </p>
        <div class="m10-meta">
          <span class="m10-pill" style={pop({ at: 0.52, dur: 0.6 })}>最多 10 条 lane</span>
          <span class="m10-pill" style={pop({ at: 0.62, dur: 0.6 })}>默认 80 条 · 上限 300</span>
          <span class="m10-pill" style={pop({ at: 0.72, dur: 0.6 })}>点击即看 diff</span>
        </div>
      </div>

      <div class="m10-card" style={pop({ at: 0.06, dur: 1, from: 'translateX(60px) scale(.95)' })}>
        <div class="m10-head"><img src="assets/whale.png" /><b>dsh-plugins</b><span class="b">提交图</span></div>
        <div class="m10-tabs">
          <span class="m10-tab">变更 <b>3</b></span>
          <span class="m10-tab on">提交图</span>
          <span class="m10-tab">分支</span>
          <span class="m10-tab">差异</span>
        </div>
        <div class="m10-body">
          <div style={{ display: 'flex', gap: '6px' }}>
            <svg width={laneW} height={laneH} viewBox={`0 0 ${laneW} ${laneH}`} style={{ flex: 'none' }}>{parts}</svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              {ROWS.map(([, , hash, refs, sub, who], i) => (
                <div class={`grow${i === 0 ? ' on' : ''}`} style={pop({ at: 0.35 + i * 0.075, dur: 0.5, from: 'translateX(24px)' })}>
                  <span class="hash">{hash}</span>
                  {refs.map(([tx, k]) => <span class={`ref ${k}`}>{tx}</span>)}
                  <span class="sub">{sub}</span>
                  <span class="who">{who}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
