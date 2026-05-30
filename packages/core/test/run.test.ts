import { describe, expect, test } from "bun:test";
import { RunStore, isAllowedTransition } from "../src/run";

describe("run / session / task model", () => {
  test("createRun starts pending with one session per agent", () => {
    const store = new RunStore();
    const run = store.createRun({
      objective: "ship it",
      agents: [{ agent_id: "a1", kind: "codex" }, { agent_id: "a2", kind: "claude-code" }],
    });
    expect(run.state).toBe("pending");
    expect(run.sessions).toHaveLength(2);
    expect(run.sessions.every((s) => s.state === "pending")).toBe(true);
    expect(new Set(run.sessions.map((s) => s.agent_id))).toEqual(new Set(["a1", "a2"]));
    // every session shares the one run_id
    expect(store.getRun(run.run_id)?.run_id).toBe(run.run_id);
  });

  test("startRun moves the run and its sessions to running", () => {
    const store = new RunStore();
    const run = store.createRun({ agents: [{ agent_id: "a1" }] });
    const started = store.startRun(run.run_id);
    expect(started.state).toBe("running");
    expect(started.sessions[0]!.state).toBe("running");
  });

  test("one session failing does not affect the others", () => {
    const store = new RunStore();
    const run = store.createRun({ agents: [{ agent_id: "a1" }, { agent_id: "a2" }, { agent_id: "a3" }] });
    store.startRun(run.run_id);
    store.setSessionState(run.run_id, "a2", "failed", 1);
    const r = store.getRun(run.run_id)!;
    expect(r.sessions.find((s) => s.agent_id === "a2")!.state).toBe("failed");
    expect(r.sessions.find((s) => s.agent_id === "a2")!.exit_code).toBe(1);
    expect(r.sessions.find((s) => s.agent_id === "a1")!.state).toBe("running");
    expect(r.sessions.find((s) => s.agent_id === "a3")!.state).toBe("running");
  });

  test("approval flow: running -> waiting_approval -> running", () => {
    const store = new RunStore();
    const run = store.createRun({ agents: [{ agent_id: "a1" }] });
    store.startRun(run.run_id);
    store.setSessionState(run.run_id, "a1", "waiting_approval");
    expect(store.getRun(run.run_id)!.sessions[0]!.state).toBe("waiting_approval");
    store.setSessionState(run.run_id, "a1", "running");
    expect(store.getRun(run.run_id)!.sessions[0]!.state).toBe("running");
  });

  test("illegal transition out of a terminal state throws", () => {
    expect(isAllowedTransition("succeeded", "running")).toBe(false);
    expect(isAllowedTransition("pending", "running")).toBe(true);
    const store = new RunStore();
    const run = store.createRun({ agents: [{ agent_id: "a1" }] });
    store.startRun(run.run_id);
    store.setSessionState(run.run_id, "a1", "succeeded");
    expect(() => store.setSessionState(run.run_id, "a1", "running")).toThrow();
  });

  test("run rolls up: all sessions succeeded -> run succeeded; any failed -> run failed", () => {
    const store = new RunStore();
    const run = store.createRun({ agents: [{ agent_id: "a1" }, { agent_id: "a2" }] });
    store.startRun(run.run_id);
    store.setSessionState(run.run_id, "a1", "succeeded");
    store.setSessionState(run.run_id, "a2", "succeeded");
    expect(store.getRun(run.run_id)!.state).toBe("succeeded");
  });
});
