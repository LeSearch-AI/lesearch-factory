import { describe, expect, test } from "bun:test";
import { RunStore } from "../src/run";
import { Supervisor, type Spawner } from "../src/supervisor";

/** A fake spawner: exit code + optional emitted lines, resolved on a microtask. */
function fakeSpawner(plan: Record<string, { code: number; lines?: string[] }>): Spawner {
  return (spec) => {
    const key = spec.command + (spec.args ? " " + spec.args.join(" ") : "");
    const p = plan[key] ?? plan[spec.command] ?? { code: 0 };
    return {
      onLine(cb) {
        for (const l of p.lines ?? []) cb(l);
      },
      done: Promise.resolve(p.code),
    };
  };
}

describe("Supervisor", () => {
  test("emits run.started, a session.started per agent, and terminal session events", async () => {
    const store = new RunStore();
    const events: any[] = [];
    const sup = new Supervisor({
      store,
      emit: (e) => events.push(e),
      spawn: fakeSpawner({ "ok-cmd": { code: 0 }, "bad-cmd": { code: 1 } }),
    });

    const { run, completed } = sup.start({
      objective: "demo",
      agents: [
        { agent_id: "a1", kind: "codex", command: "ok-cmd" },
        { agent_id: "a2", kind: "claude-code", command: "bad-cmd" },
      ],
    });

    expect(run.state).toBe("running");
    const final = await completed;

    const types = events.map((e) => e.type);
    expect(types).toContain("run.started");
    expect(types.filter((t) => t === "session.started")).toHaveLength(2);
    expect(types).toContain("session.succeeded");
    expect(types).toContain("session.failed");

    // store reflects per-session outcomes and the run rolls up to failed (one failed)
    const a1 = final.sessions.find((s) => s.agent_id === "a1")!;
    const a2 = final.sessions.find((s) => s.agent_id === "a2")!;
    expect(a1.state).toBe("succeeded");
    expect(a1.exit_code).toBe(0);
    expect(a2.state).toBe("failed");
    expect(a2.exit_code).toBe(1);
    expect(final.state).toBe("failed");
  });

  test("streams process output as log events tagged with run_id and agent_id", async () => {
    const store = new RunStore();
    const events: any[] = [];
    const sup = new Supervisor({
      store,
      emit: (e) => events.push(e),
      spawn: fakeSpawner({ worker: { code: 0, lines: ["step 1", "step 2"] } }),
    });
    const { run, completed } = sup.start({ agents: [{ agent_id: "w", command: "worker" }] });
    await completed;
    const logs = events.filter((e) => e.type === "log");
    expect(logs.map((l) => l.msg)).toEqual(["step 1", "step 2"]);
    expect(logs.every((l) => l.run_id === run.run_id && l.agent_id === "w")).toBe(true);
  });

  test("all sessions succeed => run succeeded", async () => {
    const store = new RunStore();
    const sup = new Supervisor({ store, emit: () => {}, spawn: fakeSpawner({ x: { code: 0 } }) });
    const { completed } = sup.start({ agents: [{ agent_id: "a", command: "x" }, { agent_id: "b", command: "x" }] });
    const final = await completed;
    expect(final.state).toBe("succeeded");
  });
});
