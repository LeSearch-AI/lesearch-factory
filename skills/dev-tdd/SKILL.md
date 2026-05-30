---
name: dev-tdd
description: The LeSearch test-driven workflow. Load before writing any package code.
---
# dev-tdd

1. Read the capability spec in `openspec/changes/bootstrap-lesearch-factory/specs/<capability>/spec.md`.
2. Write the failing test (`bun test`). Confirm it fails for the right reason.
3. Write the minimal implementation to green.
4. Import shared types from `@lesearch/proto`. Never redefine a status or schema.
5. Emit a typed `makeReport(...)` health and JSON-lines logs from your component.
6. Stay inside your `packages/<name>/` dir.
