import { type Run, type RunState } from "@lesearch/proto";

/**
 * Run / session / task model. A run is a top-level objective; each agent gets a
 * session; sessions hold tasks. The store is in-memory for the EOD spine; a
 * Postgres-backed store lands in phase 2 behind the same interface.
 */

const TRANSITIONS: Record<RunState, RunState[]> = {
  pending: ["running", "cancelled"],
  running: ["waiting_approval", "succeeded", "failed", "cancelled"],
  waiting_approval: ["running", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function isAllowedTransition(from: RunState, to: RunState): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}${Math.floor(performance.now()).toString(36)}`;
}

export interface AgentSpec {
  agent_id: string;
  kind?: string;
}

export class RunStore {
  private runs = new Map<string, Run>();

  createRun(input: { objective?: string; agents: AgentSpec[] }): Run {
    const run: Run = {
      run_id: id("run"),
      objective: input.objective,
      state: "pending",
      created_at: new Date().toISOString(),
      sessions: input.agents.map((a) => ({
        agent_id: a.agent_id,
        kind: a.kind,
        state: "pending",
        exit_code: null,
        tasks: [],
      })),
    };
    this.runs.set(run.run_id, run);
    return structuredClone(run);
  }

  getRun(run_id: string): Run | undefined {
    const r = this.runs.get(run_id);
    return r ? structuredClone(r) : undefined;
  }

  listRuns(): Run[] {
    return [...this.runs.values()].map((r) => structuredClone(r));
  }

  startRun(run_id: string): Run {
    const run = this.must(run_id);
    this.guard(run.state, "running", `run ${run_id}`);
    run.state = "running";
    for (const s of run.sessions) {
      if (isAllowedTransition(s.state, "running")) s.state = "running";
    }
    return structuredClone(run);
  }

  setSessionState(run_id: string, agent_id: string, state: RunState, exit_code?: number): Run {
    const run = this.must(run_id);
    const session = run.sessions.find((s) => s.agent_id === agent_id);
    if (!session) throw new Error(`no session ${agent_id} in run ${run_id}`);
    this.guard(session.state, state, `session ${agent_id}`);
    session.state = state;
    if (exit_code !== undefined) session.exit_code = exit_code;
    this.rollup(run);
    return structuredClone(run);
  }

  private rollup(run: Run): void {
    const states = run.sessions.map((s) => s.state);
    if (states.some((s) => s === "failed")) {
      if (isAllowedTransition(run.state, "failed")) run.state = "failed";
    } else if (states.length > 0 && states.every((s) => s === "succeeded")) {
      if (isAllowedTransition(run.state, "succeeded")) run.state = "succeeded";
    } else if (states.some((s) => s === "waiting_approval")) {
      if (isAllowedTransition(run.state, "waiting_approval")) run.state = "waiting_approval";
    }
  }

  private must(run_id: string): Run {
    const r = this.runs.get(run_id);
    if (!r) throw new Error(`unknown run ${run_id}`);
    return r;
  }

  private guard(from: RunState, to: RunState, what: string): void {
    if (!isAllowedTransition(from, to)) {
      throw new Error(`illegal transition for ${what}: ${from} -> ${to}`);
    }
  }
}
