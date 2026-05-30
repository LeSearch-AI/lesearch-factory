/** A LeSearch event as carried on the live stream. */
export interface LeEvent {
  type: string; // run.started | session.failed | session.waiting_approval | log | ...
  ts: string;
  run_id?: string;
  agent_id?: string;
  [k: string]: unknown;
}

export type Listener = (e: LeEvent) => void;

/** In-process pub/sub for the gateway event stream. No external broker. */
export class EventBus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(e: LeEvent): void {
    for (const l of this.listeners) l(e);
  }

  get size(): number {
    return this.listeners.size;
  }
}
