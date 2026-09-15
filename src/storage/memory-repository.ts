import type { JobPosting } from "../domain.ts";
import type { JobRepository, UpsertOutcome } from "./repository.ts";

export class MemoryJobRepository implements JobRepository {
  private readonly postings = new Map<string, JobPosting>();

  public async upsert(posting: JobPosting): Promise<UpsertOutcome> {
    const key = `${posting.source}:${posting.sourceJobId}`;
    const current = this.postings.get(key);
    if (!current) {
      this.postings.set(key, posting);
      return "inserted";
    }
    const next: JobPosting = { ...current };
    if (current.title === null && posting.title !== null) {
      next.title = posting.title;
      next.titleStatus = "present";
    }
    if (current.company === null && posting.company !== null) next.company = posting.company;
    if (current.location === null && posting.location !== null) next.location = posting.location;
    if (next.title === current.title && next.company === current.company && next.location === current.location) return "unchanged";
    this.postings.set(key, next);
    return "updated";
  }

  public async list(): Promise<JobPosting[]> {
    return [...this.postings.values()];
  }
}
