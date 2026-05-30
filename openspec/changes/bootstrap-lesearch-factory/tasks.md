# Tasks — bootstrap-lesearch-factory

Legend: **[TODAY]** = EOD MVP spine (must be demonstrable). **[P2]** = spec'd now, built after.
Each group maps to one package so it can be delegated to a parallel agent against the frozen schema contract.

## 1. Repo & contract foundation (owner: lead, blocks everything)

- [ ] 1.1 **[TODAY]** Initialize bun/pnpm monorepo workspace (`package.json` workspaces, root `tsconfig.json`, `.editorconfig`, shared `tsconfig.base.json`)
- [ ] 1.2 **[TODAY]** Author versioned JSON Schemas in `schemas/`: `lesearch.status.v1`, `lesearch.run.v1`, `lesearch.memory.v1`, `lesearch.telemetry.v1`
- [ ] 1.3 **[TODAY]** `packages/proto`: generate/author zod validators + TS types from the schemas; export the status enum (`ok|degraded|unavailable|not_configured|unknown`) and codes
- [ ] 1.4 **[TODAY]** Write failing tests for `proto` (schema↔type round-trip, status enum) — confirm red, then green
- [ ] 1.5 **[TODAY]** `justfile` with `install`, `test`, `up`, `down`, `status`, `doctor`, `smoke`, `cut-release`
- [ ] 1.6 **[TODAY]** Root `README.md` with the "Less Search, More Agents" messaging and the curl-install hero block

## 2. Core orchestrator — `packages/core` (delegable)

- [ ] 2.1 **[TODAY]** Structured logger: JSON-lines `{ts,level,component,run_id?,agent_id?,code,msg}` + pretty printer; failing test first
- [ ] 2.2 **[TODAY]** Typed component status surface + numeric code registry; test enumerates known codes
- [ ] 2.3 **[TODAY]** Run/session/task model (in-memory store + interface) with state machine (`pending|running|waiting_approval|succeeded|failed|cancelled`); failing tests for transitions
- [ ] 2.4 **[P2]** Concurrent supervisor: launch N agent sessions as child processes, track exit codes, emit lifecycle events
- [ ] 2.5 **[P2]** Approval gate: pause → emit request → resume on allow/deny, recorded as audit event
- [ ] 2.6 **[P2]** Agent registry backed by `unified-memory` (id, kind, command, env-readiness)

## 3. Gateway / control plane — `packages/gateway` (delegable)

- [ ] 3.1 **[TODAY]** HTTP server with `GET /health` (200 + version + uptime); failing test first
- [ ] 3.2 **[TODAY]** `GET /status` aggregating component statuses from `core`; test covers a down dependency → `degraded`
- [ ] 3.3 **[TODAY]** WS/SSE event stream endpoint; test: subscribe → receive a `run.started` event
- [ ] 3.4 **[P2]** Run control endpoints (`POST /runs`, `GET /runs/:id`, approval decisions)
- [ ] 3.5 **[P2]** Serve the built WebUI as static assets

## 4. Mission-control WebUI — `packages/webui` (delegable)

- [ ] 4.1 **[TODAY]** Monochrome dashboard shell (design.md tokens) rendering `GET /status`; responsive
- [ ] 4.2 **[TODAY]** Live event subscription rendering run/session/log lines
- [ ] 4.3 **[P2]** Approval cards (allow/deny → gateway)
- [ ] 4.4 **[P2]** Terminal pane (rmux) and session detail view

## 5. CLI — `packages/cli` (delegable)

- [ ] 5.1 **[TODAY]** `lesearch` binary (bun) with `up|down|status|logs|doctor|uninstall|--version`; status enum → exit codes; failing tests for arg parsing + exit codes
- [ ] 5.2 **[TODAY]** `doctor`: docker daemon reachable, ports free, install dir writable → typed report
- [ ] 5.3 **[TODAY]** `up`/`down` wrap `docker compose` over the core profile
- [ ] 5.4 **[TODAY]** `uninstall` with `--keep-config|--keep-data|--dry-run|--force`; dry-run test asserts no mutation

## 6. Inference — `packages/inference` (delegable)

- [ ] 6.1 **[TODAY]** `InferenceBackend` interface (`load|generate|embed|health`) + uniform typed health; failing tests
- [ ] 6.2 **[TODAY]** `ollama` adapter (host ollama detected → `ok`, absent → `not_configured`)
- [ ] 6.3 **[P2]** `llama.cpp` adapter running a GGUF model on CPU
- [ ] 6.4 **[P2]** Model registry + download/verify helper

## 7. Memory / Postgres — `packages/memory` + migrations (delegable)

- [ ] 7.1 **[TODAY]** Init migration: enable `vector`; tables for working memory (UNLOGGED), `memories` (embedding), skills/hooks/rules registry
- [ ] 7.2 **[TODAY]** Memory client: write/read working memory scoped by run_id/agent_id; failing tests against a test Postgres
- [ ] 7.3 **[P2]** Vector similarity recall (HNSW index + query)
- [ ] 7.4 **[P2]** `LISTEN/NOTIFY` coordination helper + skills/hooks/rules CRUD

## 8. Packaging & infra (owner: lead)

- [ ] 8.1 **[TODAY]** `docker-compose.yml` core profile (gateway, postgres+pgvector, webui) + optional profiles (`tunnel|ssh|vnc|inference|sandbox`)
- [ ] 8.2 **[TODAY]** Dockerfiles per service (multi-stage, slim)
- [ ] 8.3 **[TODAY]** `install.sh` (uname detect → fetch → minisign+SHA verify → install; prints telemetry notice) and `uninstall.sh`
- [ ] 8.4 **[TODAY]** Smoke test: `docker compose up` → poll `/health` and `/status` → assert `ok`; tear down
- [ ] 8.5 **[P2]** Release pipeline: minisign-signed manifest + B3SUMS; `cut-release`
- [ ] 8.6 **[P2]** Enterprise track stub: `deploy/k8s/` Helm skeleton (documented, not wired)

## 9. Telemetry & analytics — `packages/telemetry` (delegable)

- [ ] 9.1 **[TODAY]** PostHog client: anonymous install id, event allowlist, `LESEARCH_TELEMETRY=0` disables; test asserts payload carries no code/secrets
- [ ] 9.2 **[P2]** Wire feature + health events across gateway/cli; dashboard of "what's used"

## 10. Shared skills & agent wiring (owner: lead)

- [ ] 10.1 **[TODAY]** `skills/` dir + bootstrap symlinks into `.claude/.codex/.gemini`; root `AGENTS.md` rule "load the relevant skill before writing code"
- [ ] 10.2 **[P2]** Seed skills: `dev-*`, `build-*`, `meta-*`

## 11. Verification gate (owner: lead, closes the change)

- [ ] 11.1 **[TODAY]** `just test` green across all packages
- [ ] 11.2 **[TODAY]** `just smoke` green (compose up → health/status ok → down)
- [ ] 11.3 **[TODAY]** WebUI reachable locally; screenshot evidence captured
- [ ] 11.4 **[P2]** Tunnel profile yields a reachable cross-device URL; evidence captured
