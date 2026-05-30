import { beforeEach, describe, expect, test } from "bun:test";
import { MemorySchema } from "../../proto/src/index.ts";
import {
  fromConnectionString,
  MemoryClient,
  type SqlExecutor,
} from "../src/client.ts";

type WorkingRow = {
  id: string;
  run_id: string;
  agent_id: string;
  content: string;
  ttl_s: number | null;
  created_at: Date;
};

type SkillRow = {
  id: string;
  name: string;
  enabled: boolean;
};

function createFakeExecutor(options: { failHealth?: boolean; invalidReadRow?: Record<string, unknown> } = {}) {
  const workingRows: WorkingRow[] = [];
  const skills: SkillRow[] = [{ id: "skill-1", name: "planner", enabled: true }];

  const executor: SqlExecutor = async (sql, params) => {
    const normalizedSql = sql.replace(/\s+/g, " ").trim().toLowerCase();

    if (normalizedSql.startsWith("insert into working_memory")) {
      const row: WorkingRow = {
        id: expectStringParam(params[0]),
        run_id: expectStringParam(params[1]),
        agent_id: expectStringParam(params[2]),
        content: expectStringParam(params[3]),
        ttl_s: expectNullableNumberParam(params[4]),
        created_at: new Date(),
      };
      workingRows.push(row);
      return [row];
    }

    if (normalizedSql.startsWith("select id, run_id, agent_id, content, ttl_s, created_at from working_memory")) {
      if (options.invalidReadRow) {
        return [options.invalidReadRow];
      }

      const runId = expectStringParam(params[0]);
      const agentId = expectStringParam(params[1]);
      return workingRows
        .filter((row) => row.run_id === runId && row.agent_id === agentId)
        .sort((left, right) => right.created_at.getTime() - left.created_at.getTime());
    }

    if (normalizedSql.startsWith("delete from working_memory")) {
      const now = Date.now();
      const survivors: WorkingRow[] = [];
      const deleted: Array<Record<string, unknown>> = [];

      for (const row of workingRows) {
        if (row.ttl_s !== null && row.created_at.getTime() + row.ttl_s * 1000 < now) {
          deleted.push({ id: row.id });
          continue;
        }
        survivors.push(row);
      }

      workingRows.splice(0, workingRows.length, ...survivors);
      return deleted;
    }

    if (normalizedSql.startsWith("select id, name, enabled from skills")) {
      return skills;
    }

    if (normalizedSql === "select 1") {
      if (options.failHealth) {
        throw new Error("database offline");
      }
      return [{ "?column?": 1 }];
    }

    throw new Error(`Unhandled SQL in fake executor: ${sql}`);
  };

  return {
    executor,
    seedWorking(row: WorkingRow) {
      workingRows.push(row);
    },
  };
}

function expectStringParam(value: unknown): string {
  expect(typeof value).toBe("string");
  return value as string;
}

function expectNullableNumberParam(value: unknown): number | null {
  expect(value === null || typeof value === "number" || typeof value === "undefined").toBe(true);
  return typeof value === "number" ? value : null;
}

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalPostgresUrl = process.env.POSTGRES_URL;

beforeEach(() => {
  process.env.DATABASE_URL = originalDatabaseUrl;
  process.env.POSTGRES_URL = originalPostgresUrl;
});

