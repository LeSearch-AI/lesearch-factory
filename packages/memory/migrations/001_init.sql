CREATE EXTENSION IF NOT EXISTS vector;

CREATE UNLOGGED TABLE IF NOT EXISTS working_memory (
  id text PRIMARY KEY,
  run_id text NOT NULL,
  agent_id text NOT NULL,
  content text NOT NULL,
  ttl_s int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_working_memory_run_agent
  ON working_memory (run_id, agent_id);

CREATE TABLE IF NOT EXISTS memories (
  id text PRIMARY KEY,
  run_id text NOT NULL,
  agent_id text NOT NULL,
  content text NOT NULL,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skills (
  id text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  definition jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hooks (
  id text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  definition jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rules (
  id text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  definition jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
