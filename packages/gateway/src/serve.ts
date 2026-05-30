import { createLogger } from "@lesearch/core";
import { type ComponentStatus } from "@lesearch/proto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";

/**
 * Bind the gateway. Serves the API (/health, /status, /events) and the WebUI
 * static assets at `/`. One process, one port — the simplest reliable demo.
 */
const PORT = Number(process.env.LESEARCH_GATEWAY_PORT ?? 7700);
const WEB_DIR = process.env.LESEARCH_WEB_DIR ?? join(import.meta.dir, "../../webui/public");
const PG_URL = process.env.LESEARCH_PG_URL ?? "postgres://lesearch:lesearch@localhost:5432/lesearch";

const logger = createLogger({ component: "gateway" });

/** Real Postgres probe: a 1s-timeout SELECT 1 via Bun's built-in SQL. */
async function checkPostgres(): Promise<ComponentStatus> {
  try {
    const { SQL } = await import("bun");
    const sql = new SQL(PG_URL, { max: 1 });
    await sql`SELECT 1`;
    await sql.end();
    return "ok";
  } catch {
    return "unavailable";
  }
}

const app = createApp({
  version: process.env.LESEARCH_VERSION ?? "0.0.0",
  checkPostgres,
  tunnelConfigured: Boolean(process.env.CLOUDFLARED_TOKEN),
  logger,
});

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    // API routes first
    if (["/health", "/status", "/events"].includes(url.pathname)) {
      return app.fetch(req);
    }
    // Static WebUI
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = join(WEB_DIR, rel);
    if (existsSync(file) && file.startsWith(WEB_DIR)) {
      return new Response(Bun.file(file));
    }
    if (url.pathname === "/" || !existsSync(file)) {
      const index = join(WEB_DIR, "index.html");
      if (existsSync(index)) return new Response(Bun.file(index));
    }
    return app.fetch(req);
  },
});

logger.info("gateway listening", { code: 0, port: PORT, web_dir: WEB_DIR });
console.log(`LeSearch gateway on http://localhost:${PORT}  (WebUI at /)`);
