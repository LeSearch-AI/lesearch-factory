import type { Effects } from "../effects";

export type UninstallArgs = {
  keepConfig: boolean;
  keepData: boolean;
  dryRun: boolean;
  force: boolean;
};

type RemovalPlan = {
  binaryPath: string;
  configDir: string | null;
  dataVolume: string | null;
  containerIds: string[];
};

/**
 * Remove the binary, containers, and (optionally) config + data volume.
 *
 * `--dry-run` is a hard guarantee: it enumerates the plan via read-only effects
 * (`fs.exists`, `docker.psQuiet`) and prints it, but performs ZERO mutations —
 * no `fs.remove`, no `docker.compose`. Without `--dry-run`, destructive removal
 * is gated behind `--force`; otherwise we print the plan and tell the caller to
 * confirm, still mutating nothing.
 */
export async function runUninstall(args: UninstallArgs, effects: Effects): Promise<number> {
  const plan = await buildPlan(args, effects);
  printPlan(plan, effects);

  if (args.dryRun) {
    effects.log("Dry run — nothing was removed.");
    return 0;
  }

  if (!args.force) {
    effects.log("Refusing to remove anything without --force. Re-run with --force to proceed.");
    return 0;
  }

  return await applyPlan(plan, effects);
}

/** Read-only enumeration: no mutation happens here, safe for --dry-run. */
async function buildPlan(args: UninstallArgs, effects: Effects): Promise<RemovalPlan> {
  const containerIds = await effects.docker.psQuiet();
  return {
    binaryPath: effects.paths.binaryPath,
    configDir: args.keepConfig ? null : effects.paths.configDir,
    dataVolume: args.keepData ? null : effects.paths.dataVolume,
    containerIds,
  };
}

function printPlan(plan: RemovalPlan, effects: Effects): void {
  effects.log("The following would be removed:");
  effects.log(`  binary:     ${plan.binaryPath}`);
  if (plan.containerIds.length > 0) {
    effects.log(`  containers: ${plan.containerIds.join(", ")}`);
  } else {
    effects.log("  containers: (none running)");
  }
  if (plan.dataVolume !== null) {
    effects.log(`  volume:     ${plan.dataVolume}`);
  } else {
    effects.log("  volume:     (kept — --keep-data)");
  }
  if (plan.configDir !== null) {
    effects.log(`  config:     ${plan.configDir}`);
  } else {
    effects.log("  config:     (kept — --keep-config)");
  }
}

/** The only mutating path — never reached during --dry-run. */
async function applyPlan(plan: RemovalPlan, effects: Effects): Promise<number> {
  // Bring containers down, removing the data volume too unless it is being kept.
  const composeArgs = plan.dataVolume !== null ? ["down", "-v"] : ["down"];
  const down = await effects.docker.compose(composeArgs);
  if (down.exitCode !== 0) {
    effects.errorLog(
      `docker compose ${composeArgs.join(" ")} failed (exit ${down.exitCode})${
        down.stderr ? `: ${down.stderr.trim()}` : ""
      }`,
    );
    return down.exitCode;
  }

  if (await effects.fs.exists(plan.binaryPath)) {
    await effects.fs.remove(plan.binaryPath);
  }
  if (plan.configDir !== null && (await effects.fs.exists(plan.configDir))) {
    await effects.fs.remove(plan.configDir);
  }

  effects.log("Uninstall complete.");
  return 0;
}
