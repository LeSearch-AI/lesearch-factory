import type { Effects } from "../effects";

/** Bring the core stack up via `docker compose up -d`, then print the access URLs. */
export async function runUp(effects: Effects): Promise<number> {
  const result = await effects.docker.compose(["up", "-d"]);
  if (result.exitCode === 0) {
    effects.log(`Gateway:  ${effects.paths.gatewayUrl}`);
    effects.log(`WebUI:    ${effects.paths.webUiUrl}`);
  } else {
    effects.errorLog(
      `docker compose up failed (exit ${result.exitCode})${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }
  return result.exitCode;
}
