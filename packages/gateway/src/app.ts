import {
  StatusRegistry,
  RunStore,
  createLogger,
  Supervisor,
  bunSpawner,
  type Logger,
  type Spawner,
  type AgentRun,
} from "@lesearch/core";
import { type ComponentStatus } from "@lesearch/proto";
import { EventBus } from "./events";

export interface AppDeps {
  version?: string;
  registry?: StatusRegistry;
  runs?: RunStore;
  bus?: EventBus;
  logger?: Logger;
  /** Injectable Postgres probe so /status can be unit-tested without a DB. */
  checkPostgres?: () => Promise<ComponentStatus>;
  tunnelConfigured?: boolean;
  /** Injectable process spawner for the supervisor (tests pass a fake). */
  spawn?: Spawner;
}

export interface App {
  fetch: (req: Request) => Promise<Response>;
  registry: StatusRegistry;
  runs: RunStore;
  bus: EventBus;
}

export function createApp(deps: AppDeps = {}): App {
  const version = deps.version ?? "0.0.0";
  const registry = deps.registry ?? new StatusRegistry();
  const runs = deps.runs ?? new RunStore();
  const bus = deps.bus ?? new EventBus();
  const logger = deps.logger ?? createLogger({ component: "gateway", sink: () => {} });
  const checkPostgres = deps.checkPostgres ?? (async () => "unavailable" as ComponentStatus);
  const tunnelConfigured = deps.tunnelConfigured ?? false;
  const supervisor = new Supervisor({ store: runs, emit: (e) => bus.publish(e), spawn: deps.spawn ?? bunSpawner(), logger });
  const startedAt = Date.now();

  async function fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    logger.info("request", { code: 0, method: req.method, path });

    if (path === "/health" && req.method === "GET") {
      return Response.json({ status: "ok", version, uptime_s: (Date.now() - startedAt) / 1000 });
    }

    if (path === "/status" && req.method === "GET") {
      const pg = await checkPostgres();
      registry.report("gateway", "ok");
      registry.report("postgres", pg, pg === "ok" ? {} : { hint: "is the postgres container up?" });
      registry.report("tunnel", tunnelConfigured ? "ok" : "not_configured");
      return Response.json({ overall: registry.overall(), components: registry.all() });
    }

    if (path === "/events" && req.method === "GET") {
      const encoder = new TextEncoder();
      let off: (() => void) | undefined;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(": connected\n\n"));
          off = bus.subscribe((e) => {
            try {
              // Default-message frames (no `event:` line) so EventSource.onmessage
              // receives every event type; the client switches on `e.type`.
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
            } catch {
              /* stream closed */
            }
          });
        },
        cancel() {
          off?.();
        },
      });
      return new Response(stream, {
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" },
      });
    }

    if (path === "/runs" && req.method === "POST") {
      const body = (await req.json().catch(() => null)) as { objective?: string; agents?: AgentRun[] } | null;
      if (!body || !Array.isArray(body.agents) || body.agents.length === 0) {
        return Response.json({ error: "body.agents must be a non-empty array" }, { status: 400 });
      }
      const { run } = supervisor.start({ objective: body.objective, agents: body.agents });
      logger.info("run accepted", { code: 0, run_id: run.run_id });
      return Response.json({ run_id: run.run_id, run }, { status: 200 });
    }

    if (path === "/runs" && req.method === "GET") {
      return Response.json({ runs: runs.listRuns() });
    }

    return new Response("not found", { status: 404 });
  }

  return { fetch, registry, runs, bus };
}
