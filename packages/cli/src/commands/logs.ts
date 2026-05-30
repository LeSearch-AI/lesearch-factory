import type { Effects } from "../effects";

/** Stream container logs via `docker compose logs [-f] [service...]`. */
export async function runLogs(
  args: { follow: boolean; services: string[] },
  effects: Effects,
): Promise<number> {
  const composeArgs = ["logs"];
  if (args.follow) {
    composeArgs.push("-f");
  }
  composeArgs.push(...args.services);

  const result = await effects.docker.compose(composeArgs);
  if (result.exitCode !== 0) {
    effects.errorLog(
      `docker compose logs failed (exit ${result.exitCode})${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }
  return result.exitCode;
}
