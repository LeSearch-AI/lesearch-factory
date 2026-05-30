import { describe, expect, test } from "bun:test";
import { runDoctor } from "../src/commands/doctor";
import { createFakeEffects } from "./helpers";

describe("runDoctor", () => {
  test("reports docker unavailable and exits non-zero when docker info fails", async () => {
    const effects = createFakeEffects({
      infoResult: {
        exitCode: 1,
        stdout: "",
        stderr: "docker is down",
      },
      writablePaths: ["/repo/bin"],
    });
    const exitCode = await runDoctor(effects);
    expect(exitCode).not.toBe(0);
    expect(effects.logs.join("\n")).toContain("docker");
    expect(effects.logs.join("\n")).toContain("unavailable");
  });

  test("returns success when all checks are ok", async () => {
    const effects = createFakeEffects({
      writablePaths: ["/repo/bin"],
    });
    const exitCode = await runDoctor(effects);
    expect(exitCode).toBe(0);
    expect(effects.logs.join("\n")).toContain("docker");
    expect(effects.logs.join("\n")).toContain("ports");
    expect(effects.logs.join("\n")).toContain("install_dir");
  });
});
