import { z } from "zod";

/**
 * The typed health surface every LeSearch component reports.
 * This is the "what we have / what we don't" contract — agents and the WebUI
 * read it to know exactly what is working without parsing prose.
 *
 * Source of truth: schemas/lesearch.status.v1.schema.json
 */
export const STATUS_VALUES = [
  "ok",
  "degraded",
  "unavailable",
  "not_configured",
  "unknown",
] as const;

export type ComponentStatus = (typeof STATUS_VALUES)[number];

/** Numeric code per status. 0 == ok; everything else is non-zero by contract. */
const STATUS_CODES: Record<ComponentStatus, number> = {
  ok: 0,
  degraded: 1,
  not_configured: 3,
  unavailable: 2,
  unknown: 4,
};

export function statusCode(status: ComponentStatus): number {
  return STATUS_CODES[status];
}

/**
 * Map a status to a process exit code for the CLI.
 * `ok` and `not_configured` are success (an optional component being absent is
 * not a failure); `degraded`, `unavailable`, and `unknown` are non-zero so
 * `lesearch doctor` and friends fail loudly when something is actually wrong.
 */
export function exitCodeFor(status: ComponentStatus): number {
  switch (status) {
    case "ok":
    case "not_configured":
      return 0;
    case "degraded":
      return 1;
    case "unavailable":
      return 2;
    case "unknown":
      return 3;
  }
}

/** Runtime validator mirroring lesearch.status.v1.schema.json. */
export const ComponentReportSchema = z
  .object({
    component: z.string(),
    status: z.enum(STATUS_VALUES),
    code: z.number().int(),
    ts: z.string(),
    detail: z.string().optional(),
    hint: z.string().optional(),
  })
  .passthrough();

export type ComponentReport = z.infer<typeof ComponentReportSchema>;

/** Build a well-formed, schema-valid component report with the correct code + timestamp. */
export function makeReport(
  component: string,
  status: ComponentStatus,
  extra: { detail?: string; hint?: string } = {},
): ComponentReport {
  return {
    component,
    status,
    code: statusCode(status),
    ts: new Date().toISOString(),
    ...extra,
  };
}

/** Aggregate many component reports into one overall status (worst wins, but optional-absent never errors). */
export function aggregateStatus(reports: ComponentReport[]): ComponentStatus {
  let worst: ComponentStatus = "ok";
  const rank: Record<ComponentStatus, number> = {
    ok: 0,
    not_configured: 0,
    degraded: 1,
    unknown: 2,
    unavailable: 3,
  };
  for (const r of reports) {
    if (rank[r.status] > rank[worst]) worst = r.status === "unavailable" ? "degraded" : r.status;
  }
  return worst;
}
