// Tiny CSS + SVG scene engine for the promo video.
//
// - JSX compiles (bun, classic runtime) to `h(tag, props, ...children)`.
// - Layout, styles and animations are plain CSS, so the browser does all the
//   rendering work and the exporter only needs to flip a "clock".
// - Time is driven by one number: `window.__seek(t)` sets every animation to
//   the same instant. Nothing is event driven, so any frame can be rendered
//   independently and in any order.

export const W = 1920;
export const H = 1080;
export const FPS = 30;

/* ------------------------------------------------------------------ dom -- */

const NS_SVG = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'g', 'defs', 'linearGradient', 'radialGradient', 'stop', 'circle', 'ellipse',
  'rect', 'path', 'line', 'polyline', 'polygon', 'text', 'tspan', 'foreignObject',
  'clipPath', 'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'mask', 'pattern',
]);

function setProps(el, props) {
  for (const k of Object.keys(props)) {
    if (k === 'children') continue;
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') {
      for (const sk of Object.keys(v)) el.style.setProperty(sk, String(v[sk]));
    } else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'className' || k === 'class') {
      el.setAttribute('class', v);
    } else if (k === 'html') {
      el.innerHTML = v;
    } else {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c && c.nodeType) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function h(tag, props, ...children) {
  if (typeof tag === 'function') return tag({ ...(props || {}), children });
  const el = SVG_TAGS.has(tag)
    ? document.createElementNS(NS_SVG, tag)
    : document.createElement(tag);
  if (props) setProps(el, props);
  append(el, children);
  return el;
}

export const frag = (...children) => {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
};

/* ------------------------------------------------------------- helpers -- */

/**
 * Seconds -> css duration, slowed down by SCENE_RATE so that a scene authored
 * on a 1x timeline can be stretched into its slot.
 */
let RATE = 1;
export function setRate(r) {
  RATE = r;
}
const s = (v) => `${(v / RATE).toFixed(4)}s`;

/**
 * Spring-ish entrance. `at` is in authoring seconds.
 */
export function pop({ at = 0, dur = 0.7, from = 'translateY(26px)', to = 'none', ease = 'spring' } = {}) {
  const eases = {
    spring: 'cubic-bezier(.16,1.28,.36,1)',
    out: 'cubic-bezier(.16,1,.3,1)',
    smooth: 'cubic-bezier(.4,0,.2,1)',
    linear: 'linear',
  };
  return {
    animation: `popIn ${s(dur)} ${eases[ease] || eases.spring} ${s(at)} both`,
    '--from': from,
    '--to': to,
  };
}

export const delay = (at) => ({ animationDelay: s(at) });

export const opacity = (v) => ({ opacity: v });

/** Deterministic PRNG (mulberry32) so bubbles/motes are identical every run. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------ shared styles -- */

export const BASE_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #050d24; }
body {
  font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", -apple-system, "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  color: #fff;
}
.stage { position: absolute; inset: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
.scene { position: absolute; inset: 0; width: ${W}px; height: ${H}px; }
.bg { position: absolute; inset: 0; background: var(--bg, #050d24); }

/* ambient background helpers */
.glow { position: absolute; border-radius: 50%; filter: blur(70px); opacity: .55; }
.grid-floor {
  position: absolute; left: -20%; right: -20%; bottom: -12%; height: 52%;
  background-image:
    linear-gradient(to right, rgba(120,160,255,.20) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(120,160,255,.20) 1px, transparent 1px);
  background-size: 64px 64px;
  transform: perspective(760px) rotateX(64deg);
  transform-origin: 50% 100%;
  mask-image: linear-gradient(to top, #000 10%, transparent 88%);
  -webkit-mask-image: linear-gradient(to top, #000 10%, transparent 88%);
  opacity: .55;
  animation: gridScroll 7s linear infinite;
}
.noise { position: absolute; inset: 0; opacity: .05; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='.6'/></svg>");
}
.vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 46%, transparent 42%, rgba(2,6,20,.62) 100%); }

@keyframes gridScroll { from { background-position: 0 0, 0 0; } to { background-position: 0 64px, 0 64px; } }
@keyframes popIn {
  from { opacity: 0; transform: var(--from, translateY(26px)); }
  to   { opacity: 1; transform: var(--to, none); }
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes floatY { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
@keyframes floatSoft { 0%,100% { transform: translateY(-6px) } 50% { transform: translateY(8px) } }
@keyframes bob { 0%,100% { transform: translateY(0) rotate(-1.4deg) } 50% { transform: translateY(-12px) rotate(1.4deg) } }
@keyframes bobFast { 0%,100% { transform: translateY(3px) rotate(-2deg) } 50% { transform: translateY(-9px) rotate(2deg) } }
@keyframes spinSlow { to { transform: rotate(360deg) } }
@keyframes pulseRing {
  0% { transform: scale(.55); opacity: .85; }
  70% { opacity: .12; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes sheen { 0% { transform: translateX(-140%) } 100% { transform: translateX(240%) } }
@keyframes shake { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-7px) } 40% { transform: translateX(6px) } 60% { transform: translateX(-4px) } 80% { transform: translateX(3px) } }

/* text helpers */
.title-xl { font-weight: 800; letter-spacing: -.02em; line-height: 1.06; }
.grad-text {
  background: linear-gradient(96deg, #ffffff 6%, #bcd4ff 38%, #6ea8ff 62%, #ffffff 96%);
  background-size: 240% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: gradSweep 6s ease-in-out infinite;
}
@keyframes gradSweep { 0%,100% { background-position: 0% 50% } 50% { background-position: 100% 50% } }
.pill {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 8px 18px; border-radius: 999px; font-size: 21px; font-weight: 600;
  color: #cfe0ff; background: rgba(78,120,255,.16);
  border: 1px solid rgba(120,160,255,.34);
  backdrop-filter: blur(6px);
}
.kbd {
  font-family: "SF Mono", "Maple Mono NF CN", Menlo, monospace; font-size: .92em;
  padding: 1px 9px; border-radius: 7px; background: rgba(255,255,255,.10);
  border: 1px solid rgba(255,255,255,.22);
}
.code { font-family: "SF Mono", "Maple Mono NF CN", Menlo, monospace; }
`;
