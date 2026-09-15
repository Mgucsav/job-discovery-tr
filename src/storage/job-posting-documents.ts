import {
  ACQUISITION_METHODS,
  JOB_SOURCES,
  type AcquisitionMethod,
  type DiscoveryRunReport,
  type JobSource,
  type NewPostingSummary,
  type NotificationReport,
  type StoredDiscoveryRun,
  type StoredJobPosting,
  type StoredJobPostingInput,
} from "../domain.ts";
import type { UpsertOutcome } from "./repository.ts";

// Firestore belge yerleşimi (CLI ve web tarafından ortak kullanılır; firebase-admin'e bağımlı değildir):
//   users/{uid}/jobPostings/{source__sourceJobId}   -> ilan
//   users/{uid}/discoveryRuns/{startedAt}           -> keşif koşusu özeti
// Zaman alanları ISO-8601 (UTC) metin olarak saklanır; böylece iki ayrı firebase-admin kopyası arasında
// Timestamp nesnesi taşınmaz ve sözlük sıralaması kronolojik sıralamaya eşittir.

export type DocumentData = Record<string, unknown>;

export const USERS_COLLECTION = "users";
export const JOB_POSTINGS_COLLECTION = "jobPostings";
export const DISCOVERY_RUNS_COLLECTION = "discoveryRuns";

const DOC_ID_PATTERN = /^(linkedin|kariyer|indeed)__[a-z0-9]{1,64}$/;

export function jobPostingDocumentId(source: JobSource, sourceJobId: string): string {
  return `${source}__${sourceJobId}`;
}

export function isJobPostingDocumentId(value: string): boolean {
  return DOC_ID_PATTERN.test(value);
}

// Birleştirme kuralı JsonFileJobRepository.upsert ile aynıdır:
//   * daha eski görülme -> ilk görülme bilgisi ve onu sağlayan edinilme kaynağı geriye çekilir
//   * eksik başlık/şirket/konum/açıklama sonradan tamamlanır; mevcut değer asla ezilmez
//   * değişiklik yoksa 'unchanged'
export interface MergeableJobPosting {
  firstSeenAt: string;
  acquisitionMethod: AcquisitionMethod;
  sourceEmailId: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
}

export type MergeChanges = Partial<MergeableJobPosting>;

const FILLABLE_FIELDS = ["title", "company", "location", "description"] as const;

