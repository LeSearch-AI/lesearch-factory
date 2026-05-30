# `@lesearch/telemetry`

Anonymous, opt-in PostHog usage analytics for LeSearch.

- Uses an anonymous install id stored at `~/.lesearch/install_id` by default.
- Drops non-allowlisted events and invalid payloads.
- Disables all sends when `LESEARCH_TELEMETRY=0` or `LESEARCH_TELEMETRY=false`.
- Keeps 9.2 as a documented wiring stub only in this phase.
