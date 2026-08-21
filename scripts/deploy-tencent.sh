#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="${JOBPILOT_PROJECT_DIR:-/home/ubuntu/jobpilot-cn}"
target_ref="${1:-origin/main}"
cd "$project_dir"

echo "[deploy] target=$target_ref current=$(git rev-parse --short HEAD)"
git fetch --prune --tags origin
git merge --ff-only "$target_ref"

docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production build app
docker compose --env-file .env.production pull caddy
docker compose --env-file .env.production up -d --remove-orphans

for attempt in $(seq 1 18); do
  if docker compose --env-file .env.production exec -T app node -e "fetch('http://127.0.0.1:4173/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
    docker compose --env-file .env.production ps
    echo "[deploy] healthy commit=$(git rev-parse --short HEAD)"
    exit 0
  fi
  echo "[deploy] waiting for health check ($attempt/18)"
  sleep 5
done

docker compose --env-file .env.production logs --tail=120 app caddy
echo "[deploy] health check failed" >&2
exit 1
