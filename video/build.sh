#!/usr/bin/env bash
# Bundle the promo renderer into build/ (JSX -> h() via bun's classic runtime).
set -euo pipefail
cd "$(dirname "$0")"

rm -rf build
mkdir -p build/scenes
echo '{"type":"module"}' > build/package.json
echo '{"type":"module"}' > src/package.json

bun build src/main.js --outfile build/main.js --format=esm --production 2>&1 | tail -3

for f in src/scenes/*.js src/scenes/*.jsx; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"
  bun build "$f" --outfile "build/scenes/$base" --format=esm \
    --jsx-runtime=classic --jsx-factory=h --jsx-fragment=Fragment --production >/dev/null 2>&1
done

cp src/core/engine.js src/core/stage.js src/core/ui.js src/core/timeline.js build/
cp src/index.html build/index.html
cp -R assets build/assets

echo "build ok: $(ls build/scenes | tr '\n' ' ')"
