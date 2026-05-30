import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { EventBus } from "../src/events";

const json = async (r: Response) => JSON.parse(await r.text());

describe("GET /health", () => {
  test("is 200 and ok regardless of dependencies", async () => {
    const app = createApp({ version: "1.2.3", checkPostgres: async () => "unavailable" });
    const r = await app.fetch(new Request("http://x/health"));
    expect(r.status).toBe(200);
    const b = await json(r);
    expect(b.status).toBe("ok");
    expect(b.version).toBe("1.2.3");
    expect(typeof b.uptime_s).toBe("number");
  });
});

describe("GET /status", () => {
  test("a down postgres makes overall degraded and lists it unavailable", async () => {
    const app = createApp({ checkPostgres: async () => "unavailable" });
    const r = await app.fetch(new Request("http://x/status"));
    expect(r.status).toBe(200);
    const b = await json(r);
    expect(b.overall).toBe("degraded");
    const pg = b.components.find((c: any) => c.component === "postgres");
    expect(pg.status).toBe("unavailable");
    expect(pg.code).not.toBe(0);
  });

  test("postgres ok + tunnel not_configured => overall ok", async () => {
    const app = createApp({ checkPostgres: async () => "ok", tunnelConfigured: false });
    const b = await json(await app.fetch(new Request("http://x/status")));
    expect(b.overall).toBe("ok");
    const tunnel = b.components.find((c: any) => c.component === "tunnel");
    expect(tunnel.status).toBe("not_configured");
  });
});

describe("event stream", () => {
  test("EventBus delivers a published event to subscribers", () => {
    const bus = new EventBus();
    const got: any[] = [];
    const off = bus.subscribe((e) => got.push(e));
    bus.publish({ type: "run.started", run_id: "run_1", ts: new Date().toISOString() });
    off();
    bus.publish({ type: "run.started", run_id: "run_2", ts: new Date().toISOString() });
    expect(got).toHaveLength(1);
    expect(got[0].type).toBe("run.started");
    expect(got[0].run_id).toBe("run_1");
  });

  test("GET /events returns an SSE stream", async () => {
    const app = createApp();
    const r = await app.fetch(new Request("http://x/events"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    await r.body?.cancel();
  });
});

describe("POST /runs", () => {
  test("starts a run, returns a run_id, and publishes run.started", async () => {
    const fakeSpawn = () => ({ done: Promise.resolve(0) });
    const app = createApp({ spawn: fakeSpawn });
    const events: any[] = [];
    app.bus.subscribe((e) => events.push(e));
    const r = await app.fetch(
      new Request("http://x/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objective: "demo", agents: [{ agent_id: "a1", command: "echo", args: ["hi"] }] }),
      }),
    );
    expect(r.status).toBe(200);
    const b = JSON.parse(await r.text());
    expect(typeof b.run_id).toBe("string");
    expect(b.run.state).toBe("running");
    expect(events.map((e) => e.type)).toContain("run.started");
  });

  test("rejects a body with no agents", async () => {
    const app = createApp();
    const r = await app.fetch(
      new Request("http://x/runs", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
    );
    expect(r.status).toBe(400);
  });
});

describe("GET /runs", () => {
  test("lists runs", async () => {
    const app = createApp({ spawn: () => ({ done: Promise.resolve(0) }) });
    await app.fetch(
      new Request("http://x/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agents: [{ agent_id: "a1", command: "echo" }] }),
      }),
    );
    const r = await app.fetch(new Request("http://x/runs"));
    expect(r.status).toBe(200);
    const b = JSON.parse(await r.text());
    expect(Array.isArray(b.runs)).toBe(true);
    expect(b.runs.length).toBeGreaterThanOrEqual(1);
  });
});

describe("unknown route", () => {
  test("is 404", async () => {
    const app = createApp();
    const r = await app.fetch(new Request("http://x/nope"));
    expect(r.status).toBe(404);
  });
});
