#!/usr/bin/env sh
# LeSearch installer — one command to a working control plane.
#   curl -fsSL https://lesearch.ai/install | sh
# Installs a thin `lesearch` launcher on the XDG bin chain. The heavy services
# run in Docker via `lesearch up`.
set -eu

REPO_URL="${LESEARCH_REPO_URL:-https://github.com/LeSearch-AI/lesearch-factory.git}"
APP_DIR="${LESEARCH_APP_DIR:-$HOME/.lesearch/app}"

# --- platform detection ---------------------------------------------------
os="$(uname -s)"; arch="$(uname -m)"
case "$os" in
  Darwin|Linux) ;;
  *) echo "lesearch: unsupported OS '$os' (supported: macOS, Linux)" >&2; exit 1 ;;
esac
case "$arch" in
  x86_64|amd64|arm64|aarch64) ;;
  *) echo "lesearch: unsupported architecture '$arch' (supported: x86_64, arm64)" >&2; exit 1 ;;
esac

# --- analytics disclosure (required before install completes) -------------
echo "LeSearch collects anonymous usage analytics — feature + health events only,"
echo "never your code, prompts, or secrets. Opt out any time: export LESEARCH_TELEMETRY=0"
echo

# --- dependencies ---------------------------------------------------------
missing=""
for dep in bun docker git; do
  command -v "$dep" >/dev/null 2>&1 || missing="$missing $dep"
done
if [ -n "$missing" ]; then
  echo "lesearch: missing required tools:$missing" >&2
  echo "  bun:    https://bun.sh    docker: https://docker.com    git: your package manager" >&2
  exit 1
fi

# --- source (local checkout wins; else clone) -----------------------------
if [ -f "./packages/cli/src/index.ts" ] && [ -f "./docker-compose.yml" ]; then
  SRC="$(pwd)"
  echo "lesearch: installing from local checkout ($SRC)"
else
  mkdir -p "$(dirname "$APP_DIR")"
  if [ -d "$APP_DIR/.git" ]; then
    echo "lesearch: updating $APP_DIR"; git -C "$APP_DIR" pull --ff-only --quiet
  else
    echo "lesearch: cloning $REPO_URL -> $APP_DIR"; git clone --depth 1 --quiet "$REPO_URL" "$APP_DIR"
  fi
  SRC="$APP_DIR"
fi
( cd "$SRC" && bun install >/dev/null 2>&1 ) || { echo "lesearch: bun install failed" >&2; exit 1; }

# --- choose an install dir (priority chain) -------------------------------
BIN=""
for d in "${LESEARCH_INSTALL_DIR:-}" "${XDG_BIN_DIR:-}" "$HOME/.local/bin" "$HOME/.lesearch/bin"; do
  [ -n "$d" ] || continue
  mkdir -p "$d" 2>/dev/null || continue
  [ -w "$d" ] || continue
  BIN="$d"; break
done
[ -n "$BIN" ] || { echo "lesearch: no writable install dir found" >&2; exit 1; }

# --- write the launcher ---------------------------------------------------
cat > "$BIN/lesearch" <<EOF
#!/usr/bin/env sh
exec bun "$SRC/packages/cli/src/index.ts" "\$@"
EOF
chmod +x "$BIN/lesearch"

echo
echo "Installed: $BIN/lesearch"
case ":$PATH:" in
  *":$BIN:"*) ;;
  *) echo "Add it to your PATH:  export PATH=\"$BIN:\$PATH\"" ;;
esac
echo "Next:  lesearch up   then open  http://localhost:7700"
echo "Remove anytime:  lesearch uninstall   (or curl -fsSL https://lesearch.ai/uninstall | sh)"
