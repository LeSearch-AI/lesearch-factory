import type { Effects } from "../effects";

/** Tear the core stack down via `docker compose down`. */
export async function runDown(effects: Effects): Promise<number> {
  const result = await effects.docker.compose(["down"]);
  if (result.exitCode === 0) {
    effects.log("Stack stopped.");
  } else {
    effects.errorLog(
      `docker compose down failed (exit ${result.exitCode})${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }
  return result.exitCode;
}
