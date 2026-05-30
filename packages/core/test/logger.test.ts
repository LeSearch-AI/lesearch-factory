import { describe, expect, test } from "bun:test";
import { createLogger, pretty } from "../src/logger";

describe("structured logger", () => {
  test("emits JSON-lines entries with the required fields", () => {
    const out: any[] = [];
    const log = createLogger({ component: "gateway", sink: (e) => out.push(e) });
    log.info("request handled", { code: 0, run_id: "run_1" });
    expect(out).toHaveLength(1);
    const e = out[0];
    expect(e.component).toBe("gateway");
    expect(e.level).toBe("info");
    expect(e.msg).toBe("request handled");
    expect(e.code).toBe(0);
    expect(e.run_id).toBe("run_1");
    expect(typeof e.ts).toBe("string");
  });

  test("respects the minimum level", () => {
    const out: any[] = [];
    const log = createLogger({ component: "core", level: "warn", sink: (e) => out.push(e) });
    log.debug("noisy");
    log.info("also noisy");
    log.warn("kept");
    log.error("kept too");
    expect(out.map((e) => e.level)).toEqual(["warn", "error"]);
  });

  test("child loggers inherit bound fields", () => {
    const out: any[] = [];
    const log = createLogger({ component: "core", sink: (e) => out.push(e) }).child({ agent_id: "a1" });
    log.info("hi");
    expect(out[0].agent_id).toBe("a1");
  });

  test("pretty() renders a human line containing component and message", () => {
    const line = pretty({ ts: "2026-01-01T00:00:00Z", level: "info", component: "gateway", code: 0, msg: "up" });
    expect(line).toContain("gateway");
    expect(line).toContain("up");
  });
});
