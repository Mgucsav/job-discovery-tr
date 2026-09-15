import type { DiscoveryRunReport } from "./domain.ts";

export function printReport(report: DiscoveryRunReport): void {
  console.log(JSON.stringify(report, null, 2));
}
