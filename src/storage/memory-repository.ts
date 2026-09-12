import type { JobPosting } from "../domain.js";
import type { JobRepository, UpsertOutcome } from "./repository.js";

export class MemoryJobRepository implements JobRepository {
  private readonly postings = new Map<string, JobPosting>();

  public async upsert(posting: JobPosting): Promise<UpsertOutcome> {
    const key = `${posting.source}:${posting.sourceJobId}`;
    const current = this.postings.get(key);
    if (!current) {
      this.postings.set(key, posting);
      return "inserted";
    }
    if (current.title === null && posting.title !== null) {
      this.postings.set(key, { ...current, title: posting.title, titleStatus: "present" });
      return "updated";
    }
    return "unchanged";
  }

  public async list(): Promise<JobPosting[]> {
    return [...this.postings.values()];
  }
}
