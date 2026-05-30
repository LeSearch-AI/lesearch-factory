import type { InferenceBackend } from "./backend.ts";
import { LlamaCppBackend } from "./llamacpp.ts";
import { OllamaBackend } from "./ollama.ts";

export type { InferenceBackend } from "./backend.ts";
export { LlamaCppBackend, OllamaBackend };

export function selectBackend(config: {
  backend: "ollama" | "llamacpp";
  baseUrl?: string;
}): InferenceBackend {
  if (config.backend === "ollama") {
    return new OllamaBackend({ baseUrl: config.baseUrl });
  }

  return new LlamaCppBackend();
}
