## ADDED Requirements

### Requirement: Single Postgres with pgvector
The system SHALL use one Postgres instance with the `pgvector` extension as the sole stateful store for memory, skills, hooks, and rules. It SHALL NOT require Redis or a separate vector database.

#### Scenario: Stack starts with one stateful service
- **WHEN** the core stack starts
- **THEN** exactly one database container (`pgvector/pgvector`) is present and the `vector` extension is enabled by an init migration

### Requirement: Short-term working memory
The system SHALL store per-agent working memory (scratchpad, rolling messages, shared blackboard) scoped by `run_id` and `agent_id`, in `UNLOGGED` tables, with TTL-based pruning.

#### Scenario: Working memory is scoped and prunable
- **WHEN** two agents in the same run write working memory
- **THEN** each row carries the writing `agent_id` and the shared `run_id`, and expired rows are removed by the prune routine

### Requirement: Long-term vector memory
The system SHALL store long-term memories as text plus an embedding `vector`, indexed for approximate nearest-neighbor search, enabling semantic recall.

#### Scenario: Semantic recall
- **WHEN** a memory is stored with its embedding and a similarity query is run with a query embedding
- **THEN** the most similar stored memories are returned ordered by distance

### Requirement: Skills, hooks, and rules registry
The system SHALL store skills, hooks, and rules as first-class registry rows that the orchestrator can list and the gateway can serve, so the factory's behavior is data, not hard-coded.

#### Scenario: List installed skills
- **WHEN** a client requests the skills registry
- **THEN** the stored skills are returned with id, name, and enabled flag

### Requirement: Multi-agent coordination
The system SHALL provide live cross-agent coordination via Postgres `LISTEN/NOTIFY` channels scoped per run, requiring no external message broker.

#### Scenario: Agents coordinate over a run channel
- **WHEN** one agent publishes to a run's channel and another is listening
- **THEN** the listening agent receives the notification without any broker beyond Postgres
