import { loadConfig } from "./config.js";
import { runDiscovery, DiscoveryRunError } from "./discovery/service.js";
import { GmailReadonlyClient } from "./gmail/client.js";
import { printReport } from "./report.js";
import { JsonFileJobRepository } from "./storage/json-file-repository.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const gmail = new GmailReadonlyClient(config.gmail);
  const repository = new JsonFileJobRepository(config.storePath);
  const report = await runDiscovery(gmail, repository);
  printReport(report);
  if (report.repositoryErrors > 0 || Object.values(report.sources).some((source) => source.status === "error")) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  if (error instanceof DiscoveryRunError) printReport(error.report);
  console.error(error instanceof Error ? error.message : "Bilinmeyen hata");
  process.exitCode = 1;
});
