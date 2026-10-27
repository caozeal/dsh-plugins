import { h, rng } from './engine.js';

/** Full-bleed background: deep navy → DeepSeek blue, glow blobs, floor grid. */
export function Stage({ variant = 'deep' } = {}) {
  const r = rng(variant === 'deep' ? 7 : 11);
  const palettes = {
    deep: ['#04091a', '#071231'],
    blue: ['#050f2c', '#0a1c50'],
    darker: ['#03060f', '#060e24'],
  };
  const [c1, c2] = palettes[variant] || palettes.deep;
  const blobs = [
    { x: 12, y: 18, s: 620, c: 'rgba(58,110,255,.55)', dur: 9 },
    { x: 82, y: 12, s: 540, c: 'rgba(64,200,255,.42)', dur: 11 },
    { x: 66, y: 84, s: 700, c: 'rgba(96,80,255,.34)', dur: 13 },
    { x: 24, y: 88, s: 480, c: 'rgba(40,170,255,.28)', dur: 10 },
  ];
  const motes = Array.from({ length: 46 }, () => ({
    x: r() * 1920,
    y: r() * 1080,
    d: 1.5 + r() * 3.2,
    sz: 1 + r() * 3.4,
    delay: -r() * 8,
    o: 0.18 + r() * 0.5,
  }));
  return (
    <div class="scene">
      <div class="bg" style={{ '--bg': `radial-gradient(120% 90% at 50% 8%, ${c2} 0%, ${c1} 62%, #02060f 100%)` }} />
      {blobs.map((b) => (
        <div
          class="glow"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.s}px`,
            height: `${b.s}px`,
            marginLeft: `${-b.s / 2}px`,
            marginTop: `${-b.s / 2}px`,
            background: `radial-gradient(circle, ${b.c}, transparent 68%)`,
            animation: `floatSoft ${b.dur}s ease-in-out infinite`,
          }}
        />
      ))}
      <div class="grid-floor" />
      <div class="motes">{motes.map((m) => (
        <i
          style={{
            left: `${m.x}px`,
            top: `${m.y}px`,
            width: `${m.sz}px`,
            height: `${m.sz}px`,
            opacity: m.o,
            animation: `floatY ${m.d}s ease-in-out ${m.delay}s infinite`,
          }}
        />
      ))}</div>
      <div class="vignette" />
      <div class="noise" />
    </div>
  );
}

/** Soft 3d-tilted product card used behind screenshots. */
export function tilt(wrap, { rotY = -9, rotX = 4, glow = 'rgba(78,130,255,.55)' } = {}) {
  wrap.style.transform = `perspective(2200px) rotateY(${rotY}deg) rotateX(${rotX}deg)`;
  wrap.style.position = 'relative';
  const g = document.createElement('i');
  g.className = 'tilt-glow';
  g.style.background = `radial-gradient(60% 60% at 50% 50%, ${glow}, transparent 72%)`;
  wrap.prepend(g);
  return wrap;
}

export function Screenshot({ src, w = 900, h = 405, radii = 18, cls = '', style = {}, children } = {}) {
  return (
    <div class={`shot ${cls}`} style={{ width: `${w}px`, height: `${h}px`, borderRadius: `${radii}px`, ...style }}>
      <img src={src} draggable={false} />
      {children}
    </div>
  );
}
