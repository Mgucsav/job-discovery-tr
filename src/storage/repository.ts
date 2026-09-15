import type { JobPosting } from "../domain.ts";

export type UpsertOutcome = "inserted" | "updated" | "unchanged";

export interface JobRepository {
  upsert(posting: JobPosting): Promise<UpsertOutcome>;
  list(): Promise<JobPosting[]>;
}
