import {
  ComponentReportSchema,
  aggregateStatus,
  exitCodeFor,
  makeReport,
  type ComponentReport,
} from "@lesearch/proto";
import type { Effects } from "../effects";
import { formatReport } from "../output";

/**
 * Fetch the gateway's typed component statuses, pretty-print each, and set the
 * process exit code to `exitCodeFor(aggregateStatus(reports))`. An unreachable
 * gateway is itself reported as `unavailable` (not a silent failure).
 */
export async function runStatus(effects: Effects): Promise<number> {
  let reports: ComponentReport[];
  try {
    const raw = await effects.fetchStatus(effects.paths.statusUrl);
    reports = parseReports(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    reports = [
      makeReport("gateway", "unavailable", {
        detail,
        hint: `Could not reach ${effects.paths.statusUrl} — is the stack up? Try \`lesearch up\`.`,
      }),
    ];
  }

  for (const report of reports) {
    effects.log(formatReport(report));
  }

  const overall = aggregateStatus(reports);
  effects.log(`overall: ${overall}`);
  return exitCodeFor(overall);
}

/** Accept either a bare array or a `{ components: [...] }` envelope; validate each entry. */
function parseReports(raw: unknown): ComponentReport[] {
  const list = Array.isArray(raw)
    ? raw
    : isComponentsEnvelope(raw)
      ? raw.components
      : null;

  if (list === null) {
    throw new Error("status response was neither an array nor a { components: [...] } object");
  }

  return list.map((entry) => ComponentReportSchema.parse(entry));
}

function isComponentsEnvelope(raw: unknown): raw is { components: unknown[] } {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "components" in raw &&
    Array.isArray((raw as { components: unknown }).components)
  );
}
