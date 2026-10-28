import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';

// 09 — 三个补位动作：丢弃 / Stash / 自定义提示词
export const CSS = `
.m9-left { position:absolute; left: 120px; top: 210px; width: 690px; }
.m9-left h2 { margin:0; font-size: 60px; font-weight:800; letter-spacing:-.02em; line-height:1.16; }
.m9-left h2 span { color:#8fd0ff; }
.m9-left p { margin: 22px 0 0; font-size: 22px; color:#a4bade; line-height:1.7; }
.m9-cards { position:absolute; right: 100px; top: 175px; width: 980px; display:flex; flex-direction:column; gap: 20px; }
.m9-card { display:flex; align-items:center; gap: 20px; padding: 24px 28px; border-radius: 20px;
  background: rgba(16,34,72,.74); border: 1px solid rgba(120,160,255,.26);
  box-shadow: 0 26px 64px rgba(2,10,34,.5); }
.m9-ico { width: 58px; height: 58px; border-radius: 16px; flex: none; display:flex; align-items:center; justify-content:center;
  font-size: 27px; background: linear-gradient(135deg, rgba(79,124,255,.34), rgba(51,88,232,.16));
  border: 1px solid rgba(120,160,255,.32); }
.m9-t { font-size: 27px; font-weight: 800; color:#fff; letter-spacing:-.01em; }
.m9-d { margin-top: 7px; font-size: 17px; color:#a4bade; line-height: 1.6; }
.m9-d b { color:#dbe8ff; font-weight: 600; }
.m9-key { margin-left:auto; flex:none; font: 700 14px "SF Mono",Menlo,monospace; color:#9fc0ff;
  padding: 7px 13px; border-radius: 10px; background: rgba(79,124,255,.16); border: 1px solid rgba(120,160,255,.28); }
`;

const CARDS = [
  {
    icon: '🗑',
    title: '丢弃改动',
    desc: '未暂存回退到 HEAD、未跟踪直接删除、已暂存连暂存区一起退；不可恢复，所以一律二次确认。',
    key: 'discard',
  },
  {
    icon: '📦',
    title: 'Stash',
    desc: '手上这摊事还没到提交的时候，先存起来；列表里随时恢复或删除，未跟踪文件也能一起带走。',
    key: 'stash',
  },
  {
    icon: '⚙',
    title: '自定义提示词',
    desc: '存在 git config，仓库级覆盖全局；只改「怎么写」，diff 仍由 Host 装配后给模型。',
    key: 'prompt',
  },
];

export function Scene() {
  return (
    <div class="scene m9">
      <Stage variant="deep" />
      <div class="m9-left">
        <h2 style={pop({ at: 0.1, dur: 0.8, from: 'translateX(-30px)' })}>
          改坏了能退，<br /><span>做一半能放</span>
        </h2>
        <p style={pop({ at: 0.32, dur: 0.8 })}>
          让 AI 改代码之后最容易卡住的三个地方，各补一个动作。
        </p>
      </div>
      <div class="m9-cards">
        {CARDS.map((card, i) => (
          <div class="m9-card" style={pop({ at: 0.45 + i * 0.16, dur: 0.75, from: 'translateX(60px) scale(.97)' })}>
            <div class="m9-ico">{card.icon}</div>
            <div>
              <div class="m9-t">{card.title}</div>
              <div class="m9-d">{card.desc}</div>
            </div>
            <div class="m9-key">{card.key}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
