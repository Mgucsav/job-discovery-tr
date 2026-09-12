import { JOB_SOURCES, type JobSource } from "@/lib/core";

export type SortOrder = "newest" | "oldest";

export interface JobListQuery {
  source: JobSource | null;
  sort: SortOrder;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// URL parametrelerinden güvenli filtre/sıralama üretir; bilinmeyen değerler yok sayılır.
export function parseJobListQuery(params: Record<string, string | string[] | undefined>): JobListQuery {
  const rawSource = firstValue(params.source);
  const rawSort = firstValue(params.sort);
  const source = JOB_SOURCES.find((candidate) => candidate === rawSource) ?? null;
  const sort: SortOrder = rawSort === "oldest" ? "oldest" : "newest";
  return { source, sort };
}

export function buildJobListHref(query: JobListQuery): string {
  const search = new URLSearchParams();
  if (query.source) search.set("source", query.source);
  if (query.sort !== "newest") search.set("sort", query.sort);
  const encoded = search.toString();
  return encoded ? `/?${encoded}` : "/";
}

export interface SortableJob {
  source: JobSource;
  firstSeenAt: string;
}

// Kişisel ölçekte liste bellekte filtrelenir ve sıralanır (bileşik Firestore indeksi gerekmez).
export function applyJobListQuery<T extends SortableJob>(jobs: readonly T[], query: JobListQuery): T[] {
  const filtered = query.source ? jobs.filter((job) => job.source === query.source) : [...jobs];
  filtered.sort((a, b) =>
    query.sort === "oldest" ? a.firstSeenAt.localeCompare(b.firstSeenAt) : b.firstSeenAt.localeCompare(a.firstSeenAt),
  );
  return filtered;
}
