#!/usr/bin/env bun

import { runCli } from "./cli";
import { realEffects } from "./effects";

const effects = realEffects();

try {
  const exitCode = await runCli(process.argv.slice(2), effects);
  process.exit(exitCode);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  effects.errorLog(`CLI failed: ${message}`);
  process.exit(1);
}
