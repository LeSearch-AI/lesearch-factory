-- Guarantees the demo database has pgvector. App-level tables are owned by
-- packages/memory/migrations/. This only ensures the extension exists.
CREATE EXTENSION IF NOT EXISTS vector;
