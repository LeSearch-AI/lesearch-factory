import type { ComponentReport } from "@lesearch/proto";

export const HELP_TEXT = `Usage: lesearch <command> [options]

Commands:
  up
  down
  status
  logs [-f] [service...]
  doctor
  uninstall [--keep-config] [--keep-data] [--dry-run] [--force]

Flags:
  --help, -h
  --version
`;

export function formatReport(report: ComponentReport): string {
  return `${report.component}: ${report.status}`;
}
