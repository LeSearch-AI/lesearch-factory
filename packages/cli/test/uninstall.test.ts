import { describe, expect, test } from "bun:test";
import { runUninstall } from "../src/commands/uninstall";
import { createFakeEffects } from "./helpers";

describe("runUninstall", () => {
  test("dry-run prints a plan and performs zero mutations", async () => {
    const effects = createFakeEffects({
      existingPaths: ["/repo/bin/lesearch", "/repo/config"],
      psQuietResult: ["abc123", "def456"],
    });
    const exitCode = await runUninstall(
      {
        keepConfig: false,
        keepData: false,
        dryRun: true,
        force: false,
      },
      effects,
    );

    expect(exitCode).toBe(0);
    expect(effects.logs.join("\n")).toContain("/repo/bin/lesearch");
    expect(effects.logs.join("\n")).toContain("abc123");
    expect(effects.logs.join("\n")).toContain("lesearch-postgres-data");
    expect(effects.calls.filter((call) => call.kind === "fs.remove")).toHaveLength(0);
    expect(effects.calls.filter((call) => call.kind === "docker.compose")).toHaveLength(0);
  });
});
