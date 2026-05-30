import type { Effects, CommandResult } from "../src/effects";

type RecordedCall =
  | { kind: "docker.compose"; args: string[] }
  | { kind: "docker.info" }
  | { kind: "docker.psQuiet" }
  | { kind: "fs.exists"; path: string }
  | { kind: "fs.remove"; path: string }
  | { kind: "fs.writableDir"; path: string }
  | { kind: "portIsFree"; port: number }
  | { kind: "fetchStatus"; url: string }
  | { kind: "readPackageVersion" };

export type FakeEffects = Effects & {
  calls: RecordedCall[];
  logs: string[];
  errors: string[];
};

export function createFakeEffects(
  overrides: Partial<{
    composeResult: CommandResult;
    infoResult: CommandResult;
    psQuietResult: string[];
    existingPaths: string[];
    writablePaths: string[];
    portFreeByNumber: Record<number, boolean>;
    fetchStatusResult: unknown;
    fetchStatusError: Error;
    version: string;
  }> = {},
): FakeEffects {
  const calls: RecordedCall[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  const existingPaths = new Set(overrides.existingPaths ?? []);
  const writablePaths = new Set(overrides.writablePaths ?? []);
  const portFreeByNumber = overrides.portFreeByNumber ?? {};
  const composeResult = overrides.composeResult ?? { exitCode: 0, stdout: "", stderr: "" };
  const infoResult = overrides.infoResult ?? { exitCode: 0, stdout: "", stderr: "" };
  const psQuietResult = overrides.psQuietResult ?? [];

  return {
    calls,
    logs,
    errors,
    docker: {
      async compose(args) {
        calls.push({ kind: "docker.compose", args });
        return composeResult;
      },
      async info() {
        calls.push({ kind: "docker.info" });
        return infoResult;
      },
      async psQuiet() {
        calls.push({ kind: "docker.psQuiet" });
        return psQuietResult;
      },
    },
    fs: {
      async exists(path) {
        calls.push({ kind: "fs.exists", path });
        return existingPaths.has(path);
      },
      async remove(path) {
        calls.push({ kind: "fs.remove", path });
      },
      async writableDir(path) {
        calls.push({ kind: "fs.writableDir", path });
        return writablePaths.has(path);
      },
    },
    repoRoot: "/repo",
    paths: {
      binaryPath: "/repo/bin/lesearch",
      configDir: "/repo/config",
      dataVolume: "lesearch-postgres-data",
      gatewayUrl: "http://localhost:7700",
      statusUrl: "http://localhost:7700/status",
      webUiUrl: "http://localhost:7777",
      installDir: "/repo/bin",
    },
    async portIsFree(port) {
      calls.push({ kind: "portIsFree", port });
      return portFreeByNumber[port] ?? true;
    },
    async fetchStatus(url) {
      calls.push({ kind: "fetchStatus", url });
      if (overrides.fetchStatusError) {
        throw overrides.fetchStatusError;
      }
      return overrides.fetchStatusResult ?? [];
    },
    async readPackageVersion() {
      calls.push({ kind: "readPackageVersion" });
      return overrides.version ?? "0.0.0";
    },
    log(line) {
      logs.push(line);
    },
    errorLog(line) {
      errors.push(line);
    },
  };
}
