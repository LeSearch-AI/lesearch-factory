import {
  aggregateStatus,
  exitCodeFor,
  makeReport,
  type ComponentReport,
} from "@lesearch/proto";
import type { Effects } from "../effects";
import { formatReport } from "../output";

/** Ports the core stack needs free before `lesearch up`. */
const REQUIRED_PORTS = [7700, 7777, 5432] as const;

/**
 * Preflight checks: docker daemon reachable, required ports free, install dir
 * writable. Each yields a typed `makeReport(...)`. Exit code is driven by
 * `exitCodeFor(aggregateStatus(...))`, so any `unavailable` check fails loudly
 * (unavailable degrades the aggregate to `degraded` → non-zero exit).
 */
export async function runDoctor(effects: Effects): Promise<number> {
  const reports: ComponentReport[] = [
    await checkDocker(effects),
    await checkPorts(effects),
    await checkInstallDir(effects),
  ];

  for (const report of reports) {
    effects.log(formatReport(report));
  }

  const overall = aggregateStatus(reports);
  return exitCodeFor(overall);
}

async function checkDocker(effects: Effects): Promise<ComponentReport> {
  const info = await effects.docker.info();
  if (info.exitCode === 0) {
    return makeReport("docker", "ok", { detail: "docker daemon reachable" });
  }
  return makeReport("docker", "unavailable", {
    detail: info.stderr.trim() || "docker info failed",
    hint: "Start Docker Desktop or the docker daemon, then re-run `lesearch doctor`.",
  });
}

async function checkPorts(effects: Effects): Promise<ComponentReport> {
  const busy: number[] = [];
  for (const port of REQUIRED_PORTS) {
    const free = await effects.portIsFree(port);
    if (!free) {
      busy.push(port);
    }
  }
  if (busy.length === 0) {
    return makeReport("ports", "ok", {
      detail: `ports free: ${REQUIRED_PORTS.join(", ")}`,
    });
  }
  return makeReport("ports", "unavailable", {
    detail: `ports in use: ${busy.join(", ")}`,
    hint: "Stop whatever is bound to these ports, or remap them, before `lesearch up`.",
  });
}

async function checkInstallDir(effects: Effects): Promise<ComponentReport> {
  const dir = effects.paths.installDir;
  const writable = await effects.fs.writableDir(dir);
  if (writable) {
    return makeReport("install_dir", "ok", { detail: `${dir} is writable` });
  }
  return makeReport("install_dir", "unavailable", {
    detail: `${dir} is not writable`,
    hint: `Choose a writable install dir (e.g. set $LESEARCH_INSTALL_DIR) or fix permissions on ${dir}.`,
  });
}
