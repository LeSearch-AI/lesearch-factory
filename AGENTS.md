# AGENTS.md — operating contract for LeSearch

LeSearch is built **spec-driven** (openspec) and **test-driven**. Read this before writing code.

## Golden rules

1. **The spec is the source of truth.** `openspec/changes/bootstrap-lesearch-factory/` holds the proposal, design, specs, and tasks. Build to the spec; if reality diverges, update the spec.
2. **The contract is frozen in `@lesearch/proto`.** Status enum, numeric codes, exit-code mapping, and zod validators live in `packages/proto`, mirroring `schemas/lesearch.*.vN.schema.json`. Import from `@lesearch/proto` — never redefine a status or a schema.
3. **Test first.** Write the failing test, confirm it fails for the right reason, then the minimal implementation. `bun test` is the runner. No package is "done" without green tests.
4. **Status + logs everywhere.** Every component exposes a typed health (`makeReport`) and emits JSON-lines logs `{ts,level,component,run_id?,agent_id?,code,msg}`. This is how the system tells agents what works and what doesn't.
5. **Stay in your package.** When delegated a package, edit only `packages/<your-package>/`. Do not touch root files, `schemas/`, or other packages' source — depend on `@lesearch/proto` for shared types.
6. **Lightweight.** Containers not VMs, one Postgres for all state, CPU-first, no GPU requirement. Prefer bun/standard-lib over heavy deps.

## Toolchain

- Runtime/package manager: **bun** (`bun test`, `bun install`). TypeScript throughout.
- Commands: **`just`** (`just test`, `just up`, `just smoke`, `just doctor`).
- Specs: **`openspec`** (`openspec validate`, `openspec status`).

## Skills

Shared agent skills live in `skills/` and are symlinked into `.claude/`, `.codex/`, `.gemini/`.
**Load the relevant skill before writing code.**
