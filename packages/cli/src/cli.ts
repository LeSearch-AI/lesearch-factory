import { parseArgs, VALID_COMMANDS } from "./args";
import { runDoctor } from "./commands/doctor";
import { runDown } from "./commands/down";
import { runLogs } from "./commands/logs";
import { runStatus } from "./commands/status";
import { runUninstall } from "./commands/uninstall";
import { runUp } from "./commands/up";
import type { Effects } from "./effects";
import { HELP_TEXT } from "./output";

export async function runCli(argv: string[], effects: Effects): Promise<number> {
  const parsed = parseArgs(argv);
  switch (parsed.kind) {
    case "help":
      effects.log(HELP_TEXT);
      return 0;
    case "version":
      effects.log(await effects.readPackageVersion());
      return 0;
    case "up":
      return runUp(effects);
    case "down":
      return runDown(effects);
    case "status":
      return runStatus(effects);
    case "logs":
      return runLogs(parsed, effects);
    case "doctor":
      return runDoctor(effects);
    case "uninstall":
      return runUninstall(parsed, effects);
    case "unknown":
      effects.errorLog(
        `Unknown command: ${parsed.command ?? "(none)"}. Valid commands: ${VALID_COMMANDS.join(", ")}`,
      );
      return 1;
  }
}
