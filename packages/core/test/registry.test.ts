import { describe, expect, test } from "bun:test";
import { StatusRegistry } from "../src/registry";

describe("component status registry", () => {
  test("records and returns component reports", () => {
    const reg = new StatusRegistry();
    reg.report("gateway", "ok");
    reg.report("postgres", "unavailable", { hint: "is the db up?" });
    expect(reg.get("gateway")?.status).toBe("ok");
    expect(reg.get("postgres")?.status).toBe("unavailable");
    expect(reg.get("postgres")?.code).not.toBe(0);
    expect(reg.all()).toHaveLength(2);
  });

  test("overall is degraded when a dependency is unavailable", () => {
    const reg = new StatusRegistry();
    reg.report("gateway", "ok");
    reg.report("postgres", "unavailable");
    expect(reg.overall()).toBe("degraded");
  });

  test("an optional not_configured component never makes overall an error", () => {
    const reg = new StatusRegistry();
    reg.report("gateway", "ok");
    reg.report("tunnel", "not_configured");
    expect(reg.overall()).toBe("ok");
  });
});