describe("MemoryClient", () => {
  test("writeWorking then readWorking returns only the scoped working row", async () => {
    const fake = createFakeExecutor();
    const client = new MemoryClient(fake.executor);

    const written = await client.writeWorking({
      id: "mem-1",
      run_id: "run-1",
      agent_id: "agent-1",
      content: "remember this",
      ttl_s: 60,
    });

    await client.writeWorking({
      id: "mem-2",
      run_id: "run-2",
      agent_id: "agent-2",
      content: "different scope",
      ttl_s: 60,
    });

    const rows = await client.readWorking({ run_id: "run-1", agent_id: "agent-1" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(written);
  });

  test("working rows include run_id, agent_id, and kind working", async () => {
    const fake = createFakeExecutor();
    const client = new MemoryClient(fake.executor);

    await client.writeWorking({
      id: "mem-1",
      run_id: "run-1",
      agent_id: "agent-1",
      content: "remember this",
      ttl_s: 90,
    });

    const rows = await client.readWorking({ run_id: "run-1", agent_id: "agent-1" });

    expect(rows[0]?.run_id).toBe("run-1");
    expect(rows[0]?.agent_id).toBe("agent-1");
    expect(rows[0]?.kind).toBe("working");
  });

  test("pruneExpired deletes only expired rows with ttl_s set", async () => {
    const fake = createFakeExecutor();
    fake.seedWorking({
      id: "expired",
      run_id: "run-1",
      agent_id: "agent-1",
      content: "old",
      ttl_s: 1,
      created_at: new Date(Date.now() - 10_000),
    });
    fake.seedWorking({
      id: "persistent",
      run_id: "run-1",
      agent_id: "agent-1",
      content: "keep",
      ttl_s: null,
      created_at: new Date(Date.now() - 10_000),
    });
    fake.seedWorking({
      id: "fresh",
      run_id: "run-1",
      agent_id: "agent-1",
      content: "new",
      ttl_s: 60,
      created_at: new Date(),
    });
    const client = new MemoryClient(fake.executor);

    const deletedCount = await client.pruneExpired();
    const rows = await client.readWorking({ run_id: "run-1", agent_id: "agent-1" });

    expect(deletedCount).toBe(1);
    expect(rows.map((row) => row.id).sort()).toEqual(["fresh", "persistent"]);
  });

  test("listSkills returns id, name, and enabled", async () => {
    const fake = createFakeExecutor();
    const client = new MemoryClient(fake.executor);

    await expect(client.listSkills()).resolves.toEqual([{ id: "skill-1", name: "planner", enabled: true }]);
  });

  test("health returns ok when select 1 succeeds", async () => {
    const fake = createFakeExecutor();
    const client = new MemoryClient(fake.executor);

    const report = await client.health();

    expect(report.component).toBe("postgres");
    expect(report.status).toBe("ok");
    expect(report.code).toBe(0);
  });

  test("health returns unavailable with detail when executor throws", async () => {
    const fake = createFakeExecutor({ failHealth: true });
    const client = new MemoryClient(fake.executor);

    const report = await client.health();

    expect(report.status).toBe("unavailable");
    expect(report.detail).toContain("database offline");
  });

  test("representative working-memory row validates against MemorySchema", () => {
    expect(() =>
      MemorySchema.parse({
        id: "mem-1",
        kind: "working",
        run_id: "run-1",
        agent_id: "agent-1",
        content: "remember this",
        embedding: null,
        ttl_s: 60,
        created_at: new Date().toISOString(),
      }),
    ).not.toThrow();
  });

  test("readWorking throws with row context when a returned row is invalid", async () => {
    const fake = createFakeExecutor({
      invalidReadRow: {
        id: "bad-row",
        run_id: "run-1",
        agent_id: "agent-1",
        content: "broken",
        ttl_s: 60,
        created_at: 42,
      },
    });
    const client = new MemoryClient(fake.executor);

    await expect(client.readWorking({ run_id: "run-1", agent_id: "agent-1" })).rejects.toThrow("bad-row");
    await expect(client.readWorking({ run_id: "run-1", agent_id: "agent-1" })).rejects.toThrow("created_at");
  });

  test("phase-2 stubs throw explicit not-implemented errors", async () => {
    const fake = createFakeExecutor();
    const client = new MemoryClient(fake.executor);

    await expect(client.recall()).rejects.toThrow("not implemented");
    await expect(client.coordinate()).rejects.toThrow("not implemented");
    await expect(client.writeSkill({ id: "s1", name: "skill", enabled: true })).rejects.toThrow("not implemented");
    await expect(client.writeHook({ id: "h1", name: "hook", enabled: true })).rejects.toThrow("not implemented");
    await expect(client.writeRule({ id: "r1", name: "rule", enabled: true })).rejects.toThrow("not implemented");
  });
});

describe("fromConnectionString", () => {
  test("throws clearly when no connection string is available", () => {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    expect(() => fromConnectionString()).toThrow("Missing Postgres connection string");
  });
});
