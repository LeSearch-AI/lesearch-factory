import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TelemetryEventSchema } from "../../proto/src/index";
import {
  buildPostHogCaptureBody,
  Telemetry,
} from "../src/index";

describe("@lesearch/telemetry", () => {
  const now = () => "2026-05-30T12:00:00.000Z";
  const testRoot = join(tmpdir(), "lesearch-telemetry-tests");
  let sent: unknown[];
  let installIdPath: string;

  beforeEach(() => {
    sent = [];
    installIdPath = join(testRoot, `install-id-${crypto.randomUUID()}`);
    mkdirSync(testRoot, { recursive: true });
    rmSync(installIdPath, { force: true });
  });

  test("disabled with LESEARCH_TELEMETRY=0 is a no-op", async () => {
    const telemetry = new Telemetry({
      env: { LESEARCH_TELEMETRY: "0" },
      installIdPath,
      now,
      sender: (event) => {
        sent.push(event);
      },
    });

    await telemetry.capture("stack.up");

    expect(sent).toHaveLength(0);
  });

  test("disabled with LESEARCH_TELEMETRY=false is a no-op", async () => {
    const telemetry = new Telemetry({
      env: { LESEARCH_TELEMETRY: "false" },
      installIdPath,
      now,
      sender: (event) => {
        sent.push(event);
      },
    });

    await telemetry.capture("stack.up");

    expect(sent).toHaveLength(0);
  });

  test("allowlisted event builds a strict schema-valid payload", async () => {
    const telemetry = new Telemetry({
      env: {},
      installIdPath,
      now,
      sender: (event) => {
        sent.push(event);
      },
    });

    await telemetry.capture("agent.run", {
      foo: "bar",
      n: 1,
      ok: true,
      nothing: null,
    });

    expect(sent).toHaveLength(1);
    const payload = sent[0] as Record<string, unknown>;
    expect(TelemetryEventSchema.safeParse(payload).success).toBe(true);
    expect(Object.keys(payload).sort()).toEqual(["event", "install_id", "properties", "ts"]);
    expect(payload.install_id).toEqual(expect.any(String));
    expect(payload.event).toBe("agent.run");
    expect(payload.ts).toBe(now());
    expect(payload.properties).toEqual({
      foo: "bar",
      n: 1,
      ok: true,
      nothing: null,
    });
  });

  test("malicious or non-primitive caller input never escapes the schema shape", async () => {
    const telemetry = new Telemetry({
      env: {},
      installIdPath,
      now,
      sender: (event) => {
        sent.push(event);
      },
    });

    const properties = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(properties, "__proto__", { value: "pollute", enumerable: true });
    properties.safe = "value";
    properties.code = "not-top-level";
    properties.secret = "not-top-level";
    properties.apiKey = "not-top-level";
    properties.constructor = "drop-me";
    properties.prototype = "drop-me-too";
    properties.nested = { nope: true };
    properties.list = [1, 2, 3];
    properties.fn = () => "nope";
    properties.missing = undefined;

    await telemetry.capture("agent.run", properties);

    expect(sent).toHaveLength(1);
    const payload = sent[0] as Record<string, unknown>;
    expect(TelemetryEventSchema.safeParse(payload).success).toBe(true);
    expect(payload).not.toHaveProperty("code");
    expect(payload).not.toHaveProperty("secret");
    expect(payload).not.toHaveProperty("apiKey");
    expect(payload).toMatchObject({
      event: "agent.run",
      ts: now(),
      properties: {
        safe: "value",
        code: "not-top-level",
        secret: "not-top-level",
        apiKey: "not-top-level",
      },
    });
    const payloadProperties = payload.properties as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(payloadProperties, "__proto__")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payloadProperties, "constructor")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payloadProperties, "prototype")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payloadProperties, "nested")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payloadProperties, "list")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payloadProperties, "fn")).toBe(false);
  });

  test("non-allowlisted events are dropped without throwing", async () => {
    const telemetry = new Telemetry({
      env: {},
      installIdPath,
      now,
      sender: (event) => {
        sent.push(event);
      },
    });

    await expect(telemetry.capture("totally.not.allowed")).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  test("posthog body builder maps the schema payload to capture API fields", () => {
    const body = buildPostHogCaptureBody(
      {
        install_id: "install-1",
        event: "agent.run",
        ts: now(),
        lesearch_version: "0.0.0",
        properties: {
          foo: "bar",
        },
      },
      "phc_test_key",
    );

    expect(body).toEqual({
      api_key: "phc_test_key",
      event: "agent.run",
      distinct_id: "install-1",
      properties: {
        foo: "bar",
        $process_person_profile: false,
        lesearch_version: "0.0.0",
      },
      timestamp: now(),
    });
  });

  test("default sender no-ops without a PostHog key", async () => {
    const telemetry = new Telemetry({
      env: {},
      installIdPath,
      now,
    });

    await expect(telemetry.capture("stack.up")).resolves.toBeUndefined();
  });

  test("sender failures are swallowed so host callers do not crash", async () => {
    const telemetry = new Telemetry({
      env: {},
      installIdPath,
      now,
      sender: async () => {
        throw new Error("send failed");
      },
    });

    await expect(telemetry.capture("stack.up")).resolves.toBeUndefined();
  });
});
