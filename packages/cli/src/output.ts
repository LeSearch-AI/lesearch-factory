import type { ComponentReport } from "@lesearch/proto";

export const HELP_TEXT = `Usage: lesearch <command> [options]

Commands:
  up                                          Start the core stack (docker compose up -d)
  down                                        Stop the core stack (docker compose down)
  status                                      Show typed health of each component
  logs [-f] [service...]                      Stream container logs
  doctor                                      Preflight: docker, ports, install dir
  uninstall [--keep-config] [--keep-data] [--dry-run] [--force]
                                              Remove binary, containers, and volumes

Flags:
  --help, -h                                  Show this help
  --version, -v                               Print the version
`;

/**
 * One-line pretty print of a component report: `<component>: <status>` plus any
 * detail and hint. The `<component>: <status>` prefix is a stable contract the
 * CLI tests assert against.
 */
export function formatReport(report: ComponentReport): string {
  let line = `${report.component}: ${report.status}`;
  if (report.detail) {
    line += ` — ${report.detail}`;
  }
  if (report.hint) {
    line += ` (hint: ${report.hint})`;
  }
  return line;
}
