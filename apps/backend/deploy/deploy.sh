#!/usr/bin/env bash
# Deploy apps/backend to the VPS. Run from apps/backend on a clean commit.
# Usage: ./deploy/deploy.sh [ssh-host]   (default: tinjau-vps)
set -euo pipefail

HOST="${1:-tinjau-vps}"
APP_DIR=/opt/gatherly/app/backend
STAGE=/tmp/gatherly-backend-release

if [ -n "$(git status --porcelain -- .)" ]; then
  echo "apps/backend has uncommitted changes. Commit or stash them first." >&2
  exit 1
fi

pnpm typecheck

rsync -az --delete \
  --exclude node_modules --exclude dist --exclude public --exclude .env --exclude '.env.*' \
  ./ "$HOST:$STAGE/"

ssh "$HOST" "STAGE=$STAGE APP_DIR=$APP_DIR bash -s" <<'REMOTE'
set -euo pipefail
sudo rsync -a --delete --exclude node_modules --exclude dist --exclude public "$STAGE/" "$APP_DIR/"
sudo chown -R gatherly:gatherly "$APP_DIR"
cd "$APP_DIR"
sudo -u gatherly env HOME=/opt/gatherly pnpm install --frozen-lockfile --prod=false
sudo -u gatherly env HOME=/opt/gatherly pnpm build
sudo systemctl restart gatherly-api gatherly-worker
sleep 3
systemctl is-active gatherly-api gatherly-worker
curl -fsS http://127.0.0.1:4100/api/v1/health >/dev/null && echo "health ok"
REMOTE
