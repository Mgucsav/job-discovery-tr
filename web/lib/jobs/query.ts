import {
  ACQUISITION_METHODS,
  EXPERIENCE_LEVELS,
  JOB_SOURCES,
  inferExperienceLevel,
  type AcquisitionMethod,
  type ExperienceLevel,
  type JobSource,
} from "@/lib/core";

export type SortOrder = "newest" | "oldest";
// "unknown": başlıktan düzey çıkarılamayan ilanlar.
export type LevelFilter = ExperienceLevel | "unknown";

export interface JobListQuery {
  source: JobSource | null;
  method: AcquisitionMethod | null;
  level: LevelFilter | null;
  sort: SortOrder;
  // Başvurulan ilanlar liste dışında tutulur; başvurular kendi sayfasında izlenir.
  includeApplied: boolean;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// URL parametrelerinden güvenli filtre/sıralama üretir; bilinmeyen değerler yok sayılır.
export function parseJobListQuery(params: Record<string, string | string[] | undefined>): JobListQuery {
  const rawSource = firstValue(params.source);
  const rawMethod = firstValue(params.method);
  const rawLevel = firstValue(params.level);
  const rawSort = firstValue(params.sort);
  const source = JOB_SOURCES.find((candidate) => candidate === rawSource) ?? null;
  const method = ACQUISITION_METHODS.find((candidate) => candidate === rawMethod) ?? null;
  const level: LevelFilter | null = rawLevel === "unknown" ? "unknown" : (EXPERIENCE_LEVELS.find((candidate) => candidate === rawLevel) ?? null);
  const sort: SortOrder = rawSort === "oldest" ? "oldest" : "newest";
  const includeApplied = firstValue(params.applied) === "1";
  return { source, method, level, sort, includeApplied };
}

export function buildJobListHref(query: JobListQuery): string {
  const search = new URLSearchParams();
  if (query.source) search.set("source", query.source);
  if (query.method) search.set("method", query.method);
  if (query.level) search.set("level", query.level);
  if (query.sort !== "newest") search.set("sort", query.sort);
  if (query.includeApplied) search.set("applied", "1");
  const encoded = search.toString();
  return encoded ? `/?${encoded}` : "/";
}

export interface SortableJob {
  source: JobSource;
  acquisitionMethod: AcquisitionMethod;
  firstSeenAt: string;
  title: string | null;
  description?: string | null;
  application?: { status: string } | null;
}

// Deneyim düzeyi saklanmaz; başlıktan (yoksa açıklamadan) her okumada çıkarılır, böylece kural
// değiştiğinde eski kayıtlar da güncel sınıflandırmayla görünür.
export function jobLevel(job: Pick<SortableJob, "title" | "description">): LevelFilter {
  return inferExperienceLevel(job.title, job.description ?? null)?.level ?? "unknown";
}

// Kişisel ölçekte liste bellekte filtrelenir ve sıralanır (bileşik Firestore indeksi gerekmez).
export function applyJobListQuery<T extends SortableJob>(jobs: readonly T[], query: JobListQuery): T[] {
  const filtered = jobs.filter(
    (job) =>
      (query.includeApplied || !job.application) &&
      (query.source === null || job.source === query.source) &&
      (query.method === null || job.acquisitionMethod === query.method) &&
      (query.level === null || jobLevel(job) === query.level),
  );
  filtered.sort((a, b) =>
    query.sort === "oldest" ? a.firstSeenAt.localeCompare(b.firstSeenAt) : b.firstSeenAt.localeCompare(a.firstSeenAt),
  );
  return filtered;
}

// Filtre çubuğunda yalnızca listede gerçekten bulunan düzeyler gösterilir.
export function availableLevels(jobs: readonly SortableJob[]): LevelFilter[] {
  const present = new Set<LevelFilter>(jobs.map((job) => jobLevel(job)));
  const ordered: LevelFilter[] = EXPERIENCE_LEVELS.filter((level) => present.has(level));
  if (present.has("unknown")) ordered.push("unknown");
  return ordered;
}
