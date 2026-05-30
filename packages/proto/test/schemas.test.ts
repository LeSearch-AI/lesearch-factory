import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RunSchema, MemorySchema, TelemetryEventSchema } from "../src/contracts";

const SCHEMA_DIR = join(import.meta.dir, "../../../schemas");

describe("versioned JSON schemas", () => {
  const files = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".schema.json"));

  test("all four v1 contracts are present", () => {
    expect(files.sort()).toEqual(
      [
        "lesearch.memory.v1.schema.json",
        "lesearch.run.v1.schema.json",
        "lesearch.status.v1.schema.json",
        "lesearch.telemetry.v1.schema.json",
      ].sort(),
    );
  });

  test("each schema is valid JSON with $id, $schema, title, and a version in the filename", () => {
    for (const f of files) {
      const raw = JSON.parse(readFileSync(join(SCHEMA_DIR, f), "utf8"));
      expect(raw.$schema).toBeString();
      expect(raw.$id).toContain(f.replace(".json", ""));
      expect(raw.title).toBeString();
      expect(f).toMatch(/\.v\d+\.schema\.json$/);
    }
  });
});

describe("zod validators accept conforming sample payloads", () => {
  test("Run", () => {
    const run = {
      run_id: "run_1",
      objective: "test",
      state: "running",
      created_at: new Date().toISOString(),
      sessions: [{ agent_id: "a1", kind: "codex", state: "running", exit_code: null, tasks: [] }],
    };
    expect(() => RunSchema.parse(run)).not.toThrow();
  });

  test("Memory", () => {
    const mem = {
      id: "m1",
      kind: "working",
      run_id: "run_1",
      agent_id: "a1",
      content: "scratch",
      embedding: null,
      ttl_s: 600,
      created_at: new Date().toISOString(),
    };
    expect(() => MemorySchema.parse(mem)).not.toThrow();
  });

  test("TelemetryEvent rejects unknown top-level keys (no leakage surface)", () => {
    const ok = { install_id: "u1", event: "stack.up", ts: new Date().toISOString() };
    expect(() => TelemetryEventSchema.parse(ok)).not.toThrow();
    const leaky = { ...ok, source_code: "secret()" };
    expect(() => TelemetryEventSchema.parse(leaky)).toThrow();
  });
});
