import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  TelemetryEventSchema,
  type TelemetryEvent,
} from "../../proto/src/index";

export type PropertyValue = string | number | boolean | null;

export interface TelemetryOptions {
  env?: Record<string, string | undefined>;
  installIdPath?: string;
  sender?: (event: TelemetryEvent) => void | Promise<void>;
  now?: () => string;
  posthogKey?: string;
  captureUrl?: string;
  timeoutMs?: number;
}

export interface PostHogCaptureBody {
  api_key: string;
  event: string;
  distinct_id: string;
  properties: Record<string, PropertyValue | boolean>;
  timestamp: string;
}

interface DefaultPostHogSenderOptions {
  posthogKey?: string;
  captureUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_CAPTURE_URL = "https://us.i.posthog.com/capture/";
const DEFAULT_TIMEOUT_MS = 3000;
const DISABLED_ENV_VALUES = new Set(["0", "false"]);
const DANGEROUS_PROPERTY_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const EVENT_ALLOWLIST = [
  "stack.up",
  "stack.down",
  "agent.run",
  "doctor.fail",
  "inference.generate",
] as const;

const EVENT_ALLOWLIST_SET = new Set<string>(EVENT_ALLOWLIST);

export class Telemetry {
  private readonly env: Record<string, string | undefined>;
  private readonly installIdPath: string;
  private readonly now: () => string;
  private readonly sender: (event: TelemetryEvent) => void | Promise<void>;
  private installIdPromise?: Promise<string>;

  constructor(options: TelemetryOptions = {}) {
    this.env = options.env ?? process.env;
    this.installIdPath = options.installIdPath ?? join(homedir(), ".lesearch", "install_id");
    this.now = options.now ?? defaultNow;
    this.sender =
      options.sender ??
      ((event) =>
        defaultPostHogSender(event, {
          posthogKey: options.posthogKey ?? this.env.LESEARCH_POSTHOG_KEY,
          captureUrl: options.captureUrl ?? DEFAULT_CAPTURE_URL,
          timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        }));
  }

  async capture(event: string, properties?: Record<string, unknown>): Promise<void> {
    if (isTelemetryDisabled(this.env)) {
      return;
    }

    if (!isAllowedEvent(event)) {
      return;
    }

    const installId = await this.getInstallId();
    const sanitizedProperties = sanitizeProperties(properties);
    const candidateEvent = buildTelemetryEvent({
      installId,
      event,
      ts: this.now(),
      properties: sanitizedProperties,
      lesearchVersion: readLeSearchVersion(this.env),
    });
    const parsedEvent = TelemetryEventSchema.safeParse(candidateEvent);

    if (!parsedEvent.success) {
      return;
    }

    try {
      await this.sender(parsedEvent.data);
    } catch {
      // Telemetry is best-effort only; a failed analytics send must never crash or block the host program.
    }
  }

  private getInstallId(): Promise<string> {
    this.installIdPromise ??= resolveInstallId(this.installIdPath);
    return this.installIdPromise;
  }
}

export function isTelemetryDisabled(env: Record<string, string | undefined>): boolean {
  const rawValue = env.LESEARCH_TELEMETRY;

  if (rawValue === undefined) {
    return false;
  }

  return DISABLED_ENV_VALUES.has(rawValue.trim().toLowerCase());
}

export function isAllowedEvent(event: string): boolean {
  return EVENT_ALLOWLIST_SET.has(event);
}

export function sanitizeProperties(
  properties?: Record<string, unknown>,
): Record<string, PropertyValue> | undefined {
  if (properties === undefined) {
    return undefined;
  }

  const sanitized: Record<string, PropertyValue> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (DANGEROUS_PROPERTY_KEYS.has(key)) {
      continue;
    }

    if (isPropertyValue(value)) {
      sanitized[key] = value;
    }
  }

  if (Object.keys(sanitized).length === 0) {
    return undefined;
  }

  return sanitized;
}

export function buildTelemetryEvent(input: {
  installId: string;
  event: string;
  ts: string;
  properties?: Record<string, PropertyValue>;
  lesearchVersion?: string;
}): Record<string, unknown> {
  const event: Record<string, unknown> = {
    install_id: input.installId,
    event: input.event,
    ts: input.ts,
  };

  if (input.properties !== undefined) {
    event.properties = input.properties;
  }

  if (input.lesearchVersion !== undefined) {
    event.lesearch_version = input.lesearchVersion;
  }

  return event;
}

export async function resolveInstallId(installIdPath: string): Promise<string> {
  try {
    // Local install-id reads intentionally wait on disk; they are fast, process-local, and not on the network path.
    const existingValue = await readFile(installIdPath, "utf8");
    const installId = existingValue.trim();

    if (installId.length > 0) {
      return installId;
    }
  } catch {
    // Missing or unreadable install-id files fall through to anonymous id generation so the host keeps working.
  }

  const generatedInstallId = randomUUID();

  try {
    // Local directory creation intentionally waits on disk because the install id must persist when possible.
    await mkdir(dirname(installIdPath), { recursive: true });
    // Local file writes intentionally wait on disk so later captures reuse the same anonymous id when storage works.
    await writeFile(installIdPath, generatedInstallId, "utf8");
    return generatedInstallId;
  } catch {
    // Telemetry persistence failures must not crash the host; fall back to an anonymous in-memory id for this process.
    return generatedInstallId;
  }
}

export function buildPostHogCaptureBody(
  event: TelemetryEvent,
  apiKey: string,
): PostHogCaptureBody {
  const properties: Record<string, PropertyValue | boolean> = {
    ...(event.properties ?? {}),
    $process_person_profile: false,
  };

  if (event.lesearch_version !== undefined) {
    properties.lesearch_version = event.lesearch_version;
  }

  return {
    api_key: apiKey,
    event: event.event,
    distinct_id: event.install_id,
    properties,
    timestamp: event.ts,
  };
}

export async function defaultPostHogSender(
  event: TelemetryEvent,
  options: DefaultPostHogSenderOptions = {},
): Promise<void> {
  const apiKey = options.posthogKey?.trim();

  if (!apiKey) {
    return;
  }

  const controller = new AbortController();
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (options.fetchImpl ?? fetch)(options.captureUrl ?? DEFAULT_CAPTURE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(buildPostHogCaptureBody(event, apiKey)),
      signal: controller.signal,
    });

    if (typeof response.ok !== "boolean" || !response.ok) {
      return;
    }
  } catch {
    // Telemetry is best-effort only; network failures or aborts must never crash or stall the host program.
  } finally {
    clearTimeout(timeoutId);
  }
}

export function wirePhaseTwoTelemetryStub(): void {
  // Phase 2 stub: task 9.2 will wire gateway and CLI feature/health events into a dashboard usage view.
}

function defaultNow(): string {
  return new Date().toISOString();
}

function normalizeTimeoutMs(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return timeoutMs;
}

function isPropertyValue(value: unknown): value is PropertyValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

function readLeSearchVersion(env: Record<string, string | undefined>): string | undefined {
  const version = env.LESEARCH_VERSION?.trim();

  if (!version) {
    return undefined;
  }

  return version;
}
