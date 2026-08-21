#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="${JOBPILOT_PROJECT_DIR:-/home/ubuntu/jobpilot-cn}"
target_ref="${1:-origin/main}"
cd "$project_dir"

echo "[deploy] target=$target_ref current=$(git rev-parse --short HEAD)"
if [[ "${JOBPILOT_SKIP_GIT_SYNC:-0}" != "1" ]]; then
  fetched=0
  for attempt in 1 2 3 4; do
    if git fetch --prune --tags origin; then
      fetched=1
      break
    fi
    echo "[deploy] GitHub fetch failed; retrying ($attempt/4)"
    sleep $((attempt * 5))
  done
  [[ "$fetched" == "1" ]] || { echo "[deploy] GitHub fetch failed after 4 attempts" >&2; exit 128; }
  git merge --ff-only "$target_ref"
else
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse "$target_ref")" ]] || {
    echo "[deploy] checked-out commit does not match $target_ref" >&2
    exit 1
  }
fi

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
