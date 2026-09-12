import type { DiscoveryRunReport } from "./domain.js";

export function printReport(report: DiscoveryRunReport): void {
  console.log(JSON.stringify(report, null, 2));
}
