// Encode the captured frames into the final 1080p60 video (fades live on the
// 30fps side so zoompan never clobbers them).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const FRAMES = process.env.FRAMES_DIR || '/tmp/dsh-next-git-promo-frames';
const OUT = process.env.OUT || 'out/dsh-next-git-promo.mp4';
const TOTAL = Number(process.env.TOTAL || 37.8);
const FPS = Number(process.env.FPS || 30);

const n = fs.readdirSync(FRAMES).filter((f) => /^f\d{5}\.png$/.test(f)).length;
const expected = Math.round(TOTAL * FPS);
if (n < expected) throw new Error(`missing frames: ${n}/${expected}`);

const fadeIn = 0.6;
const fadeOut = Math.max(0, TOTAL - 0.9);
fs.mkdirSync('out', { recursive: true });

const base = '/tmp/promo_base.mp4';
execFileSync('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-framerate', String(FPS), '-i', `${FRAMES}/f%05d.png`,
  '-vf', `fps=60,fade=t=in:st=0:d=${fadeIn},fade=t=out:st=${fadeOut.toFixed(2)}:d=0.9,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-profile:v', 'high', '-level', '4.2',
  '-movflags', '+faststart', base,
], { stdio: 'inherit' });

const lastOn = Math.round(TOTAL * 60) - 1;
const z = `1.011+0.011*cos(PI*on/${lastOn})`;
execFileSync('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-i', base,
  '-vf', `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=60,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-profile:v', 'high', '-level', '4.2',
  '-movflags', '+faststart', OUT,
], { stdio: 'inherit' });

console.log(`encoded ${n} frames -> ${OUT}`);