export function mergeJobPosting(
  current: MergeableJobPosting,
  incoming: MergeableJobPosting,
): { outcome: "updated" | "unchanged"; changes: MergeChanges } {
  const changes: MergeChanges = {};
  if (incoming.firstSeenAt < current.firstSeenAt) {
    changes.firstSeenAt = incoming.firstSeenAt;
    changes.acquisitionMethod = incoming.acquisitionMethod;
    changes.sourceEmailId = incoming.sourceEmailId;
  }
  for (const field of FILLABLE_FIELDS) {
    if (current[field] === null && incoming[field] !== null) changes[field] = incoming[field];
  }
  return Object.keys(changes).length > 0 ? { outcome: "updated", changes } : { outcome: "unchanged", changes };
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// ISO metin beklenir; eski kayıtlarda Firestore Timestamp (toDate) varsa ona da tolerans gösterilir.
function isoString(value: unknown): string | null {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function acquisitionMethod(value: unknown): AcquisitionMethod | null {
  return ACQUISITION_METHODS.find((candidate) => candidate === value) ?? null;
}

export function buildJobPostingDocument(input: StoredJobPostingInput, ownerId: string, nowIso: string): DocumentData {
  return {
    ownerId,
    source: input.source,
    sourceJobId: input.sourceJobId,
    url: input.url,
    title: input.title,
    company: input.company,
    location: input.location,
    description: input.description,
    firstSeenAt: input.firstSeenAt,
    acquisitionMethod: input.acquisitionMethod,
    sourceEmailId: input.sourceEmailId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export type UpsertPlan =
  | { outcome: "inserted"; write: DocumentData }
  | { outcome: "updated"; update: DocumentData }
  | { outcome: "unchanged" };

// Transaction içinde okunan mevcut belgeye göre yazma planı üretir (saf fonksiyon).
export function planJobPostingUpsert(
  current: DocumentData | null,
  input: StoredJobPostingInput,
  ownerId: string,
  nowIso: string,
): UpsertPlan {
  if (!current) return { outcome: "inserted", write: buildJobPostingDocument(input, ownerId, nowIso) };
  const mergeable: MergeableJobPosting = {
    firstSeenAt: isoString(current.firstSeenAt) ?? new Date(0).toISOString(),
    acquisitionMethod: acquisitionMethod(current.acquisitionMethod) ?? "manual",
    sourceEmailId: nullableString(current.sourceEmailId),
    title: nullableString(current.title),
    company: nullableString(current.company),
    location: nullableString(current.location),
    description: nullableString(current.description),
  };
  const { outcome, changes } = mergeJobPosting(mergeable, input);
  if (outcome === "unchanged") return { outcome };
  return { outcome, update: { ...changes, updatedAt: nowIso } };
}

// Bozuk/eksik belgeler görünüm modeline alınmaz; alanlar uydurulmaz.
export function parseJobPostingDocument(id: string, data: DocumentData): StoredJobPosting | null {
  const source = JOB_SOURCES.find((candidate) => candidate === data.source);
  const sourceJobId = nullableString(data.sourceJobId);
  const url = nullableString(data.url);
  const firstSeenAt = isoString(data.firstSeenAt);
  const method = acquisitionMethod(data.acquisitionMethod);
  if (!source || !sourceJobId || !url || !firstSeenAt || !method) return null;
  const title = nullableString(data.title);
  const description = nullableString(data.description);
  return {
    id,
    source,
    sourceJobId,
    url,
    title,
    titleStatus: title === null ? "missing" : "present",
    company: nullableString(data.company),
    location: nullableString(data.location),
    description,
    descriptionStatus: description === null ? "missing" : "present",
    firstSeenAt,
    acquisitionMethod: method,
    sourceEmailId: nullableString(data.sourceEmailId),
  };
}

export function isUpsertOutcome(value: unknown): value is UpsertOutcome {
  return value === "inserted" || value === "updated" || value === "unchanged";
}

// Keşif koşusu özeti: rapor olduğu gibi saklanır, toplamlar sorgu kolaylığı için eklenir.
export function buildDiscoveryRunDocument(report: DiscoveryRunReport, ownerId: string): DocumentData {
  const sources = Object.values(report.sources);
  return {
    ownerId,
    ...report,
    newJobsTotal: sources.reduce((sum, source) => sum + source.newJobs, 0),
    duplicateJobsTotal: sources.reduce((sum, source) => sum + source.duplicateJobs, 0),
  };
}

export function discoveryRunDocumentId(report: DiscoveryRunReport): string {
  return report.startedAt.replace(/[:.]/g, "-");
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseDiscoveryRunDocument(id: string, data: DocumentData): StoredDiscoveryRun | null {
  const startedAt = isoString(data.startedAt);
  const finishedAt = isoString(data.finishedAt);
  const emailsRead = finiteNumber(data.emailsRead);
  const unresolvedEmails = finiteNumber(data.unresolvedEmails);
  const repositoryErrors = finiteNumber(data.repositoryErrors);
  const gmailStatus = data.gmailStatus;
  const rawSources = data.sources;
  if (
    !startedAt ||
    !finishedAt ||
    emailsRead === null ||
    unresolvedEmails === null ||
    repositoryErrors === null ||
    (gmailStatus !== "not_used" && gmailStatus !== "ok" && gmailStatus !== "error") ||
    !rawSources ||
    typeof rawSources !== "object"
  ) {
    return null;
  }
  const sources = {} as DiscoveryRunReport["sources"];
  for (const source of JOB_SOURCES) {
    const entry = (rawSources as Record<string, unknown>)[source];
    if (!entry || typeof entry !== "object") return null;
    const record = entry as Record<string, unknown>;
    const jobsFound = finiteNumber(record.jobsFound);
    const newJobs = finiteNumber(record.newJobs);
    const duplicateJobs = finiteNumber(record.duplicateJobs);
    const errorCount = finiteNumber(record.errorCount);
    if (jobsFound === null || newJobs === null || duplicateJobs === null || errorCount === null) return null;
    sources[source] = {
      status: record.status === "error" ? "error" : "ok",
      jobsFound,
      newJobs,
      duplicateJobs,
      errorCount,
    };
  }
  const newPostings: NewPostingSummary[] = [];
  if (Array.isArray(data.newPostings)) {
    for (const entry of data.newPostings as unknown[]) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const source = JOB_SOURCES.find((candidate) => candidate === record.source);
      const sourceJobId = nullableString(record.sourceJobId);
      const url = nullableString(record.url);
      if (source && sourceJobId && url) newPostings.push({ source, sourceJobId, url, title: nullableString(record.title) });
    }
  }
  const rawNotification = (data.notification ?? null) as Record<string, unknown> | null;
  const notification: NotificationReport = {
    channel: rawNotification?.channel === "telegram" ? "telegram" : "none",
    status:
      rawNotification?.status === "sent" || rawNotification?.status === "skipped" || rawNotification?.status === "error"
        ? rawNotification.status
        : "not_configured",
    messages: finiteNumber(rawNotification?.messages) ?? 0,
  };
  const report: DiscoveryRunReport = {
    startedAt,
    finishedAt,
    emailsRead,
    unresolvedEmails,
    repositoryErrors,
    gmailStatus,
    sources,
    newPostings,
    notification,
  };
  const totals = buildDiscoveryRunDocument(report, "");
  return {
    id,
    ...report,
    newJobsTotal: totals.newJobsTotal as number,
    duplicateJobsTotal: totals.duplicateJobsTotal as number,
  };
}
