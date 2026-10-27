import { h } from './engine.js';

/**
 * Client-side mock of the dsh-next-git side panel. Everything mirrors the
 * shipped UI: pill tabs, gradient primary button, whale mascot, status pills,
 * diff cards with old/new line numbers, SVG-lane commit graph.
 */
export const PANEL_CSS = `
.gm { font-family: "PingFang SC","Hiragino Sans GB",-apple-system,sans-serif; color: #1b2340; }
.gm-head { display:flex; align-items:center; gap:10px; padding: 12px 16px 10px; border-bottom: 1px solid #eef2fa; }
.gm-whale { width: 30px; height: 30px; border-radius: 9px; display:grid; place-items:center; background: linear-gradient(150deg,#eaf2ff,#dbe7ff); }
.gm-whale img { width: 22px; height: 22px; }
.gm-repo { font-size: 15px; font-weight: 700; letter-spacing:-.01em; }
.gm-dot { width: 8px; height: 8px; border-radius: 50%; background:#3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,.16); }
.gm-ahead { font-size: 11px; color:#4b5b7d; background:#f3f6fd; border:1px solid #e3eaf8; border-radius: 999px; padding: 1px 8px; }
.gm-branchsel { margin-left:auto; display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600;
  padding: 7px 12px; border-radius: 12px; background: linear-gradient(180deg,#eef4ff,#e4edff);
  border:1px solid #cfdcfb; color:#1e3a8a; box-shadow: 0 2px 6px rgba(59,130,246,.10); }
.gm-chev { color:#3b82f6; font-size: 10px; }
.gm-bar { display:flex; align-items:center; gap:8px; padding: 8px 16px 12px; }
.gm-btn { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600;
  padding: 7px 14px; border-radius: 11px; border:1px solid #dde5f5; background:#fff; color:#33415c;
  box-shadow: 0 1px 2px rgba(16,36,84,.05); }
.gm-btn .ic { font-size: 11px; opacity:.75; }
.gm-btn.primary { color:#fff; border-color: transparent;
  background: linear-gradient(135deg,#3b6bff,#2b4fe0); box-shadow: 0 6px 16px rgba(43,79,224,.34); }
.gm-btn.icon { padding: 7px 10px; color:#5b6b8c; }
.gm-btn.ghost { background:#f6f8fe; }
.gm-tabs { display:flex; gap: 6px; padding: 0 14px; border-bottom:1px solid #eef2fa; }
.gm-tab { font-size:13px; font-weight:600; color:#7c8aa6; padding: 9px 14px; border-radius: 12px 12px 0 0; position:relative; }
.gm-tab.on { color:#fff; background: linear-gradient(135deg,#4f7cff,#3358e8); box-shadow: 0 6px 14px rgba(51,88,232,.28); }
.gm-tab .cnt { display:inline-grid; place-items:center; min-width:18px; height:18px; padding:0 5px; margin-left:6px;
  font-size:11px; border-radius: 9px; background: rgba(255,255,255,.24); }
.gm-body { padding: 12px 16px; flex:1; overflow:hidden; }
.gm-row { display:flex; align-items:center; gap:8px; margin-bottom: 10px; }
.gm-chip { font-size:11.5px; font-weight:600; padding: 5px 11px; border-radius: 9px; border:1px solid #e2e9f7; background:#fbfcff; color:#4b5b7d; }
.gm-chip.dim { color:#a6b1c7; }
.gm-group { display:flex; align-items:center; gap:7px; font-size:11.5px; color:#8c99b4; margin: 12px 0 7px; }
.gm-group i { width:7px; height:7px; border-radius:50%; background:#5b8cff; }
.gm-group.untracked i { background:#22c55e; }
.gm-file { display:flex; align-items:center; gap:9px; padding: 8px 10px; border-radius: 10px; font-size:13px; }
.gm-file .st { width:20px; height:20px; border-radius:6px; display:grid; place-items:center; font-size:11px; font-weight:800; }
.gm-file .st.mod { color:#b45309; background:#fef3c7; }
.gm-file .st.new { color:#15803d; background:#dcfce7; }
.gm-file .path { font-family:"SF Mono","Maple Mono NF CN",Menlo,monospace; font-size:12.5px; color:#2f3d5c; }
.gm-file .plus { margin-left:auto; font-size:11px; color:#94a3b8; }
.gm-status { display:flex; align-items:center; gap:8px; margin: 10px 0;
  padding: 8px 12px; border-radius: 11px; font-size:12px; color:#3f5170;
  background: linear-gradient(90deg,#f6f9ff,#eef4ff); border:1px solid #e4ebf9; }
.gm-status i { width:8px; height:8px; border-radius:50%; background:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.16); }
.gm-commit { border-radius: 14px; border:1px solid #e2e9f7; background:#fff;
  box-shadow: 0 10px 26px rgba(30,58,138,.08); overflow:hidden; }
.gm-commit::before { content:''; display:block; height:3px; background: linear-gradient(90deg,#3b6bff,#38c6ff); }
.gm-commithead { display:flex; align-items:center; gap:8px; padding: 10px 14px 6px; font-size:12.5px; font-weight:700; color:#33415c; }
.gm-commithead img { width:18px; height:18px; }
.gm-input { margin: 0 12px; padding: 10px 12px; border-radius: 10px; border:1px solid #e3e9f6; background:#fbfcff;
  font-size:13px; color:#1f2b47; min-height: 44px; display:flex; align-items:flex-start; }
.gm-input.ph { color:#a8b3c9; }
.gm-input2 { margin: 8px 12px 0; padding: 8px 12px; border-radius: 10px; border:1px solid #e9eef8; background:#fcfdff;
  font-size:12px; color:#a8b3c9; display:flex; align-items:center; gap:8px; }
.gm-ai { margin-left:auto; display:inline-flex; align-items:center; gap:7px; padding: 7px 13px; border-radius: 10px;
  color:#fff; font-size:12.5px; font-weight:700; background: linear-gradient(135deg,#3b6bff,#2b4fe0);
  box-shadow: 0 6px 16px rgba(43,79,224,.32); white-space:nowrap; }
.gm-airef { border:1px solid #bcd0ff; background:#eef4ff; color:#1d4ed8; }
.gm-airef i { font-style:normal; }
.gm-actions { display:flex; align-items:center; gap:8px; padding: 10px 12px 12px; justify-content:flex-end; }
.gm-hint { margin-right:auto; font-size:11px; color:#a6b1c7; }
.gm-submit { font-size:12.5px; font-weight:700; color:#fff; padding: 8px 16px; border-radius: 10px;
  background: linear-gradient(135deg,#4f7cff,#3358e8); box-shadow: 0 6px 16px rgba(51,88,232,.30); }
.gm-submit.busy { background: linear-gradient(135deg,#8fb0ff,#6d8cf0); }
.gm-sub2 { font-size:12.5px; font-weight:600; color:#5b6b8c; padding: 8px 14px; border-radius: 10px; border:1px solid #e2e9f7; background:#fff; }
.gm-load { display:flex; gap:5px; align-items:center; }
.gm-load i { width:6px; height:6px; border-radius:50%; background:#fff; animation: gmBlink 1s infinite; }
.gm-load i:nth-child(2) { animation-delay:.15s } .gm-load i:nth-child(3) { animation-delay:.3s }
@keyframes gmBlink { 0%,100% { opacity:.3; transform: translateY(0) } 50% { opacity:1; transform: translateY(-3px) } }
.gm-ok { color:#15803d; background:#dcfce7; border-color:#bbf7d0; }
.gm-ok i { background:#22c55e !important; }

/* diff */
.gm-diffhead { display:flex; align-items:center; gap:8px; padding: 8px 12px; border-radius: 10px;
  background: linear-gradient(90deg,#f2f6ff,#eef4ff); border:1px solid #e0e9fb; font-size:12px; color:#33415c; margin-bottom:10px; }
.gm-diffhead b { font-family:"SF Mono",Menlo,monospace; font-weight:600; }
.gm-add { margin-left:auto; color:#15803d; background:#dcfce7; border-radius:6px; padding:1px 7px; font-weight:700; font-size:11px; }
.gm-del { color:#b91c1c; background:#fee2e2; border-radius:6px; padding:1px 7px; font-weight:700; font-size:11px; }
.gm-hunk { padding: 7px 10px; border-radius: 9px; background:#eef3ff; border:1px solid #dde7fb; color:#3b5bbf;
  font-family:"SF Mono",Menlo,monospace; font-size:11px; margin-bottom:7px; }
.gm-line { display:flex; gap:0; font-family:"SF Mono","Maple Mono NF CN",Menlo,monospace; font-size:11.5px; line-height: 1.62;
  border-radius: 4px; white-space: pre; }
.gm-line .no { width: 34px; text-align:right; color:#b3bdd1; padding-right: 10px; flex:none; }
.gm-line .tx { flex:1; padding-left: 8px; color:#35405c; }
.gm-line.add { background:#e8fbef; }
.gm-line.add .tx { color:#166534; }
.gm-line.del { background:#fdecec; }
.gm-line.del .tx { color:#991b1b; }

/* graph */
.gm-graph { display:flex; gap:8px; padding: 2px 8px 2px 2px; font-size:12px; align-items:center; border-radius:8px; }
.gm-graph .lane { flex:none; }
.gm-graph .hash { font-family:"SF Mono",Menlo,monospace; color:#7f8dab; font-size:11px; width: 76px; flex:none; }
.gm-ref { font-size:10.5px; font-weight:600; padding: 1px 7px; border-radius: 999px; background:#eef3ff; color:#2f57c9; border:1px solid #dbe6fb; flex:none; }
.gm-ref.head { background:#3358e8; color:#fff; border-color:#3358e8; }
.gm-ref.remote { background:#f3f7ff; color:#5a76b8; border-color:#e2eaf9; }
.gm-graph .sub { color:#2f3d5c; flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.gm-graph .who { color:#9aa6bf; font-size:10.5px; flex:none; }
.gm-graph.on { background: linear-gradient(90deg,#eef4ff,#f7faff); }

/* mascot empty state */
.gm-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 12px; padding: 26px 10px; }
.gm-empty .m { width: 118px; height: 118px; border-radius: 28px; background: linear-gradient(160deg,#eef4ff,#dfe9ff);
  display:grid; place-items:center; box-shadow: 0 12px 30px rgba(59,102,246,.18); animation: bob 3.6s ease-in-out infinite; }
.gm-empty .m img { width: 110px; height: 110px; }
.gm-empty .t { font-size: 14px; font-weight: 700; color:#1f2b47; }
.gm-empty .s { font-size: 12px; color:#93a1bd; }
`;

