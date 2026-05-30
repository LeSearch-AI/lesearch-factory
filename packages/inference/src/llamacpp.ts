/**
 * Phase-2 GGUF adapter targeting CPU execution through llama.cpp.
 * No GPU requirement is assumed for this backend.
 */
import { makeReport } from "../../proto/src/status.ts";

import type { InferenceBackend } from "./backend.ts";

const PHASE_2_ERROR = "phase 2: llama.cpp adapter not yet implemented";

export class LlamaCppBackend implements InferenceBackend {
  readonly name = "llamacpp";

  async load(_model: string): Promise<void> {
    throw new Error(PHASE_2_ERROR);
  }

  async generate(_req: { prompt: string; model?: string; maxTokens?: number }): Promise<{ text: string }> {
    throw new Error(PHASE_2_ERROR);
  }

  async embed(_text: string): Promise<number[]> {
    throw new Error(PHASE_2_ERROR);
  }

  async health(): Promise<ReturnType<typeof makeReport>> {
    return makeReport("inference:llamacpp", "not_configured", {
      hint: "phase 2: llama.cpp GGUF CPU adapter not yet implemented",
    });
  }
}

// TODO(phase-2): Task 6.3 will execute GGUF models on CPU through llama.cpp.
// TODO(phase-2): Task 6.4 will add model registry and download support.
