import { makeReport } from "../../proto/src/status.ts";

export interface InferenceBackend {
  name: string;
  load(model: string): Promise<void>;
  generate(req: { prompt: string; model?: string; maxTokens?: number }): Promise<{ text: string }>;
  embed(text: string): Promise<number[]>;
  health(): Promise<ReturnType<typeof makeReport>>;
}
