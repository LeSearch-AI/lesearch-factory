import { describe, expect, it } from "bun:test";

import { LlamaCppBackend, OllamaBackend, selectBackend } from "../src/index.ts";

describe("selectBackend", () => {
  it("returns an OllamaBackend for ollama config", () => {
    const backend = selectBackend({ backend: "ollama" });

    expect(backend).toBeInstanceOf(OllamaBackend);
  });

  it("returns a LlamaCppBackend for llamacpp config", () => {
    const backend = selectBackend({ backend: "llamacpp" });

    expect(backend).toBeInstanceOf(LlamaCppBackend);
  });
});

describe("LlamaCppBackend", () => {
  it("reports not_configured health with a remediation hint", async () => {
    const backend = new LlamaCppBackend();

    const report = await backend.health();

    expect(report.component).toBe("inference:llamacpp");
    expect(report.status).toBe("not_configured");
    expect(report.hint).toContain("phase 2");
  });

  it("throws the phase-2 error for load, generate, and embed", async () => {
    const backend = new LlamaCppBackend();
    const phase2Message = "phase 2: llama.cpp adapter not yet implemented";

    await expect(backend.load("model.gguf")).rejects.toThrow(phase2Message);
    await expect(backend.generate({ prompt: "hello" })).rejects.toThrow(phase2Message);
    await expect(backend.embed("hello")).rejects.toThrow(phase2Message);
  });
});
