/**
 * Structured, JSON-lines logger. Every LeSearch component logs through this so
 * the system speaks one machine-readable format: agents tail it, the gateway
 * streams it, humans pretty-print it.
 *
 * Entry shape: {ts, level, component, run_id?, agent_id?, code?, msg, ...fields}
 */
export type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface LogEntry {
  ts: string;
  level: Level;
  component: string;
  msg: string;
  code?: number;
  run_id?: string;
  agent_id?: string;
  [k: string]: unknown;
}

export type LogSink = (entry: LogEntry) => void;

export interface Logger {
  log(level: Level, msg: string, fields?: Record<string, unknown>): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

const defaultSink: LogSink = (e) => {
  // JSON line to stdout — the raw, durable form.
  console.log(JSON.stringify(e));
};

export function createLogger(opts: {
  component: string;
  level?: Level;
  sink?: LogSink;
  bound?: Record<string, unknown>;
}): Logger {
  const min = LEVEL_RANK[opts.level ?? "debug"];
  const sink = opts.sink ?? defaultSink;
  const bound = opts.bound ?? {};

  const emit = (level: Level, msg: string, fields?: Record<string, unknown>) => {
    if (LEVEL_RANK[level] < min) return;
    sink({
      ts: new Date().toISOString(),
      level,
      component: opts.component,
      msg,
      ...bound,
      ...fields,
    });
  };

  return {
    log: emit,
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (fields) =>
      createLogger({ component: opts.component, level: opts.level, sink, bound: { ...bound, ...fields } }),
  };
}

/** Human-readable single line for the CLI. */
export function pretty(e: LogEntry): string {
  const tag = e.level.toUpperCase().padEnd(5);
  const ctx = [e.run_id && `run=${e.run_id}`, e.agent_id && `agent=${e.agent_id}`, e.code !== undefined && `code=${e.code}`]
    .filter(Boolean)
    .join(" ");
  return `${e.ts} ${tag} [${e.component}] ${e.msg}${ctx ? "  " + ctx : ""}`;
}
