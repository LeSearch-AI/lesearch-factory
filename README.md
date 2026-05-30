<div align="center">

# LeSearch

### Less Search, More Agents.

A personal software factory for AI coding agents.
Run many at once, watch them, gate what they do, and remember what they learn —
in one lightweight container stack you reach from any device.

</div>

---

```sh
curl -fsSL https://lesearch.ai/install | sh
lesearch up
```

That's it. One install, one command, a mission-control WebUI at `http://localhost:7777`.

## Why

Capable agents ship every week — Claude Code, Codex, Gemini CLI, OpenCode, Amp, OpenClaw, Hermes. They all reinvent the same scaffolding (a runner, a log, a memory, an approval prompt) and none of it is portable, inspectable, or reachable from your phone.

LeSearch is the shared home: the control plane that **runs, watches, gates, and remembers** your agents.

## What you get

- **One stack.** `docker compose up` — gateway, Postgres (pgvector), mission-control WebUI. No GPU, no VM, no Redis, no separate vector DB.
- **Status you can trust.** Every component reports a typed health (`ok · degraded · unavailable · not_configured · unknown`) and a numeric code. You always know what's working and what isn't.
- **Multi-agent orchestration.** A run → session → task model supervises several agents at once, with approval gating.
- **One memory.** Short-term working memory, long-term semantic recall, and the skills/hooks/rules registry — all in one Postgres.
- **Reach from anywhere.** cloudflared tunnel + rmux terminal built in; SSH and VNC behind compose profiles.
- **CPU inference.** Run GGUF models with no GPU through swappable adapters (ollama, llama.cpp).
- **First-class uninstall.** `lesearch uninstall` removes everything cleanly. A privacy-first tool earns trust by leaving cleanly.

## Status

Pre-release. Built spec-driven (see `openspec/`) and test-driven. Today's spine: contract + status surface + control plane + WebUI + compose. Heavier capabilities are specced and landing fast.

## Layout

```
packages/proto      shared contract: status enum, codes, zod validators
packages/core       orchestrator: logger, status, run/session/task model
packages/gateway    control plane: /health, /status, event stream
packages/webui      monochrome mission control
packages/cli        the `lesearch` binary
packages/inference  modular GGUF CPU inference
packages/memory     Postgres + pgvector client & migrations
packages/telemetry  anonymous, opt-in usage analytics
schemas/            versioned JSON Schemas (the cross-language contract)
openspec/           specs & change proposals (source of truth)
```

## Develop

```sh
just install   # bun install
just test      # full suite
just up        # boot the stack
just smoke     # compose up -> health/status ok -> down
```

LeSearch is open source. Anonymous usage analytics are on by default to learn what's used; disable with `LESEARCH_TELEMETRY=0`.
