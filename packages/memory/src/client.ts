import { SQL } from "bun";
import {
  MemorySchema,
  makeReport,
  type ComponentReport,
  type Memory,
} from "../../proto/src/index.ts";

export type SqlExecutor = (sql: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

type WorkingMemoryInput = {
  id: string;
  run_id: string;
  agent_id: string;
  content: string;
  ttl_s?: number | null;
};

type WorkingScope = {
  run_id: string;
  agent_id: string;
};

type RegistryListItem = {
  id: string;
  name: string;
  enabled: boolean;
};

type RegistryWriteInput = {
  id: string;
  name: string;
  enabled: boolean;
  definition?: unknown;
};

export class MemoryClient {
  constructor(private readonly execute: SqlExecutor) {}

  async writeWorking(memory: WorkingMemoryInput): Promise<Memory> {
    const rows = await this.execute(
      `
        INSERT INTO working_memory (id, run_id, agent_id, content, ttl_s)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, run_id, agent_id, content, ttl_s, created_at
      `,
      [memory.id, memory.run_id, memory.agent_id, memory.content, memory.ttl_s ?? null],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("writeWorking insert returned no row");
    }

    return parseWorkingMemoryRow(row);
  }

  async readWorking(scope: WorkingScope): Promise<Memory[]> {
    const rows = await this.execute(
      `
        SELECT id, run_id, agent_id, content, ttl_s, created_at
        FROM working_memory
        WHERE run_id = $1 AND agent_id = $2
        ORDER BY created_at DESC
      `,
      [scope.run_id, scope.agent_id],
    );

    return rows.map((row) => parseWorkingMemoryRow(row));
  }

  async pruneExpired(): Promise<number> {
    // Rows without ttl_s are durable working entries and must never be pruned.
    const rows = await this.execute(
      `
        DELETE FROM working_memory
        WHERE ttl_s IS NOT NULL
          AND created_at + (ttl_s * INTERVAL '1 second') < now()
        RETURNING id
      `,
      [],
    );

    return rows.length;
  }

  async listSkills(): Promise<RegistryListItem[]> {
    const rows = await this.execute(
      `
        SELECT id, name, enabled
        FROM skills
        ORDER BY created_at DESC
      `,
      [],
    );

    return rows.map((row) => ({
      id: readRequiredString(row, "id"),
      name: readRequiredString(row, "name"),
      enabled: readRequiredBoolean(row, "enabled"),
    }));
  }

  async health(): Promise<ComponentReport> {
    try {
      await this.execute("SELECT 1", []);
      return makeReport("postgres", "ok");
    } catch (error: unknown) {
      return makeReport("postgres", "unavailable", {
        detail: errorMessage(error),
      });
    }
  }

  // TODO(task 7.3): implement vector similarity recall in phase 2.
  async recall(): Promise<never> {
    throw new Error("not implemented (phase 2 - task 7.3)");
  }

  // TODO(task 7.4): implement LISTEN/NOTIFY coordination in phase 2.
  async coordinate(): Promise<never> {
    throw new Error("not implemented (phase 2 - task 7.4)");
  }

  // TODO(task 7.4): implement skills CRUD writers in phase 2.
  async writeSkill(_skill: RegistryWriteInput): Promise<never> {
    throw new Error("not implemented (phase 2 - task 7.4)");
  }

  // TODO(task 7.4): implement hooks CRUD writers in phase 2.
  async writeHook(_hook: RegistryWriteInput): Promise<never> {
    throw new Error("not implemented (phase 2 - task 7.4)");
  }

  // TODO(task 7.4): implement rules CRUD writers in phase 2.
  async writeRule(_rule: RegistryWriteInput): Promise<never> {
    throw new Error("not implemented (phase 2 - task 7.4)");
  }
}

export function fromConnectionString(connectionString?: string): MemoryClient {
  const resolvedConnectionString =
    connectionString ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

  if (!resolvedConnectionString || resolvedConnectionString.trim() === "") {
    throw new Error("Missing Postgres connection string. Set DATABASE_URL or POSTGRES_URL.");
  }

  const sql = new SQL(resolvedConnectionString);
  const executor: SqlExecutor = async (query, params) => {
    const rows = await sql.unsafe(query, params);
    return rows as unknown as Record<string, unknown>[];
  };

  return new MemoryClient(executor);
}

function parseWorkingMemoryRow(row: Record<string, unknown>): Memory {
  const candidate: Record<string, unknown> = {
    ...row,
    kind: "working",
    embedding: null,
    created_at: normalizeCreatedAt(row.created_at),
  };

  try {
    return MemorySchema.parse(candidate);
  } catch (error: unknown) {
    throw new Error(
      `Invalid working memory row: ${serializeValue(candidate)}; validation=${formatValidationError(error)}`,
    );
  }
}

function normalizeCreatedAt(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function readRequiredString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value === "string") {
    return value;
  }

  throw new Error(`Invalid skills row field "${field}": ${serializeValue(row)}`);
}

function readRequiredBoolean(row: Record<string, unknown>, field: string): boolean {
  const value = row[field];
  if (typeof value === "boolean") {
    return value;
  }

  throw new Error(`Invalid skills row field "${field}": ${serializeValue(row)}`);
}

function formatValidationError(error: unknown): string {
  if (typeof error === "object" && error !== null && "issues" in error) {
    const issues = (error as { issues: unknown }).issues;
    return serializeValue(issues);
  }

  return errorMessage(error);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function serializeValue(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, currentValue) => {
      if (currentValue instanceof Date) {
        return currentValue.toISOString();
      }

      return currentValue;
    });
  } catch {
    return String(value);
  }
}
