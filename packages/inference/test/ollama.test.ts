import { describe, expect, it } from "bun:test";

import { OllamaBackend } from "../src/ollama.ts";

type FetchCall = {
  body?: unknown;
  method?: string;
  url: string;
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init,
  });
}

function createRecordingFetch(response: Response | Promise<Response>) {
  const calls: FetchCall[] = [];

  const fetchStub: typeof fetch = async (input, init) => {
    const bodyText =
      typeof init?.body === "string"
        ? init.body
        : init?.body instanceof Uint8Array
          ? new TextDecoder().decode(init.body)
          : undefined;

    calls.push({
      body: bodyText ? JSON.parse(bodyText) : undefined,
      method: init?.method,
      url: typeof input === "string" ? input : input.url,
    });

    return await response;
  };

  return { calls, fetchStub };
}

describe("OllamaBackend health", () => {
  it("returns ok when /api/tags succeeds", async () => {
    const { fetchStub, calls } = createRecordingFetch(jsonResponse({ models: [] }));
    const backend = new OllamaBackend({ baseUrl: "http://ollama.test", fetch: fetchStub });

    const report = await backend.health();

    expect(report.component).toBe("inference:ollama");
    expect(report.status).toBe("ok");
    expect(calls).toEqual([{ body: undefined, method: undefined, url: "http://ollama.test/api/tags" }]);
  });

  it("returns degraded when /api/tags is reachable but erroring", async () => {
    const backend = new OllamaBackend({
      baseUrl: "http://ollama.test",
      fetch: async () => new Response("bad gateway", { status: 502 }),
    });

    const report = await backend.health();

    expect(report.status).toBe("degraded");
    expect(report.detail).toContain("502");
  });

  it("returns not_configured when fetch throws instead of crashing", async () => {
    const backend = new OllamaBackend({
      fetch: async () => {
        throw new TypeError("connection refused");
      },
    });

    await expect(backend.health()).resolves.toMatchObject({
      component: "inference:ollama",
      hint: "ollama not running",
      status: "not_configured",
    });
  });

  it("throws a loud error when the tags response shape is wrong", async () => {
    const backend = new OllamaBackend({
      fetch: async () => jsonResponse(["not-an-object"]),
    });

    await expect(backend.health()).rejects.toThrow("Invalid Ollama tags response");
  });
});

describe("OllamaBackend load", () => {
  it("records the loaded model for later requests", async () => {
    const { fetchStub, calls } = createRecordingFetch(jsonResponse({ response: "loaded" }));
    const backend = new OllamaBackend({ baseUrl: "http://ollama.test", fetch: fetchStub });

    await backend.load("llama3.2");
    await backend.generate({ prompt: "use the default model" });

    expect(calls[0]?.body).toEqual({
      model: "llama3.2",
      prompt: "use the default model",
      stream: false,
    });
  });
});

describe("OllamaBackend generate", () => {
  it("posts the prompt to /api/generate and returns text", async () => {
    const { fetchStub, calls } = createRecordingFetch(jsonResponse({ response: "hi there" }));
    const backend = new OllamaBackend({ baseUrl: "http://ollama.test", fetch: fetchStub });

    const result = await backend.generate({
      maxTokens: 42,
      model: "llama3.2",
      prompt: "Say hi",
    });

    expect(result).toEqual({ text: "hi there" });
    expect(calls).toEqual([
      {
        body: {
          model: "llama3.2",
          options: { num_predict: 42 },
          prompt: "Say hi",
          stream: false,
        },
        method: "POST",
        url: "http://ollama.test/api/generate",
      },
    ]);
  });

  it("uses the loaded model when request.model is omitted", async () => {
    const { fetchStub, calls } = createRecordingFetch(jsonResponse({ response: "ok" }));
    const backend = new OllamaBackend({ baseUrl: "http://ollama.test", fetch: fetchStub });

    await backend.load("mistral");
    await backend.generate({ prompt: "Ping" });

    expect(calls[0]?.body).toEqual({
      model: "mistral",
      prompt: "Ping",
      stream: false,
    });
  });

  it("throws a loud error when the generate response shape is wrong", async () => {
    const backend = new OllamaBackend({
      fetch: async () => jsonResponse({ notResponse: true }),
    });

    await expect(backend.generate({ prompt: "Say hi" })).rejects.toThrow("Invalid Ollama generate response");
  });
});

describe("OllamaBackend embed", () => {
  it("posts to /api/embeddings and returns the embedding vector", async () => {
    const { fetchStub, calls } = createRecordingFetch(jsonResponse({ embedding: [0.1, 0.2, 0.3] }));
    const backend = new OllamaBackend({ baseUrl: "http://ollama.test", fetch: fetchStub });

    const result = await backend.embed("vectorize this");

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(calls).toEqual([
      {
        body: { prompt: "vectorize this" },
        method: "POST",
        url: "http://ollama.test/api/embeddings",
      },
    ]);
  });

  it("uses the loaded model for embeddings when available", async () => {
    const { fetchStub, calls } = createRecordingFetch(jsonResponse({ embedding: [1] }));
    const backend = new OllamaBackend({ baseUrl: "http://ollama.test", fetch: fetchStub });

    await backend.load("nomic-embed-text");
    await backend.embed("hello");

    expect(calls[0]?.body).toEqual({
      model: "nomic-embed-text",
      prompt: "hello",
    });
  });

  it("throws a loud error when the embedding response shape is wrong", async () => {
    const backend = new OllamaBackend({
      fetch: async () => jsonResponse({ embedding: ["oops"] }),
    });

    await expect(backend.embed("bad vector")).rejects.toThrow("Invalid Ollama embeddings response");
  });
});
