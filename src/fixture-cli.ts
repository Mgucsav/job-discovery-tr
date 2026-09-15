import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NormalizedEmail } from "./domain.ts";
import { runDiscovery } from "./discovery/service.ts";
import { printReport } from "./report.ts";
import { MemoryJobRepository } from "./storage/memory-repository.ts";

async function main(): Promise<void> {
  const fixturePath = path.resolve("tests/fixtures/job-alert-emails.json");
  const emails = JSON.parse(await readFile(fixturePath, "utf8")) as NormalizedEmail[];
  const repository = new MemoryJobRepository();
  const report = await runDiscovery({ listJobAlertEmails: async () => emails }, repository);
  printReport(report);
  console.log(`Bellekte saklanan tekil ilan: ${(await repository.list()).length}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bilinmeyen hata");
  process.exitCode = 1;
});
