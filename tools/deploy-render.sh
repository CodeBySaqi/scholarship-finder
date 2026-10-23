#!/usr/bin/env bash
# Create (or update) the Render service for this app, wired to the hosted Supabase.
#
#   RENDER_API_KEY=rnd_... \
#   SUPABASE_URL=https://xxxx.supabase.co \
#   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
#   SF_SECRET=... \
#   ./tools/deploy-render.sh https://github.com/<you>/<repo>
#
# The repo must be reachable by Render. A PUBLIC repo needs nothing else; for a
# PRIVATE repo, connect GitHub once in the Render dashboard (Account Settings →
# Git Credentials) and Render can use it.
#
# Safe to re-run: it updates the existing service instead of creating a duplicate.
set -euo pipefail

REPO="${1:?usage: deploy-render.sh https://github.com/<you>/<repo>}"
: "${RENDER_API_KEY:?set RENDER_API_KEY}"
: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
: "${SF_SECRET:?set SF_SECRET}"

API=https://api.render.com/v1
NAME=scholarship-finder
BRANCH="${BRANCH:-main}"
OWNER="${RENDER_OWNER:-}"     # optional: set if the key can see several workspaces
REGION="${RENDER_REGION:-frankfurt}"
auth=(-H "Authorization: Bearer $RENDER_API_KEY" -H 'Content-Type: application/json')

if [ -z "$OWNER" ]; then
  OWNER=$(curl -sf "${auth[@]}" "$API/owners" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["owner"]["id"])')
fi
echo "→ workspace $OWNER"

existing=$(curl -sf "${auth[@]}" "$API/services?ownerId=$OWNER&limit=100" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(next((s['service']['id'] for s in d if s['service']['name']=='$NAME'),''))")

payload=$(python3 - "$REPO" "$BRANCH" "$OWNER" "$REGION" "$SUPABASE_URL" "$SUPABASE_SERVICE_ROLE_KEY" "$SF_SECRET" <<'PY'
import json, sys
repo, branch, owner, region, sb_url, sb_key, secret = sys.argv[1:8]
print(json.dumps({
  "type": "web_service",
  "name": "scholarship-finder",
  "ownerId": owner,
  "repo": repo,
  "branch": branch,
  "autoDeploy": "yes",
  "envVars": [
    {"key": "SUPABASE_URL", "value": sb_url},
    {"key": "SUPABASE_SERVICE_ROLE_KEY", "value": sb_key},
    {"key": "SF_SECRET", "value": secret},
    {"key": "NODE_VERSION", "value": "20"},
    {"key": "NODE_ENV", "value": "production"}
  ],
  "serviceDetails": {
    "env": "node",
    "plan": "free",
    "region": region,
    "healthCheckPath": "/api/health",
    "envSpecificDetails": {
      "buildCommand": "npm ci && npm run build",
      "startCommand": "node server/index.js"
    }
  }
}))
PY
)

if [ -n "$existing" ]; then
  echo "→ updating service $existing"
  curl -sf -X PATCH "${auth[@]}" "$API/services/$existing" \
    -d "$(echo "$payload" | python3 -c 'import sys,json;d=json.load(sys.stdin);d.pop("type",None);d.pop("ownerId",None);print(json.dumps(d))')" >/dev/null
  echo "  env vars + build settings updated"
else
  echo "→ creating web service"
  curl -sf -X POST "${auth[@]}" "$API/services" -d "$payload" > /tmp/render-service.json
  existing=$(python3 -c 'import json;print(json.load(open("/tmp/render-service.json"))["service"]["id"])')
  echo "  created $existing"
fi

echo "→ deploying $BRANCH"
curl -sf -X POST "${auth[@]}" "$API/services/$existing/deploys" -d "{\"clearCache\":\"do_not_clear\"}" >/dev/null || true

for i in $(seq 1 60); do
  line=$(curl -sf "${auth[@]}" "$API/services/$existing" \
    | python3 -c 'import sys,json;s=json.load(sys.stdin)["serviceDetails"];print(s.get("url") or "", "|", s.get("suspended", ""))')
  url=${line%% |*}
  if [ -n "$url" ] && [ "$url" != "None" ]; then echo "→ live at $url"; break; fi
  sleep 10
done

echo
echo "next: open \$URL/api/health and confirm store.mode = supabase"
