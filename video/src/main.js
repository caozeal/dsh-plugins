import { h, W, H, BASE_CSS, setRate } from './core/engine.js';
import { SCENES, XFADE, sceneStart, TOTAL } from './core/timeline.js';

const qs = new URLSearchParams(location.search);
const CAPTURE = qs.get('capture') === '1';
const START_T = Number(qs.get('t') || 0);
const FPS = Number(qs.get('fps') || 30);

const PAD = 0.9; // extra time so every animation has fully settled when sampled

const allCss = [];

async function build() {
  const scenes = [];
  for (let i = 0; i < SCENES.length; i++) {
    const def = SCENES[i];
    const mod = await import(def.file);
    allCss.push(mod.CSS || '');
    if (mod.MEDIA_CSS) allCss.push(mod.MEDIA_CSS);
    const rate = def.slot / def.dur;
    const node = mod.Scene({ t: { dur: def.dur } });
    const start = sceneStart(i);
    scenes.push({ ...def, node, start, end: start + def.slot, rate });
  }
  return scenes;
}

function injectStyle() {
  const style = document.createElement('style');
  style.textContent = `
${BASE_CSS}
.scene { opacity: 0; visibility: hidden; }
.fx-grain { position:fixed; inset:0; pointer-events:none; z-index:900; opacity:.055; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='.55'/></svg>"); }
.fx-vig { position:fixed; inset:0; pointer-events:none; z-index:899;
  background: radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(2,5,16,.45) 100%); }
`;
  document.head.appendChild(style);
  for (const c of allCss) {
    const s2 = document.createElement('style');
    s2.textContent = c;
    document.head.appendChild(s2);
  }
}

async function main() {
  const scenes = await build();
  injectStyle();

  const stage = document.createElement('div');
  stage.className = 'stage';
  document.body.appendChild(stage);

  // Each scene lives inside a slot div so it is always fully animated: we never
  // hide it before it has finished, we only toggle opacity.
  for (const sc of scenes) {
    stage.appendChild(sc.node);
    sc.anims = [];
  }

  document.body.insertAdjacentHTML('beforeend', '<div class="fx-vig"></div><div class="fx-grain"></div>');

  function apply(t) {
    // Draw order: later scenes on top.
    scenes.forEach((s, i) => {
      const fadeIn = i === 0 ? 1 : clamp01((t - s.start) / XFADE);
      const fadeOut = i === scenes.length - 1 ? 1 : clamp01((s.end - t) / XFADE);
      const a = Math.min(fadeIn, fadeOut);
      s.node.style.zIndex = String(10 + i);
      if (a <= 0.0001) {
        s.node.style.opacity = '0';
        s.node.style.visibility = 'hidden';
      } else {
        s.node.style.visibility = 'visible';
        s.node.style.opacity = a.toFixed(4);
      }
    });
  }

  window.__seek = (t) => {
    for (const s of scenes) {
      const local = Math.min(s.dur + PAD, Math.max(0, (t - s.start) * s.rate));
      for (const a of s.anims) a.currentTime = local * 1000;
    }
    apply(t);
    document.documentElement.setAttribute('data-t', t.toFixed(4));
  };

  await document.fonts.ready;
  const imgs = Array.from(document.images);
  await Promise.all(imgs.map((im) => (im.complete && im.naturalWidth ? Promise.resolve() : new Promise((r) => {
    im.onload = r;
    im.onerror = r;
  }))));

  for (const s of scenes) {
    const list = s.node.getAnimations({ subtree: true });
    for (const a of list) {
      a.pause();
      a.playbackRate = s.rate;
    }
    s.anims = list;
  }

  window.__sceneDebug = scenes.map((s) => ({ id: s.id, start: +s.start.toFixed(2), end: +s.end.toFixed(2), rate: +s.rate.toFixed(3), anims: s.anims.length }));
  window.__total = TOTAL;
  window.__fps = FPS;

  window.__seek(START_T);

  if (CAPTURE) {
    window.__ready = true;
    return;
  }
  // Live scrub preview for eyeballing.
  const ui = document.createElement('div');
  ui.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:38px;z-index:999;display:flex;align-items:center;gap:12px;padding:0 16px;background:rgba(4,10,26,.86);border-top:1px solid rgba(120,160,255,.32);color:#a9c2e6;font:12px ui-monospace,Menlo,monospace;';
  const bar = document.createElement('input');
  bar.type = 'range';
  bar.min = '0';
  bar.max = String(TOTAL);
  bar.step = '0.02';
  bar.value = String(START_T);
  bar.style.cssText = 'flex:1;accent-color:#4f7cff';
  const lab = document.createElement('span');
  ui.append(bar, lab);
  document.body.appendChild(ui);
  let playing = false;
  let raf = 0;
  let t0 = 0;
  let tStart = START_T;
  const step = () => {
    const t = tStart + (performance.now() - t0) / 1000;
    if (t >= TOTAL) { playing = false; }
    bar.value = String(Math.min(t, TOTAL));
    lab.textContent = `${Math.min(t, TOTAL).toFixed(2)} / ${TOTAL.toFixed(2)} s`;
    window.__seek(Math.min(t, TOTAL));
    if (playing) raf = requestAnimationFrame(step);
  };
  bar.addEventListener('input', () => {
    playing = false;
    cancelAnimationFrame(raf);
    window.__seek(Number(bar.value));
    lab.textContent = `${Number(bar.value).toFixed(2)} / ${TOTAL.toFixed(2)} s`;
  });
  stage.addEventListener('click', () => {
    if (playing) { playing = false; cancelAnimationFrame(raf); return; }
    playing = true;
    tStart = Number(bar.value);
    t0 = performance.now();
    raf = requestAnimationFrame(step);
  });
  lab.textContent = `${START_T.toFixed(2)} / ${TOTAL.toFixed(2)} s`;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

main().catch((e) => {
  window.__error = String((e && e.stack) || e);
  document.body.innerHTML = `<pre style="color:#ff9a9a;font:13px monospace;padding:24px;white-space:pre-wrap;background:#0a0f1e">${window.__error}</pre>`;
});
