import { z } from "zod";

/** Mirrors lesearch.run.v1.schema.json */
export const RUN_STATES = [
  "pending",
  "running",
  "waiting_approval",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export const RunStateSchema = z.enum(RUN_STATES);
export type RunState = (typeof RUN_STATES)[number];

const TaskSchema = z.object({
  task_id: z.string(),
  title: z.string().optional(),
  state: RunStateSchema,
});

const SessionSchema = z.object({
  agent_id: z.string(),
  kind: z.string().optional(),
  state: RunStateSchema,
  exit_code: z.number().int().nullable().optional(),
  tasks: z.array(TaskSchema).optional(),
});

export const RunSchema = z.object({
  run_id: z.string(),
  objective: z.string().optional(),
  state: RunStateSchema,
  created_at: z.string(),
  sessions: z.array(SessionSchema),
}).passthrough();
export type Run = z.infer<typeof RunSchema>;

/** Mirrors lesearch.memory.v1.schema.json */
export const MemorySchema = z.object({
  id: z.string(),
  kind: z.enum(["working", "long_term", "episode", "summary"]),
  run_id: z.string(),
  agent_id: z.string(),
  content: z.string(),
  embedding: z.array(z.number()).nullable().optional(),
  ttl_s: z.number().int().nullable().optional(),
  created_at: z.string(),
}).passthrough();
export type Memory = z.infer<typeof MemorySchema>;

/** Mirrors lesearch.telemetry.v1.schema.json — anonymous, no code/secrets. */
export const TelemetryEventSchema = z.object({
  install_id: z.string(),
  event: z.string(),
  ts: z.string(),
  lesearch_version: z.string().optional(),
  properties: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
}).strict();
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
