import { h, pop } from '../core/engine.js';
import { Stage } from '../core/stage.js';
import { PANEL_CSS, MOCK_CSS, MockPanel } from '../core/ui.js';

// 10 — 细节与品味：鲸鱼娘空态、右栏指南入口、出错可见、跟随会话目录（全 mock）
export const CSS = `
${PANEL_CSS}
${MOCK_CSS}
.m11-title { position:absolute; left: 120px; top: 118px; }
.m11-title h2 { margin:0; font-size: 58px; font-weight:800; letter-spacing:-.02em; }
.m11-title h2 span { color:#8fd0ff; }
.m11-title p { margin: 12px 0 0; font-size: 22px; color:#94aacf; }

.m11-a { position:absolute; left: 120px; top: 296px; width: 540px; height: 380px; border-radius: 20px; overflow:hidden;
  box-shadow: 0 40px 100px rgba(2,10,34,.66), 0 0 0 1px rgba(150,190,255,.3); background:#f2f6fd; padding: 12px; }
.m11-a .gm-panel { transform: scale(.82); transform-origin: top left; width: 122%; }
.m11-empty { position:absolute; left: 0; right: 0; top: 118px; display:flex; flex-direction:column;
  align-items:center; gap: 10px; }
.m11-empty .m { width: 96px; height: 96px; border-radius: 24px; background: linear-gradient(160deg,#eef4ff,#dfe9ff);
  display:grid; place-items:center; box-shadow: 0 12px 30px rgba(59,102,246,.18); animation: bob 3.6s ease-in-out infinite; }
.m11-empty .m img { width: 90px; height: 90px; }
.m11-empty .t { font-size: 13.5px; font-weight: 700; color:#1f2b47; }
.m11-empty .s { font-size: 11.5px; color:#93a1bd; }
.m11-cap { position:absolute; left: 12px; bottom: 12px; padding: 7px 12px; border-radius: 9px; font-size: 17px; color:#fff;
  background: rgba(8,18,42,.72); backdrop-filter: blur(6px); }

.m11-b { position:absolute; left: 686px; top: 296px; width: 540px; height: 380px; border-radius: 20px; overflow:hidden;
  box-shadow: 0 40px 100px rgba(2,10,34,.66), 0 0 0 1px rgba(150,190,255,.3); background:#fff; }
.gm-guide { padding: 14px; font-family:"PingFang SC",-apple-system,sans-serif; }
.gm-guide .g-h { margin-bottom: 10px; }
.gm-guide .pill { display:inline-flex; gap:6px; font-size: 12px; font-weight:700; color:#3f5170;
  background:#eef3fc; border:1px solid #dbe5f7; border-radius: 8px; padding: 4px 10px; }
.gm-guide .g-item { display:flex; gap: 10px; align-items:center; padding: 9px 11px; border-radius: 11px;
  border:1px solid #e7eef9; background:#fff; margin-bottom: 8px; }
.gm-guide .g-item.on { border-color:#bcd0ff; background:#f4f8ff; box-shadow: 0 6px 18px rgba(59,102,246,.14); }
.gm-guide .ic { width: 26px; height:26px; border-radius:8px; display:grid; place-items:center; font-size: 13px;
  background:#eef3fc; color:#3b6bff; flex:none; }
.gm-guide b { font-size: 13px; color:#22304d; }
.gm-guide p { margin: 1px 0 0; font-size: 11.5px; color:#93a1bd; }

.m11-c { position:absolute; left: 1252px; top: 296px; width: 548px; height: 380px; border-radius: 20px;
  background: rgba(14,28,64,.7); border:1px solid rgba(110,160,255,.3); padding: 24px; }
.m11-c .ttl { font-size: 20px; font-weight:700; color:#dbe9ff; display:flex; align-items:center; gap:10px; }
.m11-c .ttl i { width: 26px; height:26px; border-radius:8px; background: linear-gradient(140deg,#3b6bff,#2b4fe0); display:grid; place-items:center; font-size:14px; font-style:normal; }
.m11-err { margin-top: 18px; font: 500 16px "SF Mono",Menlo,monospace; color:#ffb4b4;
  background: rgba(239,68,68,.14); border:1px solid rgba(239,68,68,.32); border-radius: 10px; padding: 12px 14px; line-height:1.6; }
.m11-c .fine { margin-top: 16px; font-size: 16px; color:#9db2d6; line-height:1.6; }

.m11-row { position:absolute; left: 120px; bottom: 120px; display:flex; gap: 18px; }
.m11-item { display:flex; align-items:center; gap: 12px; font-size: 20px; color:#cfdffa;
  padding: 14px 22px; border-radius: 16px; background: rgba(16,34,76,.6); border:1px solid rgba(110,160,255,.24); }
.m11-item b { color:#8fd0ff; font-size: 24px; }
`;

