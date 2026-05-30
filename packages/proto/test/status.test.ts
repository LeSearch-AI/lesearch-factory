import { describe, expect, test } from "bun:test";
import {
  STATUS_VALUES,
  type ComponentStatus,
  statusCode,
  exitCodeFor,
  makeReport,
  ComponentReportSchema,
} from "../src/status";

describe("status enum", () => {
  test("exposes exactly the five typed statuses", () => {
    expect([...STATUS_VALUES].sort()).toEqual(
      ["degraded", "not_configured", "ok", "unavailable", "unknown"].sort(),
    );
  });

  test("ok maps to numeric code 0; others are non-zero", () => {
    expect(statusCode("ok")).toBe(0);
    for (const s of STATUS_VALUES) {
      if (s !== "ok") expect(statusCode(s)).not.toBe(0);
    }
  });
});

describe("exit code mapping", () => {
  test("ok and not_configured are success exits; unavailable is not", () => {
    expect(exitCodeFor("ok")).toBe(0);
    expect(exitCodeFor("not_configured")).toBe(0);
    expect(exitCodeFor("unavailable")).not.toBe(0);
    expect(exitCodeFor("unknown")).not.toBe(0);
  });
});

describe("makeReport", () => {
  test("builds a report that validates against the v1 schema", () => {
    const r = makeReport("postgres", "unavailable", { hint: "is the db up?" });
    expect(r.component).toBe("postgres");
    expect(r.status).toBe("unavailable");
    expect(r.code).toBe(statusCode("unavailable"));
    expect(typeof r.ts).toBe("string");
    // round-trips through the zod validator without throwing
    expect(() => ComponentReportSchema.parse(r)).not.toThrow();
  });

  test("rejects an invalid status at the validator boundary", () => {
    const bad = { component: "x", status: "broken", code: 9, ts: new Date().toISOString() };
    expect(() => ComponentReportSchema.parse(bad)).toThrow();
  });
});
