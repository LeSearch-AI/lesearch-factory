import { Socket } from "node:net";
import { rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export interface DockerRunner {
  compose(args: string[]): Promise<CommandResult>;
  info(): Promise<CommandResult>;
  psQuiet(): Promise<string[]>;
}

export interface FileSystemEffects {
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
  writableDir(path: string): Promise<boolean>;
}

export interface Effects {
  docker: DockerRunner;
  fs: FileSystemEffects;
  repoRoot: string;
  paths: {
    binaryPath: string;
    configDir: string;
    dataVolume: string;
    gatewayUrl: string;
    statusUrl: string;
    webUiUrl: string;
    installDir: string;
  };
  portIsFree(port: number): Promise<boolean>;
  fetchStatus(url: string): Promise<unknown>;
  readPackageVersion(): Promise<string>;
  log(line: string): void;
  errorLog(line: string): void;
}

const GATEWAY_URL = "http://localhost:7700";
const WEBUI_URL = "http://localhost:7777";
const STATUS_URL = `${GATEWAY_URL}/status`;
const DATA_VOLUME = "lesearch-postgres-data";

/** Resolve the monorepo root from this file: packages/cli/src/effects.ts → ../../.. */
function resolveRepoRoot(): string {
  return resolve(import.meta.dir, "..", "..", "..");
}

/** Resolve the directory holding the installed `lesearch` binary (env-overridable). */
function resolveInstallDir(): string {
  const fromEnv = process.env.LESEARCH_INSTALL_DIR ?? process.env.XDG_BIN_DIR;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  const home = process.env.HOME ?? "";
  return join(home, ".local", "bin");
}

/** Run a command to completion, capturing stdout/stderr; never throws on non-zero exit. */
async function runCaptured(cmd: string[], cwd: string): Promise<CommandResult> {
  const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
}

/**
 * Probe whether a TCP port is free on localhost.
 *
 * We test by *connecting*, not by binding: a docker-proxy listener binds the
 * IPv6 wildcard (`*:PORT`), so an IPv4 `127.0.0.1` bind can still succeed and
 * wrongly report the port free. If anyone accepts a connection on the port,
 * it is in use. Connection refused (or timeout) means free.
 */
function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const socket = new Socket();
    let settled = false;
    const finish = (free: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise(free);
    };
    socket.setTimeout(600);
    socket.once("connect", () => finish(false)); // something is listening → in use
    socket.once("timeout", () => finish(true));
    socket.once("error", () => finish(true)); // ECONNREFUSED → free
    socket.connect(port, "127.0.0.1");
  });
}

export function realEffects(): Effects {
  const repoRoot = resolveRepoRoot();
  const installDir = resolveInstallDir();

  return {
    docker: {
      compose: (args) => runCaptured(["docker", "compose", ...args], repoRoot),
      info: () => runCaptured(["docker", "info"], repoRoot),
      async psQuiet() {
        const result = await runCaptured(["docker", "compose", "ps", "-q"], repoRoot);
        return result.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
      },
    },
    fs: {
      async exists(path) {
        try {
          await access(path, fsConstants.F_OK);
          return true;
        } catch {
          return false;
        }
      },
      async remove(path) {
        await rm(path, { recursive: true, force: true });
      },
      async writableDir(path) {
        try {
          await access(path, fsConstants.W_OK);
          return true;
        } catch {
          // The dir itself may not exist yet; fall back to checking its parent.
          try {
            await access(dirname(path), fsConstants.W_OK);
            return true;
          } catch {
            return false;
          }
        }
      },
    },
    repoRoot,
    paths: {
      binaryPath: join(installDir, "lesearch"),
      configDir: join(process.env.HOME ?? "", ".lesearch"),
      dataVolume: DATA_VOLUME,
      gatewayUrl: GATEWAY_URL,
      statusUrl: STATUS_URL,
      webUiUrl: WEBUI_URL,
      installDir,
    },
    portIsFree,
    async fetchStatus(url) {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`status endpoint returned HTTP ${response.status}`);
      }
      return await response.json();
    },
    async readPackageVersion() {
      const pkgPath = resolve(import.meta.dir, "..", "package.json");
      const pkg = (await Bun.file(pkgPath).json()) as { version?: unknown };
      return typeof pkg.version === "string" ? pkg.version : "0.0.0";
    },
    log(line) {
      console.log(line);
    },
    errorLog(line) {
      console.error(line);
    },
  };
}
