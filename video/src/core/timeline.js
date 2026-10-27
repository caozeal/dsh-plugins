// Timeline (authoring time, seconds on a 1x scene clock) and global order.
// The renderer stretches every scene to its slot with animation playback rate,
// so these numbers only need to be internally consistent per scene.
export const FPS = 30;

export const SCENES = [
  { id: 'm1-intro', file: './scenes/m1-intro.js', dur: 5.4, slot: 4.6, label: '01 标题' },
  { id: 'm2-pain', file: './scenes/m2-pain.js', dur: 5.0, slot: 4.6, label: '02 痛点对比' },
  { id: 'm3-entry', file: './scenes/m3-entry.js', dur: 4.6, slot: 4.2, label: '03 入口' },
  { id: 'm4-panel', file: './scenes/m4-panel.js', dur: 3.6, slot: 3.4, label: '04 面板总览' },
  { id: 'm5-branches', file: './scenes/m5-branches.js', dur: 3.2, slot: 3.0, label: '05 分支' },
  { id: 'm6-changes', file: './scenes/m6-changes.js', dur: 3.2, slot: 3.0, label: '06 变更' },
  { id: 'm7-diff', file: './scenes/m7-diff.js', dur: 3.2, slot: 3.0, label: '07 Diff' },
  { id: 'm8-ai-commit', file: './scenes/m8-ai-commit.js', dur: 4.6, slot: 4.4, label: '08 AI 提交信息' },
  { id: 'm10-graph', file: './scenes/m10-graph.js', dur: 4.2, slot: 4.0, label: '09 提交图' },
  { id: 'm11-details', file: './scenes/m11-details.js', dur: 3.8, slot: 3.6, label: '10 细节' },
  { id: 'm12-install', file: './scenes/m12-install.js', dur: 4.2, slot: 4.2, label: '11 安装与收尾' },
];

// Cross-fade length between adjacent scenes.
export const XFADE = 0.42;

export const TOTAL = SCENES.reduce((a, s) => a + s.slot, 0) - XFADE * (SCENES.length - 1);

/** Absolute start time (seconds) of scene i on the master timeline. */
export function sceneStart(i) {
  let x = 0;
  for (let k = 0; k < i; k++) x += SCENES[k].slot - XFADE;
  return x;
}
