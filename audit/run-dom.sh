#!/usr/bin/env bash
# Bundles the React app for the DOM harness and runs the browser-free suites.
#   ./audit/run-dom.sh smoke       every route, three roles
#   ./audit/run-dom.sh features    notifications, admin CRUD, broadcast, research, search
#   ./audit/run-dom.sh responsive  phone + tablet layout behaviour
# Needs happy-dom (`npm i --no-save happy-dom`) and a server on :8000.
set -e
mkdir -p /tmp/sf-dom
npx esbuild audit/dom-entry.jsx --bundle --format=esm --platform=node \
  --outfile=/tmp/sf-dom/bundle.mjs --loader:.js=jsx --jsx=automatic \
  --define:process.env.NODE_ENV='"development"' --log-level=error
case "${1:-smoke}" in
  smoke)      node audit/dom-smoke.mjs ;;
  features)   node audit/features-admin.mjs ;;
  responsive) node audit/responsive.mjs ;;
  *) echo "usage: $0 [smoke|features|responsive]"; exit 2 ;;
esac
