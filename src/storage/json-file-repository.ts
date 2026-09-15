import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { JobPosting } from "../domain.ts";
import type { JobRepository, UpsertOutcome } from "./repository.ts";

interface StoreDocument {
  schemaVersion: 1;
  postings: JobPosting[];
}

function keyOf(posting: Pick<JobPosting, "source" | "sourceJobId">): string {
  return `${posting.source}:${posting.sourceJobId}`;
}

export class JsonFileJobRepository implements JobRepository {
  private loaded = false;
  private readonly postings = new Map<string, JobPosting>();

  public constructor(private readonly filePath: string) {}

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const document = JSON.parse(raw) as StoreDocument;
      if (document.schemaVersion !== 1 || !Array.isArray(document.postings)) {
        throw new Error("Desteklenmeyen veya bozuk depo biçimi.");
      }
      for (const posting of document.postings) this.postings.set(keyOf(posting), posting);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    const document: StoreDocument = {
      schemaVersion: 1,
      postings: [...this.postings.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b))),
    };
    await writeFile(tempPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(tempPath, this.filePath);
  }

  public async upsert(posting: JobPosting): Promise<UpsertOutcome> {
    await this.load();
    const key = keyOf(posting);
    const current = this.postings.get(key);
    if (!current) {
      this.postings.set(key, posting);
      await this.persist();
      return "inserted";
    }

    const incomingIsEarlier = posting.firstSeenAt < current.firstSeenAt;
    const improvedTitle = current.title === null && posting.title !== null;
    const improvedCompany = (current.company ?? null) === null && posting.company !== null;
    const improvedLocation = (current.location ?? null) === null && posting.location !== null;
    if (!incomingIsEarlier && !improvedTitle && !improvedCompany && !improvedLocation) return "unchanged";

    this.postings.set(key, {
      ...current,
      company: current.company ?? null,
      location: current.location ?? null,
      ...(improvedTitle ? { title: posting.title, titleStatus: "present" as const } : {}),
      ...(improvedCompany ? { company: posting.company } : {}),
      ...(improvedLocation ? { location: posting.location } : {}),
      ...(incomingIsEarlier
        ? { firstSeenAt: posting.firstSeenAt, sourceEmailId: posting.sourceEmailId }
        : {}),
    });
    await this.persist();
    return "updated";
  }

  public async list(): Promise<JobPosting[]> {
    await this.load();
    return [...this.postings.values()];
  }
}
