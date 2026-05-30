# LeSearch — unified command surface. `just <recipe>`.
set shell := ["bash", "-cu"]

# List recipes
default:
    @just --list

# Install workspace dependencies
install:
    bun install

# Run the full test suite (all packages)
test:
    bun test

# Typecheck the workspace
typecheck:
    bun x tsc -b

# Bring the core stack up (gateway + postgres + webui)
up:
    docker compose up -d
    @echo "LeSearch up. WebUI: http://localhost:7777  Gateway: http://localhost:7700"

# Tear the stack down
down:
    docker compose down

# Aggregate status of all components
status:
    @curl -fsS http://localhost:7700/status | bun x --bun -e 'process.stdin.pipe(process.stdout)' 2>/dev/null || curl -fsS http://localhost:7700/status

# Preflight checks
doctor:
    @bun run packages/cli/src/index.ts doctor || echo "cli not built yet"

# End-to-end smoke: compose up -> poll health/status -> down
smoke:
    bash scripts/smoke.sh

# Build release artifacts (phase 2)
cut-release:
    @echo "TODO: minisign manifest + B3SUMS"
