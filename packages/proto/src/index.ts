/**
 * @lesearch/proto — the shared contract.
 *
 * Status enum + codes, plus zod validators mirroring the versioned JSON Schemas
 * under schemas/. Every other package depends on this so there is exactly one
 * definition of what a status, a run, a memory row, and a telemetry event are.
 */
export * from "./status";
export {
  RunSchema,
  RunStateSchema,
  RUN_STATES,
  type Run,
  type RunState,
  MemorySchema,
  type Memory,
  TelemetryEventSchema,
  type TelemetryEvent,
} from "./contracts";
