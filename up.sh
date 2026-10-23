#!/usr/bin/env bash
# Start the app on PORT (default 8000), repairing the setup first.
#
#   ./up.sh            # install deps if missing, build if dist/ is missing, then serve
#   ./up.sh --rebuild  # force a fresh vite build
#
# node_modules/ and dist/ are build artefacts: they are not kept between sessions, so this
# script checks for them instead of assuming they exist. data/db.json is never touched —
# run `npm run seed` yourself if you actually want to reset the data.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
REBUILD=0
[ "${1:-}" = "--rebuild" ] && REBUILD=1

if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "→ installing dependencies…"
  npm install --no-audit --no-fund
fi

if [ "$REBUILD" = "1" ] || [ ! -f dist/index.html ]; then
  echo "→ building the client…"
  npm run build
fi

if [ ! -f data/db.json ]; then
  echo "→ no database yet, seeding…"
  npm run seed
fi

echo "→ serving on http://0.0.0.0:${PORT}"
exec env PORT="$PORT" node server/index.js
