// Frame driver: seeks the renderer to a list of times and runs a command for
// each, one Chrome screenshot per call. Progress is written to progress.log so
// a killed run can resume without repeating frames.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || '/tmp/frames';
const FPS = Number(process.env.FPS || 30);
const TOTAL = Number(process.env.TOTAL || 37.8);
const START = Number(process.env.FRAME_START || 0);
const END = Number(process.env.FRAME_END || Math.round(TOTAL * FPS));
const SESSION = process.env.SESSION || 'promo-1fd9340e3e0e';
const BIN = process.env.AGENT_BROWSER || 'agent-browser';

fs.mkdirSync(OUT, { recursive: true });
const logPath = path.join(OUT, 'progress.log');
const done = new Set();
if (fs.existsSync(logPath)) {
  for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
    const m = line.match(/^(\d+) /);
    if (m) done.add(Number(m[1]));
  }
}
const log = fs.createWriteStream(logPath, { flags: 'a' });

function ab(args) {
  return execFileSync(BIN, ['--session', SESSION, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const t0 = Date.now();
let n = 0;
for (let f = START; f < END; f++) {
  if (done.has(f)) continue;
  const t = f / FPS;
  const file = path.join(OUT, `f${String(f).padStart(5, '0')}.png`);
  ab(['eval', `window.__seek(${t.toFixed(5)}); document.title='t'+${t.toFixed(3)}; 'ok'`]);
  ab(['screenshot', file]);
  log.write(`${f} ${t.toFixed(4)}\n`);
  n++;
  if (n % 25 === 0) {
    const per = (Date.now() - t0) / n;
    const left = (END - f) * per / 1000;
    console.log(`frame ${f}/${END}  ${per.toFixed(0)}ms/frame  eta ${(left / 60).toFixed(1)}min`);
  }
}
log.end();
console.log(`done: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
