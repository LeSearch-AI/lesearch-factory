## Context

Greenfield repo `~/Projects/lesearch`. The product is a self-hosted, single-user/small-team control plane for running many coding agents at once. Prior art researched (`lesearch-ai/docs/architecture-synthesis.md`): take *ideas* from capsem (install verify chain, shared skills, versioned schemas, per-session telemetry), clawpatrol (L7 wire-fact gating model), and opencode (monochrome design, curl-install, first-class uninstall) — skip their heavy infra (hardware VMs, k8s, Slack approvals).

The bias is ruthless lightness: one `docker compose up`, no GPU, one stateful service. Everything else is a stateless TypeScript package with a typed health surface so agents can introspect the system.

## Goals / Non-Goals

**Goals:**
- One curl install + one `docker compose up` boots a working stack on macOS or Linux.
- Every package answers "what works / what doesn't" through a typed status surface and structured logs.
- Run several agents concurrently, watch them in a monochrome WebUI, reach them from any device.
- One Postgres (pgvector) for all state: memory, skills, hooks, rules.
- CPU-only inference of GGUF models through swappable adapters.
- Test-driven: failing test first, minimal implementation, green.

**Non-Goals:**
- Kubernetes/Helm packaging (future track; design for it, don't build it).
- Hardware-VM isolation, GPU requirement, multi-tenant SaaS.
- Reimplementing agent CLIs.

## Decisions

1. **Monorepo, TypeScript-first.** `packages/{proto,core,gateway,webui,cli,inference}` as bun/pnpm workspaces. Rust/Python reserved for phase-2 hot paths. Resolves the prior "monorepo vs multi-repo" question in favor of monorepo.
2. **Plain hardened container is the default agent runtime; gVisor (`runsc`) is an opt-in compose profile.** Lightness wins for personal use; the isolation upgrade is one flag away. Resolves the "gVisor default vs opt-in" question toward opt-in.
3. **One Postgres + pgvector.** Working memory in `UNLOGGED` tables; long-term memory as `vector` embeddings (HNSW); skills/hooks/rules as registry tables; coordination via `LISTEN/NOTIFY`. No Redis, no Qdrant.
4. **Versioned JSON Schemas are the contract.** `schemas/lesearch.<domain>.vN.schema.json`; the `proto` package generates zod validators + TS types from them. One source of truth across every package.
5. **Typed status everywhere.** A component reports one of `ok | degraded | unavailable | not_configured | unknown` plus a numeric code; the gateway aggregates these into `GET /status`. CLI maps the same enum to process exit codes. This is the "what we have / what we don't" surface.
6. **Structured logs.** JSON-lines: `{ts, level, component, run_id?, agent_id?, code, msg, ...fields}`. Human pretty-printer in the CLI; raw JSONL on disk and to the gateway event stream.
7. **Compose profiles for optional reach.** Core profile: gateway + postgres + webui. Optional profiles: `tunnel` (cloudflared), `ssh` (sshd), `vnc` (noVNC), `inference` (llama.cpp/ollama), `sandbox` (gVisor runtime). Users enable only what they need.
8. **Telemetry is opt-in and anonymous.** PostHog, capability/health events only — never code, prompts, or secrets. A single env flag disables it; install prints the notice.
9. **TLS interception / policy CEL engine deferred to phase 2.** v1 gating is structural (allow/deny on typed facts) in TypeScript; prefer the OpenZiti SDK boundary over a host CA when we add deep inspection; no Go (cel-go) until a concrete need. Resolves the prior two open questions as "phase 2, documented."

## Risks / Trade-offs

- **Scope vs. one day.** Mitigation: ship the install→compose→WebUI→status spine end-to-end today; spec-and-stub the heavier capabilities (full orchestration, llama.cpp adapter, SSH/VNC, gVisor) and delegate them to parallel agents against the frozen schema contract.
- **Plain container < VM isolation.** Accepted for personal use; gVisor profile and a documented Firecracker/Kata path cover users who need more.
- **Docker Desktop dependency on macOS.** Accepted; the binary detects Docker and `doctor` reports it clearly rather than failing opaquely.
- **pgvector at scale.** Fine for personal/small-team; the schema is RLS-ready and shardable if the enterprise track ever needs it.
