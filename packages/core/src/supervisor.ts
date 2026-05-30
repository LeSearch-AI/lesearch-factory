import { RunStore, type AgentSpec } from "./run";
import { type Logger } from "./logger";
import { type Run } from "@lesearch/proto";

/** A spawned process the supervisor watches. */
export interface SpawnHandle {
  /** Resolves with the process exit code. */
  done: Promise<number>;
  /** Optional line-streaming of stdout/stderr for live logs. */
  onLine?(cb: (line: string) => void): void;
}

/** Injectable process spawner (real = Bun.spawn; tests pass a fake). */
export type Spawner = (spec: { command: string; args?: string[] }) => SpawnHandle;

/** What the emitter receives — matches the gateway's LeEvent shape. */
export interface SupervisorEvent {
  type: string;
  ts: string;
  run_id?: string;
  agent_id?: string;
  [k: string]: unknown;
}

export interface AgentRun extends AgentSpec {
  command: string;
  args?: string[];
}

/**
 * Drives a run: spawns one process per agent, transitions session/run state,
 * and emits lifecycle + log events so the gateway can stream them to the WebUI.
 * The actual orchestration "wow" — live agents you can watch.
 */
export class Supervisor {
  constructor(
    private deps: { store: RunStore; emit: (e: SupervisorEvent) => void; spawn: Spawner; logger?: Logger },
  ) {}

  private now(): string {
    return new Date().toISOString();
  }

  /**
   * Start a run. Creates + starts the run synchronously (so the caller gets a
   * run_id immediately), then supervises all sessions concurrently. The
   * returned `completed` promise resolves with the final run when every session
   * has reached a terminal state.
   */
  start(input: { objective?: string; agents: AgentRun[] }): { run: Run; completed: Promise<Run> } {
    const { store, emit, spawn, logger } = this.deps;
    const created = store.createRun({ objective: input.objective, agents: input.agents });
    const run = store.startRun(created.run_id);
    emit({ type: "run.started", ts: this.now(), run_id: run.run_id, objective: input.objective });
    logger?.info("run started", { code: 0, run_id: run.run_id });

    const completed = Promise.all(
      input.agents.map(async (a) => {
        emit({ type: "session.started", ts: this.now(), run_id: run.run_id, agent_id: a.agent_id, kind: a.kind });
        const handle = spawn({ command: a.command, args: a.args });
        handle.onLine?.((line) => {
          emit({ type: "log", ts: this.now(), run_id: run.run_id, agent_id: a.agent_id, msg: line });
        });
        let code: number;
        try {
          code = await handle.done;
        } catch {
          code = 1;
        }
        const state = code === 0 ? "succeeded" : "failed";
        store.setSessionState(run.run_id, a.agent_id, state, code);
        emit({
          type: `session.${state}`,
          ts: this.now(),
          run_id: run.run_id,
          agent_id: a.agent_id,
          exit_code: code,
        });
        logger?.info(`session ${state}`, { code, run_id: run.run_id, agent_id: a.agent_id });
      }),
    ).then(() => {
      const final = store.getRun(run.run_id)!;
      emit({ type: `run.${final.state}`, ts: this.now(), run_id: run.run_id });
      return final;
    });

    return { run, completed };
  }
}

/**
 * Real spawner backed by Bun.spawn. Streams stdout lines and resolves the exit
 * code. Kept out of the test path so the Supervisor stays unit-testable.
 */
export function bunSpawner(): Spawner {
  return ({ command, args = [] }) => {
    const proc = Bun.spawn([command, ...args], { stdout: "pipe", stderr: "pipe" });
    let onLineCb: ((line: string) => void) | undefined;
    const pump = async (stream: ReadableStream<Uint8Array> | null) => {
      if (!stream) return;
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) if (l && onLineCb) onLineCb(l);
      }
      if (buf && onLineCb) onLineCb(buf);
    };
    const done = (async () => {
      await Promise.all([pump(proc.stdout as ReadableStream<Uint8Array>), pump(proc.stderr as ReadableStream<Uint8Array>)]);
      return await proc.exited;
    })();
    return {
      done,
      onLine(cb) {
        onLineCb = cb;
      },
    };
  };
}