export function gitIcon(kind) {
  const paths = {
    fetch: 'M12 3v12m0 0 4-4m-4 4-4-4M4 19h16',
    pull: 'M12 3v10m0 0 4-4m-4 4-4-4M6 21h12',
    push: 'M12 21V7m0 0 4 4m-4-4-4 4M4 3h16',
    sync: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4',
    plus: 'M12 5v14M5 12h14',
    file: 'M7 3h7l4 4v14H7z',
  };
  const d = paths[kind] || paths.push;
  return h('svg', { class: 'ic', width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, h('path', { d }));
}

export function PanelHead({ repo = 'dsh-plugins', branch = 'main', ahead = 1 } = {}) {
  return (
    <div class="gm-head">
      <span class="gm-whale"><img src="assets/whale.png" alt="" /></span>
      <span class="gm-repo">{repo}</span>
      <span class="gm-dot" />
      <span class="gm-ahead">↑{ahead}</span>
      <span class="gm-branchsel">{branch} <i class="gm-chev">▼</i></span>
    </div>
  );
}

export function PanelBar() {
  return (
    <div class="gm-bar">
      <span class="gm-btn">{gitIcon('fetch')} Fetch</span>
      <span class="gm-btn">{gitIcon('pull')} Pull</span>
      <span class="gm-btn primary">{gitIcon('push')} Push</span>
      <span style={{ marginLeft: 'auto' }} />
      <span class="gm-btn icon">{gitIcon('sync')}</span>
      <span class="gm-btn icon">{gitIcon('plus')}</span>
    </div>
  );
}

export function Tabs({ active = 'changes', counts = { changes: 2 } } = {}) {
  const list = [
    ['changes', '变更', counts.changes],
    ['graph', '提交图'],
    ['branches', '分支'],
    ['diff', '差异'],
  ];
  return (
    <div class="gm-tabs">
      {list.map(([k, label, cnt]) => (
        <span class={`gm-tab${active === k ? ' on' : ''}`}>
          {label}{cnt ? <i class="cnt">{cnt}</i> : null}
        </span>
      ))}
    </div>
  );
}

export function Status({ text = '就绪', ok = false } = {}) {
  return <div class={`gm-status${ok ? ' gm-ok' : ''}`}><i />{text}</div>;
}

export function CommitBox({ value, placeholder = '填写提交信息，或先点「AI 生成信息」', ref1 = false, busy = false, done = false, hint = '⌘↵ 提交' } = {}) {
  return (
    <div class="gm-commit">
      <div class="gm-commithead"><img src="assets/whale.png" alt="" /> 提交信息</div>
      <div class={`gm-input${value ? '' : ' ph'}`}>{value || placeholder}</div>
      <div class="gm-input2">
        给 AI 的补充说明（可选）
        <span class="gm-ai">{ref1 ? <span class="gm-load"><i /><i /><i /></span> : <span class="gm-airef"><i>✦</i></span>} AI 生成</span>
      </div>
      <div class="gm-actions">
        <span class="gm-hint">{hint}</span>
        <span class={`gm-submit${busy ? ' busy' : ''}`}>{done ? '✓ 已提交' : busy ? '提交中…' : '提交'}</span>
        <span class="gm-sub2">提交并推送</span>
      </div>
    </div>
  );
}

export function FileRow({ kind = 'mod', path, plus = true }) {
  return (
    <div class="gm-file">
      <span class={`st ${kind}`}>{kind === 'mod' ? 'M' : '?'}</span>
      <span class="path">{path}</span>
      {plus ? <span class="plus">+</span> : null}
    </div>
  );
}

export function DiffCard({ file = 'src/operations.js', add = 12, del = 3, lines = [], hunk = '@@ -118,7 +118,15 @@ export function stage' } = {}) {
  return (
    <div>
      <div class="gm-diffhead">工作区 <b>{file}</b> <span class="gm-add">+{add}</span> <span class="gm-del">-{del}</span></div>
      <div class="gm-hunk">{hunk}</div>
      {lines.map((l) => (
        <div class={`gm-line ${l.t === 'add' ? 'add' : l.t === 'del' ? 'del' : ''}`}>
          <span class="no">{l.o ?? ''}</span><span class="no">{l.n ?? ''}</span>
          <span class="tx">{l.t === 'add' ? '+' : l.t === 'del' ? '-' : ' '}{l.x}</span>
        </div>
      ))}
    </div>
  );
}

/** SVG commit graph with lanes; `rows` drive both graph and labels. */
export function GraphRow({ lanes, dots, edges, hash, refs = [], sub, who, on = false, w = 60, h = 26 }) {
  return (
    <div class={`gm-graph${on ? ' on' : ''}`} style={{ height: `${h}px` }}>
      <svg class="lane" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {edges.map((e) => (
          <path d={e.d} stroke={e.c} stroke-width="2" fill="none" stroke-linecap="round" />
        ))}
        {dots.map((d) => (
          <circle cx={d.x} cy={d.y} r={d.r || 4.2} fill={d.c} stroke="#fff" stroke-width="1.6" />
        ))}
      </svg>
      <span class="hash">{hash}</span>
      {refs.map((r) => <span class={`gm-ref ${r.k || ''}`}>{r.t}</span>)}
      <span class="sub">{sub}</span>
      <span class="who">{who}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- scenes --
 * Mock panel bodies used by the promo instead of real screenshots: the whole
 * panel (header, tabs, lists, diff, graph) is rendered at run time, so the film
 * never depends on a live DSH session or a captured screen.
 */

const BRANCHES = [
  { name: 'main', tag: '当前', ahead: '↑1', sub: 'feat(ai-commit): 用默认模型生成 Conventional 提交信息', on: true },
  { name: 'feature/panel', tag: '', ahead: '', sub: 'style: DeepSeek 蓝 + 胖鲸鱼视觉与动效' },
  { name: 'feature/graph', tag: '', ahead: '', sub: 'feat(graph): SVG lane 渲染，长历史不挤文字' },
  { name: 'fix/clean-env', tag: '', ahead: '', sub: 'fix: cleanGitEnv 用 undefined 墓碑删继承的坏 GIT_CONFIG' },
];

export function BranchList({ rows = BRANCHES } = {}) {
  return (
    <div class="gm-list">
      <div class="gm-group"><i />本地分支 4</div>
      {rows.map((b) => (
        <div class={`gm-branch${b.on ? ' on' : ''}`}>
          <span class="br-icon">⑂</span>
          <span class="br-name">{b.name}</span>
          {b.tag ? <span class="gm-pill">{b.tag}</span> : null}
          {b.ahead ? <span class="gm-ahead2">{b.ahead}</span> : null}
          <span class="br-sub">{b.sub}</span>
        </div>
      ))}
      <div class="gm-group"><i />远程分支 2</div>
      {['origin/main', 'origin/feature/panel'].map((n) => (
        <div class="gm-branch"><span class="br-icon dim">⑂</span><span class="br-name dim">{n}</span>
          <span class="br-sub">点远程分支自动建同名跟踪分支</span></div>
      ))}
    </div>
  );
}

const CHANGE_FILES = [
  ['mod', 'src/client.js', '+38'],
  ['mod', 'src/git.js', '+12'],
  ['new', 'src/ai-commit.js', '+96'],
  ['untracked', 'docs/PROTOCOL.md', '?'],
];

export function ChangeList({ files = CHANGE_FILES } = {}) {
  return (
    <div class="gm-list">
      <div class="gm-row">
        <span class="gm-chip">+ 全部暂存</span>
        <span class="gm-chip dim">− 全部取消暂存</span>
      </div>
      <div class="gm-group"><i />未暂存 3</div>
      {files.filter((f) => f[0] !== 'untracked').map(([k, p, n]) => (
        <div class="gm-file">
          <span class={`st ${k === 'new' ? 'new' : 'mod'}`}>{k === 'new' ? 'A' : 'M'}</span>
          <span class="path">{p}</span>
          <span class="plus">{n}</span>
        </div>
      ))}
      <div class="gm-group untracked"><i />未跟踪 1</div>
      {files.filter((f) => f[0] === 'untracked').map(([, p]) => (
        <div class="gm-file"><span class="st new">?</span><span class="path">{p}</span><span class="plus">+</span></div>
      ))}
      <div class="gm-group"><i />冲突 0</div>
      <div class="gm-empty-mini">没有冲突，pull 随时可用</div>
    </div>
  );
}

const DIFF_LINES = [
  { o: 114, n: 114, t: 'ctx', x: 'export function stage(params) {' },
  { o: 115, n: 115, t: 'ctx', x: '  assertRepo(params.cwd);' },
  { t: 'del', o: 116, x: '  return runGit(["add", "-A"], cwd);' },
  { t: 'add', n: 116, x: '  const files = params.files ?? null;' },
  { t: 'add', n: 117, x: '  // 单文件或整批暂存都走同一条路径' },
  { t: 'add', n: 118, x: '  return runGit(files ? ["add", "--", ...files] : ["add", "-A"], cwd);' },
  { o: 117, n: 119, t: 'ctx', x: '}' },
];

export function DiffView({ file = 'src/operations.js', add = 12, del = 3 } = {}) {
  return (
    <div class="gm-list">
      <div class="gm-diffhead">工作区 <b>{file}</b> <span class="gm-add">+{add}</span> <span class="gm-del">-{del}</span></div>
      <div class="gm-hunk">@@ -114,4 +114,7 @@ export function stage</div>
      {DIFF_LINES.map((l) => (
        <div class={`gm-line ${l.t === 'add' ? 'add' : l.t === 'del' ? 'del' : ''}`}>
          <span class="no">{l.o ?? ''}</span><span class="no">{l.n ?? ''}</span>
          <span class="tx">{l.t === 'add' ? '+' : l.t === 'del' ? '-' : ' '}{l.x}</span>
        </div>
      ))}
    </div>
  );
}

const GRAPH_ROWS = [
  ['a41c9e7', [['HEAD → main', 'head'], ['origin/main', 'remote']], 'feat(ai-commit): 用默认模型生成 Conventional 提交信息', '2 分钟前'],
  ['5d4e1b2', [], 'feat(graph): SVG lane 渲染，长历史不挤文字', '12 分钟前'],
  ['e77a03c', [['feature/panel', 'dev']], 'feat(panel): 右侧栏 tab + 会话头部入口', '40 分钟前'],
  ['9b2f5d1', [], 'style: DeepSeek 蓝 + 胖鲸鱼视觉与动效', '1 小时前'],
  ['2c8d64a', [], 'fix: cleanGitEnv 用 undefined 墓碑删坏 GIT_CONFIG', '3 小时前'],
  ['b91e7f5', [], 'test: 32 条单测 + 临时真实仓库集成测试', '昨天'],
];

function LaneSvg({ rows = GRAPH_ROWS.length }) {
  const h = rows * 27;
  const parts = [];
  parts.push(<path d={`M9,10 L9,${h - 14}`} stroke="#3b82f6" stroke-width="2.2" fill="none" opacity=".8" />);
  parts.push(<path d={`M9,${13.5 + 2 * 27 - 6} C9,${13.5 + 2 * 27 + 8} 24,${13.5 + 2 * 27 - 4} 24,${13.5 + 2 * 27 + 14} L24,${13.5 + 4 * 27 - 6} C24,${13.5 + 4 * 27 + 10} 9,${13.5 + 4 * 27 + 6} 9,${13.5 + 5 * 27 - 4}`} stroke="#22c55e" stroke-width="2.2" fill="none" opacity=".85" />);
  for (let i = 0; i < rows; i++) {
    const lane = i === 2 || i === 3 ? 1 : 0;
    parts.push(<circle cx={9 + lane * 15} cy={13.5 + i * 27} r="4.6" fill={lane ? '#22c55e' : '#3b82f6'} stroke="#fff" stroke-width="1.8" />);
  }
  return <svg width="66" height={h} viewBox={`0 0 66 ${h}`} style={{ flex: 'none' }}>{parts}</svg>;
}

export function GraphList({ rows = GRAPH_ROWS } = {}) {
  return (
    <div class="gm-list" style={{ display: 'flex', gap: '6px' }}>
      <LaneSvg rows={rows.length} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {rows.map(([hash, refs, sub, when], i) => (
          <div class="gm-grow" style={{ height: '27px' }}>
            <span class="hash">{hash}</span>
            {refs.map(([t, k]) => <span class={`gm-pill ${k}`}>{t}</span>)}
            <span class="sub">{sub}</span>
            <span class="when">{when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Whole mock panel: `body` is one of the list components above. */
export function MockPanel({ title = 'Git 管理', body = null, active = 'changes', counts = { changes: 3 }, commitValue = '', tall = false } = {}) {
  return (
    <div class={`gm-panel${tall ? ' tall' : ''}`}>
      <div class="gm-panel-tab"><b>{title}</b><span class="x">×</span><span class="plus">＋</span>
        <span class="right">▤ ⤢</span></div>
      <PanelHead />
      <PanelBar />
      <Tabs active={active} counts={counts} />
      <div class="gm-body">{body}</div>
      <CommitBox value={commitValue} />
    </div>
  );
}

/* CSS for the mock scene bodies (prefixed gm-, same palette as the real panel). */
export const MOCK_CSS = `
.gm-panel { width: 100%; border-radius: 16px; overflow: hidden; background: #fff; color: #1b2340;
  box-shadow: 0 30px 80px rgba(2,10,34,.55), 0 0 0 1px rgba(150,190,255,.25);
  font-family: "PingFang SC","Hiragino Sans GB",-apple-system,sans-serif; }
.gm-panel .gm-head { padding: 10px 14px 8px; }
.gm-panel .gm-bar { padding: 6px 14px 9px; }
.gm-panel .gm-body { padding: 10px 14px; }
.gm-panel .gm-commit { border: 0; border-top: 1px solid #eef2fa; border-radius: 0; box-shadow: none; }
.gm-panel-tab { display:flex; align-items:center; gap:8px; padding: 8px 14px; background:#f4f7fe; border-bottom:1px solid #e6ecf8;
  font-size: 14px; color:#33415c; }
.gm-panel-tab b { font-weight: 700; }
.gm-panel-tab .x, .gm-panel-tab .plus { color:#98a6c0; font-size: 14px; }
.gm-panel-tab .right { margin-left:auto; color:#8fa0bf; letter-spacing: 3px; font-size: 11px; }

.gm-list { font-size: 12.5px; }
.gm-branch { display:flex; align-items:center; gap:8px; padding: 7px 8px; border-radius: 9px; }
.gm-branch.on { background: linear-gradient(90deg,#eef4ff,#f7faff); box-shadow: inset 0 0 0 1px #dbe7fb; }
.gm-branch .br-icon { color:#3b82f6; font-size: 13px; }
.gm-branch .br-icon.dim { color:#b9c6dc; }
.gm-branch .br-name { font-weight: 700; color:#22304d; font-family:"SF Mono",Menlo,monospace; font-size:12px; }
.gm-branch .br-name.dim { color:#8b9ab6; }
.gm-branch .br-sub { margin-left:auto; color:#93a1bd; font-size:11.5px; max-width: 52%; overflow:hidden;
  white-space:nowrap; text-overflow:ellipsis; }
.gm-pill { font-size:10.5px; font-weight:700; padding:1px 8px; border-radius:999px; background:#eef3ff; color:#2f57c9;
  border:1px solid #dbe6fb; }
.gm-pill.head { background:#3358e8; color:#fff; border-color:#3358e8; }
.gm-pill.remote { background:#f4f7ff; color:#6079b5; }
.gm-pill.dev { background:#ecfdf5; color:#15803d; border-color:#c9f2da; }
.gm-ahead2 { font-size:11px; color:#5b6b8c; background:#f3f6fd; border:1px solid #e3eaf8; border-radius:8px; padding:0 6px; }
.gm-empty-mini { font-size: 11.5px; color:#a8b3c9; padding: 6px 10px; }
.gm-grow { display:flex; align-items:center; gap:8px; font-size:12px; border-radius:7px; padding:0 6px; }
.gm-grow .hash { font:500 11px "SF Mono",Menlo,monospace; color:#8492ae; width:62px; flex:none; }
.gm-grow .sub { flex:1; color:#2f3d5c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gm-grow .when { font-size:10.5px; color:#a3aec4; flex:none; }
`;
