import { ACQUISITION_METHODS, JOB_SOURCES, type AcquisitionMethod, type JobSource } from "@/lib/core";

export type SortOrder = "newest" | "oldest";

export interface JobListQuery {
  source: JobSource | null;
  method: AcquisitionMethod | null;
  sort: SortOrder;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// URL parametrelerinden güvenli filtre/sıralama üretir; bilinmeyen değerler yok sayılır.
export function parseJobListQuery(params: Record<string, string | string[] | undefined>): JobListQuery {
  const rawSource = firstValue(params.source);
  const rawMethod = firstValue(params.method);
  const rawSort = firstValue(params.sort);
  const source = JOB_SOURCES.find((candidate) => candidate === rawSource) ?? null;
  const method = ACQUISITION_METHODS.find((candidate) => candidate === rawMethod) ?? null;
  const sort: SortOrder = rawSort === "oldest" ? "oldest" : "newest";
  return { source, method, sort };
}

export function buildJobListHref(query: JobListQuery): string {
  const search = new URLSearchParams();
  if (query.source) search.set("source", query.source);
  if (query.method) search.set("method", query.method);
  if (query.sort !== "newest") search.set("sort", query.sort);
  const encoded = search.toString();
  return encoded ? `/?${encoded}` : "/";
}

export interface SortableJob {
  source: JobSource;
  acquisitionMethod: AcquisitionMethod;
  firstSeenAt: string;
}

// Kişisel ölçekte liste bellekte filtrelenir ve sıralanır (bileşik Firestore indeksi gerekmez).
export function applyJobListQuery<T extends SortableJob>(jobs: readonly T[], query: JobListQuery): T[] {
  const filtered = jobs.filter(
    (job) => (query.source === null || job.source === query.source) && (query.method === null || job.acquisitionMethod === query.method),
  );
  filtered.sort((a, b) =>
    query.sort === "oldest" ? a.firstSeenAt.localeCompare(b.firstSeenAt) : b.firstSeenAt.localeCompare(a.firstSeenAt),
  );
  return filtered;
}
