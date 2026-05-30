#!/usr/bin/env bash
# Smoke test: bring the stack up, poll /health and /status, assert, tear down.
set -uo pipefail
cd "$(dirname "$0")/.."

GW="http://localhost:7700"
echo "[smoke] docker compose up -d"
docker compose up -d --build || { echo "[smoke] FAIL: compose up"; exit 2; }

echo "[smoke] waiting for /health …"
ok=0
for i in $(seq 1 40); do
  if curl -fsS "$GW/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
[ "$ok" = 1 ] || { echo "[smoke] FAIL: /health never came up"; docker compose logs gateway | tail -30; docker compose down; exit 3; }

echo "[smoke] /health:" && curl -fsS "$GW/health"
echo; echo "[smoke] /status:" && curl -fsS "$GW/status"
echo

overall=$(curl -fsS "$GW/status" | grep -o '"overall":"[a-z_]*"' | head -1)
echo "[smoke] overall = $overall"

echo "[smoke] docker compose down"
docker compose down

case "$overall" in
  *\"ok\"*|*\"degraded\"*) echo "[smoke] PASS"; exit 0 ;;
  *) echo "[smoke] FAIL: unexpected overall"; exit 4 ;;
esac
