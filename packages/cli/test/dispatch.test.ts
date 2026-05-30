import { describe, expect, test } from "bun:test";
import { exitCodeFor } from "@lesearch/proto";
import { runCli } from "../src/cli";
import { createFakeEffects } from "./helpers";

describe("runCli", () => {
  test("returns non-zero for an unknown command", async () => {
    const effects = createFakeEffects();
    const exitCode = await runCli(["boguscmd"], effects);
    expect(exitCode).not.toBe(0);
    expect(effects.errors[0]).toContain("boguscmd");
  });

  test("routes up through docker compose up -d", async () => {
    const effects = createFakeEffects();
    const exitCode = await runCli(["up"], effects);
    expect(exitCode).toBe(0);
    expect(effects.calls).toContainEqual({ kind: "docker.compose", args: ["up", "-d"] });
  });

  test("routes down through docker compose down", async () => {
    const effects = createFakeEffects();
    const exitCode = await runCli(["down"], effects);
    expect(exitCode).toBe(0);
    expect(effects.calls).toContainEqual({ kind: "docker.compose", args: ["down"] });
  });

  test("routes logs with follow and services", async () => {
    const effects = createFakeEffects();
    const exitCode = await runCli(["logs", "-f", "gateway"], effects);
    expect(exitCode).toBe(0);
    expect(effects.calls).toContainEqual({ kind: "docker.compose", args: ["logs", "-f", "gateway"] });
  });

  test("status exit code is driven by exitCodeFor over aggregate status", async () => {
    const effects = createFakeEffects({
      fetchStatusResult: [
        {
          component: "gateway",
          status: "ok",
          code: 0,
          ts: "2026-01-01T00:00:00.000Z",
        },
        {
          component: "postgres",
          status: "unavailable",
          code: 2,
          ts: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const exitCode = await runCli(["status"], effects);
    expect(exitCode).toBe(exitCodeFor("degraded"));
  });

  test("status returns success when all components are ok", async () => {
    const effects = createFakeEffects({
      fetchStatusResult: [
        {
          component: "gateway",
          status: "ok",
          code: 0,
          ts: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const exitCode = await runCli(["status"], effects);
    expect(exitCode).toBe(0);
  });

  test("prints version from package metadata", async () => {
    const effects = createFakeEffects({ version: "1.2.3" });
    const exitCode = await runCli(["--version"], effects);
    expect(exitCode).toBe(0);
    expect(effects.logs).toContain("1.2.3");
  });

  test("prints help text", async () => {
    const effects = createFakeEffects();
    const exitCode = await runCli(["--help"], effects);
    expect(exitCode).toBe(0);
    expect(effects.logs.join("\n")).toContain("Usage: lesearch");
  });
});
