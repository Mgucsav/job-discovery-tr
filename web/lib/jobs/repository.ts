import "server-only";
import {
  deleteStoredJobPosting,
  latestDiscoveryRun,
  listStoredJobPostings,
  setJobApplication,
  upsertStoredJobPosting,
  type StoredDiscoveryRun,
  type StoredJobPosting,
  type ApplicationInput,
  type StoredJobPostingInput,
  type UpsertOutcome,
} from "@/lib/core";
import { getAdminFirestore } from "@/lib/firebase/admin";

// Web tarafı depo erişimi: belge yerleşimi, birleştirme kuralı ve ayrıştırma depo kökündeki ortak
// modülde (src/storage/job-posting-store.ts) yaşar; CLI'nın Gmail keşfi de aynı modülü kullanır.
// uid her zaman doğrulanmış oturumdan gelir.

export async function upsertJobPosting(uid: string, input: StoredJobPostingInput): Promise<UpsertOutcome> {
  return upsertStoredJobPosting(getAdminFirestore(), uid, input);
}

export async function listJobPostings(uid: string): Promise<StoredJobPosting[]> {
  return listStoredJobPostings(getAdminFirestore(), uid);
}

export async function deleteJobPosting(uid: string, id: string): Promise<boolean> {
  return deleteStoredJobPosting(getAdminFirestore(), uid, id);
}

export async function setApplication(uid: string, id: string, input: ApplicationInput) {
  return setJobApplication(getAdminFirestore(), uid, id, input);
}

export async function getLatestDiscoveryRun(uid: string): Promise<StoredDiscoveryRun | null> {
  return latestDiscoveryRun(getAdminFirestore(), uid);
}
