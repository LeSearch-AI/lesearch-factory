import type { Effects } from "../effects";

export type UninstallArgs = {
  keepConfig: boolean;
  keepData: boolean;
  dryRun: boolean;
  force: boolean;
};

export async function runUninstall(args: UninstallArgs, effects: Effects): Promise<number> {
  void args;
  void effects;
  return 0;
}
