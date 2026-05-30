export type ParsedCommand =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "up" }
  | { kind: "down" }
  | { kind: "status" }
  | { kind: "doctor" }
  | { kind: "logs"; follow: boolean; services: string[] }
  | {
      kind: "uninstall";
      keepConfig: boolean;
      keepData: boolean;
      dryRun: boolean;
      force: boolean;
    }
  | { kind: "unknown"; command?: string };

export const VALID_COMMANDS = ["up", "down", "status", "logs", "doctor", "uninstall"] as const;

/**
 * Pure argument parser — no side effects, no process access.
 * `index.ts` feeds it `process.argv.slice(2)`; tests feed it literal arrays.
 */
export function parseArgs(argv: string[]): ParsedCommand {
  const [first, ...rest] = argv;

  if (first === undefined) {
    return { kind: "help" };
  }

  if (first === "--help" || first === "-h") {
    return { kind: "help" };
  }

  if (first === "--version" || first === "-v") {
    return { kind: "version" };
  }

  switch (first) {
    case "up":
      return { kind: "up" };
    case "down":
      return { kind: "down" };
    case "status":
      return { kind: "status" };
    case "doctor":
      return { kind: "doctor" };
    case "logs":
      return parseLogs(rest);
    case "uninstall":
      return parseUninstall(rest);
    default:
      return { kind: "unknown", command: first };
  }
}

function parseLogs(rest: string[]): ParsedCommand {
  let follow = false;
  const services: string[] = [];
  for (const token of rest) {
    if (token === "-f" || token === "--follow") {
      follow = true;
    } else {
      services.push(token);
    }
  }
  return { kind: "logs", follow, services };
}

function parseUninstall(rest: string[]): ParsedCommand {
  let keepConfig = false;
  let keepData = false;
  let dryRun = false;
  let force = false;
  for (const token of rest) {
    switch (token) {
      case "--keep-config":
        keepConfig = true;
        break;
      case "--keep-data":
        keepData = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--force":
        force = true;
        break;
      default:
        // Ignore unrecognized uninstall flags rather than failing the parse;
        // the destructive command stays gated behind --force / --dry-run.
        break;
    }
  }
  return { kind: "uninstall", keepConfig, keepData, dryRun, force };
}
