## Why

Capable coding agents ship every week — Claude Code, Codex, Gemini CLI, OpenCode, Amp, OpenClaw, Hermes — but they have no shared home. Each reinvents the same scaffolding (a runner, a log, a memory, an approval prompt) and none of it is portable, inspectable, or reachable from your phone. A developer who wants to run *several* agents at once, watch them, gate what they do, and remember what they learned has to wire it up by hand every time.

LeSearch — **"Less Search, More Agents"** — is that shared home: a personal software factory you install with one command and run as one lightweight container stack. It is the control plane that runs, watches, gates, and remembers agents, with a mission-control WebUI reachable from any device.

## What Changes

- **New repo, new version.** A clean polyglot monorepo (`~/Projects/lesearch`) under spec-driven + test-driven development. Supersedes the scattered `lesearch-ai` variants as the shippable product line.
- **One install, one uninstall.** `curl … | sh` installs a thin `lesearch` CLI; `lesearch up` boots the stack via `docker compose`; `lesearch uninstall` removes it cleanly. Uninstall is a first-class command, not a docs paragraph.
- **Everything is a package with status codes + structured logs.** Every package exposes a typed health/status surface so agents (and humans) can introspect exactly what exists and what doesn't.
- **One Postgres (pgvector) for everything stateful** — short- and long-term memory, plus skills, hooks, and rules. No Redis, no separate vector DB.
- **Modular CPU inference.** A GGUF inference library with swappable adapters (llama.cpp, ollama) so any machine can run models with no GPU.
- **Remote access built in.** cloudflared tunnel + rmux terminal today; SSH + VNC (noVNC) behind compose profiles.
- **Anonymous, opt-in usage analytics** (PostHog) to learn which features are used.
- Enterprise Kubernetes packaging is acknowledged as a **future, separate track** — explicitly out of scope here.

## Capabilities

### New Capabilities
- `packaging-install`: single-command install/uninstall, the `docker compose` stack, versioned JSON schemas, and a `doctor` preflight — the deployment surface.
- `control-plane`: the gateway HTTP/WS API — health, status, the run/session lifecycle, and a live event stream, with explicit status codes and structured logs.
- `agent-orchestration`: registering, launching, and supervising multiple agents concurrently under a run → session → task model.
- `unified-memory`: one Postgres+pgvector schema holding working memory, long-term vector memory, and the skills/hooks/rules registry.
- `cpu-inference`: a modular library that runs GGUF models on CPU through swappable backend adapters.
- `mission-control-ui`: the monochrome WebUI for watching agents, sessions, logs, and approvals from any device.
- `connectivity`: remote reach — cloudflared tunnel, rmux terminal, SSH, and VNC — cross-OS and cross-device.
- `usage-analytics`: anonymous, opt-in telemetry that reports feature usage and health, never code or secrets.

### Modified Capabilities
- _(none — greenfield repo)_

## Non-goals

- **No enterprise Kubernetes/Helm packaging now.** Designed for it (stateless services, one stateful Postgres), built later.
- **No hardware VMs / hypervisor isolation.** Containers only; gVisor is an optional runtime, never required.
- **No GPU requirement.** CPU-first inference is the baseline; GPU is an optional accelerator.
- **No cloud-hosted multi-tenant SaaS.** Self-hosted, single-user / small-team is the target.
- **Not rebuilding the agents themselves.** LeSearch orchestrates existing agent CLIs; it does not replace them.

## Impact

- New repository and toolchain: TypeScript (bun/pnpm) for CLI, core, gateway, WebUI, proto; Rust/Python reserved for phase 2.
- New infrastructure: `docker-compose.yml` (gateway, postgres+pgvector, webui; optional profiles for tunnel/ssh/vnc/inference).
- New contracts: versioned JSON Schemas in `schemas/` consumed by all packages.
- External services: cloudflared (tunnel), PostHog (opt-in analytics), ollama/llama.cpp (inference).
- Supersedes `lesearch-ai` as the product line; design tokens (monochrome `design.md`) carry over.
