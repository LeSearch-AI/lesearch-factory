import { makeReport } from "../../proto/src/status.ts";

import type { InferenceBackend } from "./backend.ts";

const DEFAULT_BASE_URL = "http://localhost:11434";

type OllamaBackendOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
};

type JsonObject = Record<string, unknown>;

export class OllamaBackend implements InferenceBackend {
  readonly name = "ollama";

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private loadedModel?: string;

  constructor(options: OllamaBackendOptions = {}) {
    this.baseUrl = trimTrailingSlash(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchImpl = options.fetch ?? fetch;
  }

  async load(model: string): Promise<void> {
    this.loadedModel = requireModel(model, "Ollama load");
  }

  async generate(req: { prompt: string; model?: string; maxTokens?: number }): Promise<{ text: string }> {
    const body: JsonObject = {
      prompt: req.prompt,
      stream: false,
    };
    const model = this.resolveModel(req.model);

    if (model !== undefined) {
      body.model = model;
    }

    if (req.maxTokens !== undefined) {
      body.options = { num_predict: req.maxTokens };
    }

    const response = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Ollama generate failed with HTTP ${response.status}`);
    }

    const data = await readJsonObject(response, "Invalid Ollama generate response");

    if (typeof data.response !== "string") {
      throw new Error(
        `Invalid Ollama generate response: expected { response: string }, received ${JSON.stringify(data)}`,
      );
    }

    return { text: data.response };
  }

  async embed(text: string): Promise<number[]> {
    const body: JsonObject = { prompt: text };
    const model = this.resolveModel();

    if (model !== undefined) {
      body.model = model;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/api/embeddings`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Ollama embeddings failed with HTTP ${response.status}`);
    }

    const data = await readJsonObject(response, "Invalid Ollama embeddings response");

    if (!Array.isArray(data.embedding) || !data.embedding.every((value) => typeof value === "number")) {
      throw new Error(
        `Invalid Ollama embeddings response: expected { embedding: number[] }, received ${JSON.stringify(data)}`,
      );
    }

    return data.embedding;
  }

  async health(): Promise<ReturnType<typeof makeReport>> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/tags`);

      if (!response.ok) {
        return makeReport("inference:ollama", "degraded", {
          detail: `ollama responded with HTTP ${response.status}`,
        });
      }

      const data = await readJsonObject(response, "Invalid Ollama tags response");

      if (!Array.isArray(data.models)) {
        throw new Error(
          `Invalid Ollama tags response: expected { models: unknown[] }, received ${JSON.stringify(data)}`,
        );
      }

      return makeReport("inference:ollama", "ok");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Invalid Ollama tags response")) {
        throw error;
      }

      return makeReport("inference:ollama", "not_configured", { hint: "ollama not running" });
    }
  }

  private resolveModel(model?: string): string | undefined {
    if (model !== undefined) {
      return requireModel(model, "Ollama request");
    }

    return this.loadedModel;
  }
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function requireModel(model: string, context: string): string {
  const trimmed = model.trim();

  if (trimmed.length === 0) {
    throw new Error(`${context} requires a non-empty model name`);
  }

  return trimmed;
}

async function readJsonObject(response: Response, context: string): Promise<JsonObject> {
  const data: unknown = await response.json().catch(() => {
    throw new Error(`${context}: expected a JSON object response`);
  });

  if (!isJsonObject(data)) {
    throw new Error(`${context}: expected a JSON object response, received ${JSON.stringify(data)}`);
  }

  return data;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
