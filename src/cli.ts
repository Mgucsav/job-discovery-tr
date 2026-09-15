import { loadConfig, type AppConfig } from "./config.ts";
import { runDiscovery, DiscoveryRunError } from "./discovery/service.ts";
import { getAdminFirestore, loadFirebaseAdminConfig, resolveOwnerId } from "./firebase/admin.ts";
import { GmailReadonlyClient } from "./gmail/client.ts";
import { printReport } from "./report.ts";
import type { DiscoveryRunReport } from "./domain.ts";
import { JsonFileJobRepository } from "./storage/json-file-repository.ts";
import { FirestoreJobRepository, saveDiscoveryRun, type JobPostingStore } from "./storage/job-posting-store.ts";
import type { JobRepository } from "./storage/repository.ts";

interface SelectedStore {
  repository: JobRepository;
  // Firestore deposunda koşu özeti de kaydedilir; web arayüzü "son keşif" satırını buradan okur.
  persistRun: ((report: DiscoveryRunReport) => Promise<void>) | null;
}

async function selectStore(config: AppConfig): Promise<SelectedStore> {
  if (config.store.kind === "json") {
    return { repository: new JsonFileJobRepository(config.store.filePath), persistRun: null };
  }
  const firebase = loadFirebaseAdminConfig();
  const ownerId = await resolveOwnerId(firebase, config.store.ownerEmail);
  const store: JobPostingStore = getAdminFirestore(firebase);
  return {
    repository: new FirestoreJobRepository(store, ownerId),
    persistRun: async (report) => {
      await saveDiscoveryRun(store, ownerId, report);
    },
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const gmail = new GmailReadonlyClient(config.gmail);
  const { repository, persistRun } = await selectStore(config);

  let report: DiscoveryRunReport;
  try {
    report = await runDiscovery(gmail, repository);
  } catch (error) {
    if (error instanceof DiscoveryRunError && persistRun) await persistRun(error.report).catch(() => undefined);
    throw error;
  }

  if (persistRun) {
    try {
      await persistRun(report);
    } catch {
      report.repositoryErrors += 1;
      console.error("Koşu raporu Firestore'a kaydedilemedi.");
    }
  }

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
