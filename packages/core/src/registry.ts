import {
  type ComponentReport,
  type ComponentStatus,
  makeReport,
  aggregateStatus,
} from "@lesearch/proto";

/**
 * Live registry of component health. The gateway's GET /status reads this; the
 * WebUI renders it. This is the canonical "what we have / what we don't" view.
 */
export class StatusRegistry {
  private reports = new Map<string, ComponentReport>();

  report(component: string, status: ComponentStatus, extra: { detail?: string; hint?: string } = {}): ComponentReport {
    const r = makeReport(component, status, extra);
    this.reports.set(component, r);
    return r;
  }

  set(report: ComponentReport): void {
    this.reports.set(report.component, report);
  }

  get(component: string): ComponentReport | undefined {
    return this.reports.get(component);
  }

  all(): ComponentReport[] {
    return [...this.reports.values()];
  }

  overall(): ComponentStatus {
    return aggregateStatus(this.all());
  }
}
