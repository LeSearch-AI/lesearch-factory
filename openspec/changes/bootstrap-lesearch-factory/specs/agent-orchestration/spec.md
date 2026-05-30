## ADDED Requirements

### Requirement: Agent registry
The system SHALL maintain a registry of agent definitions (id, kind, command, env requirements) so that multiple distinct agents (e.g. Claude Code, Codex, Gemini CLI) can be launched by the orchestrator.

#### Scenario: Register and list agents
- **WHEN** an agent definition is registered and a client lists agents
- **THEN** the registered agent appears with its id, kind, and a `ready | not_configured` status reflecting whether its required env/credentials are present

### Requirement: Run / session / task model
The orchestrator SHALL model work as a `run` (a top-level objective) containing one or more `sessions` (one per agent instance) each containing `tasks`, all identified by stable ids and persisted.

#### Scenario: Start a run with multiple agents
- **WHEN** a run is started naming two agents
- **THEN** two sessions are created under one `run_id`, each with its own `agent_id`, and both are observable via the status and event surfaces

### Requirement: Concurrent supervision
The orchestrator SHALL supervise multiple agent sessions concurrently, tracking each session state (`pending | running | waiting_approval | succeeded | failed | cancelled`) and surfacing transitions as events.

#### Scenario: One session fails, others continue
- **WHEN** three sessions run concurrently and one exits non-zero
- **THEN** that session transitions to `failed` with its exit code while the others continue, and a `session.failed` event is emitted

### Requirement: Approval gating hook
The orchestrator SHALL support an approval gate: a session may enter `waiting_approval`, emit an approval request event, and resume only after an explicit allow/deny decision.

#### Scenario: Approval required and granted
- **WHEN** a session requests approval and a client sends an allow decision for that request id
- **THEN** the session resumes and the decision is recorded as an auditable event
