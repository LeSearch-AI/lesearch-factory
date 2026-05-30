## ADDED Requirements

### Requirement: Health endpoint
The gateway SHALL expose `GET /health` returning HTTP 200 with `{status: "ok", version, uptime_s}` when the process is live, independent of downstream dependencies.

#### Scenario: Process is live
- **WHEN** a client calls `GET /health`
- **THEN** the gateway returns 200 with a body whose `status` is `"ok"` and includes `version` and `uptime_s`

### Requirement: Aggregated status surface
The gateway SHALL expose `GET /status` that aggregates the health of every known component (postgres, inference, tunnel, each registered agent) as one of `ok | degraded | unavailable | not_configured | unknown` plus a numeric code, so callers can introspect what is and is not working.

#### Scenario: A dependency is down
- **WHEN** Postgres is unreachable and a client calls `GET /status`
- **THEN** the response lists the `postgres` component with status `unavailable` and a non-zero code, and the overall status is `degraded`

#### Scenario: An optional component is not configured
- **WHEN** the cloudflared tunnel is not enabled and a client calls `GET /status`
- **THEN** the `tunnel` component is reported as `not_configured`, never as an error

### Requirement: Live event stream
The gateway SHALL expose a WebSocket (or SSE) endpoint that streams structured events (run/session/task lifecycle, log lines, approval requests) to subscribed clients.

#### Scenario: Client subscribes to events
- **WHEN** a client subscribes to the event stream and an agent run starts
- **THEN** the client receives a `run.started` event carrying the `run_id` and timestamp

### Requirement: Structured logging
Every gateway response and internal event SHALL be recorded as a JSON-lines log entry `{ts, level, component, run_id?, agent_id?, code, msg}`.

#### Scenario: Request is logged
- **WHEN** any HTTP request is handled
- **THEN** a JSON-lines entry is written with the component, a numeric code, and the message
