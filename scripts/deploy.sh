#!/bin/bash
# Deploy the landing (dateandtime-live Worker) to dev or prod.
#
# IMPORTANT: wrangler 4.x doesn't honor the [assets] exclude field, so the
# datetime-api's 98 MB workerd binary (in cloudflare/datetime-api/node_modules)
# gets included as an "asset" and the deploy fails. We move that directory
# aside before deploy and restore it after.
#
# Usage: ./scripts/deploy.sh [dev|prod]
set -e

TARGET="${1:-prod}"
if [ "$TARGET" != "dev" ] && [ "$TARGET" != "prod" ]; then
  echo "Usage: $0 [dev|prod]" >&2
  exit 1
fi

API_NODE_MODULES="cloudflare/datetime-api/node_modules"
BACKUP_DIR=".deploy-backup"

# Stash the api worker's node_modules
if [ -d "$API_NODE_MODULES" ]; then
  echo "→ Stashing $API_NODE_MODULES aside (wrangler 4 bug)..."
  mkdir -p "$BACKUP_DIR"
  mv "$API_NODE_MODULES" "$BACKUP_DIR/api_node_modules"
fi

# Restore on exit
trap '
  if [ -d "$BACKUP_DIR/api_node_modules" ]; then
    echo "→ Restoring $API_NODE_MODULES..."
    mv "$BACKUP_DIR/api_node_modules" "$API_NODE_MODULES"
    rmdir "$BACKUP_DIR" 2>/dev/null || true
  fi
' EXIT

# Deploy
if [ "$TARGET" = "dev" ]; then
  echo "→ Deploying to tdp-landing-dev (dev)..."
  npx wrangler deploy --env dev
  URL="https://tdp-landing-dev.nsura2029.workers.dev"
else
  echo "→ Deploying to dateandtime-live (prod)..."
  npx wrangler deploy
  URL="https://dateandtime.live"
fi

echo
echo "→ $URL"
echo
echo "Smoke test HEAD probes:"
for path in /api/cities /api/holidays/today /api/holidays/upcoming /api/countries/US/working-hours /api/dst/upcoming /api/admin/data-quality /api/feedback/top /api/search; do
  status=$(curl -sIo /dev/null -w "%{http_code}" "$URL$path")
  echo "  $status $path"
done