export function Scene() {
  return (
    <div class="scene m11">
      <Stage variant="deep" />
      <div class="m11-title">
        <h2 style={pop({ at: 0.08, dur: 0.8, from: 'translateY(20px)' })}>细节也有<span>小鲸鱼</span></h2>
        <p style={pop({ at: 0.24, dur: 0.8 })}>空态、顶栏、提交卡片——全是 DeepSeek 蓝调的胖鲸鱼；出错也照实告诉你</p>
      </div>

      <div class="m11-a" style={pop({ at: 0.4, dur: 0.85, from: 'translateY(50px)' })}>
        <MockPanel title="Git 管理" active="changes" counts={{}} body={<div style={{ height: '300px' }} />} />
        <div class="m11-empty">
          <span class="m"><img src="assets/whale.png" /></span>
          <span class="t">工作区干净，没有未提交的变更</span>
          <span class="s">切到「提交图」看看历史，或者继续写代码</span>
        </div>
        <div class="m11-cap">工作区干净时，鲸鱼娘在侧栏陪你</div>
      </div>

      <div class="m11-b" style={pop({ at: 0.55, dur: 0.85, from: 'translateY(50px)' })}>
        <div class="gm-guide">
          <div class="g-h"><span class="pill">↗ 开始</span></div>
          {[['📄', '工作区文件', '浏览会话工作区的文件'], ['🗂', '上下文', '查看上下文的构成、统计、演变'],
            ['▸', '新建终端', '在会话工作区运行命令']].map(([ic, t, d]) => (
            <div class="g-item"><span class="ic">{ic}</span><div><b>{t}</b><p>{d}</p></div></div>
          ))}
          <div class="g-item on"><span class="ic">⑂</span><div><b>Git 管理</b><p>在会话工作区里查看 / 暂存变更、提交、切换分支</p></div></div>
        </div>
        <div class="m11-cap">右栏「＋ → 开始」指南里也能进 Git 管理</div>
      </div>

      <div class="m11-c" style={pop({ at: 0.7, dur: 0.85, from: 'translateY(50px)' })}>
        <div class="ttl"><i>!</i>失败可见</div>
        <div class="m11-err">git push 失败<br />→ stderr 摘要直接回到状态条</div>
        <div class="fine">只读操作（snapshot / graph / diff）永不阻断面板</div>
      </div>

      <div class="m11-row">
        <div class="m11-item" style={pop({ at: 1.0, dur: 0.7 })}><b>◫</b>右栏一键全屏</div>
        <div class="m11-item" style={pop({ at: 1.12, dur: 0.7 })}><b>◆</b>跟随会话目录切仓库</div>
        <div class="m11-item" style={pop({ at: 1.24, dur: 0.7 })}><b>中</b>zh / en 全量文案</div>
        <div class="m11-item" style={pop({ at: 1.36, dur: 0.7 })}><b>0</b>零构建单文件 client</div>
      </div>
    </div>
  );
}
