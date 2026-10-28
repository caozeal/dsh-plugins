#!/usr/bin/env bash
# Full pipeline: bundle -> serve -> seek+screenshot every frame -> encode mp4.
set -euo pipefail
cd "$(dirname "$0")"
FPS=30
SESSION="promo-$$"
FRAMES="${FRAMES_DIR:-/tmp/dsh-next-git-promo-frames}"

./build.sh
( PORT=8899 node server.mjs >/tmp/promo-server.log 2>&1 & echo $! > /tmp/promo-server.pid )
sleep 1

export AGENT_BROWSER_SESSION="$SESSION"
agent-browser open "http://127.0.0.1:8899/?capture=1&t=0" --viewport-size 1920,1080 >/dev/null
agent-browser wait --fn "window.__ready === true" >/dev/null

TOTAL=$(agent-browser eval "String(window.__total)" | tr -d '"')
END=$(node -e "console.log(Math.round($TOTAL*$FPS))")
# 配乐/音效脚本按片长裁剪；不传就会出现画面 45s、音频 37.8s，-shortest 把片子截短。
export FILM_SECONDS="$TOTAL"
rm -rf "$FRAMES"; mkdir -p "$FRAMES"
FRAME_START=0 FRAME_END=$END FPS=$FPS TOTAL=$TOTAL SESSION="$SESSION" node capture.mjs "$FRAMES"

ffmpeg -y -hide_banner -loglevel error -framerate $FPS -i "$FRAMES/f%05d.png" \
  -vf "fps=60,fade=t=in:st=0:d=0.6,fade=t=out:st=$(node -e "console.log(($TOTAL-0.9).toFixed(2))"):d=0.9,format=yuv420p" -c:v libx264 -preset slow -crf 19 -profile:v high -level 4.2 \
  -movflags +faststart /tmp/promo_base.mp4
NR=$(node -e "console.log(Math.round($TOTAL*60)-1)")
Z="$(node -e "console.log('1.011+0.011*cos(PI*on/$NR)')")"
ffmpeg -y -hide_banner -loglevel error -i /tmp/promo_base.mp4 \
  -vf "zoompan=z='${Z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=60,format=yuv420p" \
  -c:v libx264 -preset slow -crf 19 -profile:v high -level 4.2 -movflags +faststart \
  out/dsh-next-git-promo.mp4

# --- soundtrack ---
# ACE-Step track (default, selected by ear): regenerate on mini with
#   audio/acestep/README.md, or reuse the committed flac and re-fit here.
ACE=audio/acestep/candA.flac
if [ -f "$ACE" ]; then
  python3 audio/acestep_fit.py "$ACE" audio/acestep/bgm-ace.wav > /dev/null
  cp /tmp/promo_base.mp4 out/dsh-next-git-promo-silent.mp4
  ffmpeg -y -hide_banner -loglevel error -i out/dsh-next-git-promo-silent.mp4 -i audio/acestep/bgm-ace.wav \
    -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
    out/dsh-next-git-promo.mp4
fi
# synthesised fallback / A/B reference
python3 audio/synth.py > /dev/null
ffmpeg -y -hide_banner -loglevel error -i out/dsh-next-git-promo-silent.mp4 -i audio/bgm.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
  out/dsh-next-git-promo-synth.mp4

agent-browser close >/dev/null 2>&1 || true
kill "$(cat /tmp/promo-server.pid)" 2>/dev/null || true
rm -f /tmp/promo-server.pid
echo "ok -> out/dsh-next-git-promo.mp4 (ACE-Step, final) + -synth.mp4 + -silent.mp4"
