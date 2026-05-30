#!/usr/bin/env sh
# LeSearch uninstaller — clean removal is a first-class promise.
#   curl -fsSL https://lesearch.ai/uninstall | sh        (also: lesearch uninstall)
# Flags: --keep-data (retain Postgres volume)  --dry-run  --force
set -u

KEEP_DATA=0; DRY=0; FORCE=0
for a in "$@"; do
  case "$a" in
    --keep-data) KEEP_DATA=1 ;;
    --dry-run) DRY=1 ;;
    --force) FORCE=1 ;;
  esac
done

run() { if [ "$DRY" = 1 ]; then echo "  would: $*"; else eval "$*"; fi; }

APP_DIR="${LESEARCH_APP_DIR:-$HOME/.lesearch/app}"

echo "LeSearch uninstall${DRY:+ (dry-run)}:"

# 1) stop the stack (and remove volumes unless --keep-data)
if [ -f "$APP_DIR/docker-compose.yml" ]; then
  if [ "$KEEP_DATA" = 1 ]; then run "(cd '$APP_DIR' && docker compose down)"
  else run "(cd '$APP_DIR' && docker compose down -v)"; fi
fi

# 2) remove the launcher from every candidate dir
for d in "${LESEARCH_INSTALL_DIR:-}" "${XDG_BIN_DIR:-}" "$HOME/.local/bin" "$HOME/.lesearch/bin"; do
  [ -n "$d" ] && [ -f "$d/lesearch" ] && run "rm -f '$d/lesearch'"
done

# 3) remove the app dir (held the cloned source)
if [ -d "$APP_DIR" ]; then
  if [ "$FORCE" = 1 ] || [ "$DRY" = 1 ]; then run "rm -rf '$APP_DIR'"
  else echo "  keeping $APP_DIR (pass --force to remove the cloned source)"; fi
fi

[ "$KEEP_DATA" = 1 ] && echo "  Postgres data volume retained (--keep-data)."
echo "Done."
