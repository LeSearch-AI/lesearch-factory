import { describe, expect, test } from "bun:test";
import { parseArgs } from "../src/args";

describe("parseArgs", () => {
  test("parses each subcommand", () => {
    expect(parseArgs(["up"])).toEqual({ kind: "up" });
    expect(parseArgs(["down"])).toEqual({ kind: "down" });
    expect(parseArgs(["status"])).toEqual({ kind: "status" });
    expect(parseArgs(["doctor"])).toEqual({ kind: "doctor" });
    expect(parseArgs(["logs"])).toEqual({ kind: "logs", follow: false, services: [] });
    expect(parseArgs(["uninstall"])).toEqual({
      kind: "uninstall",
      keepConfig: false,
      keepData: false,
      dryRun: false,
      force: false,
    });
  });

  test("parses version and help flags", () => {
    expect(parseArgs(["--version"])).toEqual({ kind: "version" });
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseArgs(["-h"])).toEqual({ kind: "help" });
  });

  test("parses logs follow and services", () => {
    expect(parseArgs(["logs", "-f", "gateway", "postgres"])).toEqual({
      kind: "logs",
      follow: true,
      services: ["gateway", "postgres"],
    });
  });

  test("parses uninstall flags", () => {
    expect(parseArgs(["uninstall", "--keep-config", "--keep-data", "--dry-run", "--force"])).toEqual({
      kind: "uninstall",
      keepConfig: true,
      keepData: true,
      dryRun: true,
      force: true,
    });
  });

  test("marks unknown subcommands", () => {
    expect(parseArgs(["boguscmd"])).toEqual({ kind: "unknown", command: "boguscmd" });
  });
});
