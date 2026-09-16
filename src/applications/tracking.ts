import { inferExperienceLevel, EXPERIENCE_LABELS } from "../discovery/experience.ts";
import {
  APPLICATION_STATUSES,
  type ApplicationRecord,
  type ApplicationStatus,
  type JobSource,
  type StoredJobPosting,
} from "../domain.ts";

// Başvuru kaydının saf (depodan bağımsız) kuralları: durum geçişleri, doğrulama ve istatistik.
// Hiçbir tarih uydurulmaz; "ne zaman başvurdum" bilgisi kaydın oluşturulduğu andır.

export const APPLICATION_LABELS: Record<ApplicationStatus, string> = {
  applied: "Başvurdum",
  interview: "Görüşme",
  offer: "Teklif",
  rejected: "Reddedildi",
  withdrawn: "Geri çektim",
};

// Karar verilmiş (yanıt alınmış) sayılan durumlar; "yanıt oranı" bunlardan hesaplanır.
const DECIDED: ApplicationStatus[] = ["interview", "offer", "rejected"];
const POSITIVE: ApplicationStatus[] = ["interview", "offer"];

export const NOTES_MAX = 2000;
const CV_NAME_MAX = 80;
const CV_ID_PATTERN = /^[0-9a-f-]{36}$/i;

export interface ApplicationInput {
  // "none": başvuru kaydını tamamen kaldırır (yanlışlıkla işaretlenen ilanlar için).
  status: ApplicationStatus | "none";
  cvId?: string | null;
  cvName?: string | null;
  notes?: string | null;
}

export type ApplicationPlan = { ok: true; application: ApplicationRecord | null } | { ok: false; error: string };

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return APPLICATION_STATUSES.some((status) => status === value);
}

function optionalText(value: string | null | undefined, limit: number): string | null {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, limit);
}

// Mevcut kayda göre yeni kaydı üretir:
//   * "applied" ilk kez işaretlendiğinde başvuru zamanı yazılır, sonraki güncellemelerde korunur.
//   * Sonuç durumları (görüşme/teklif/red/geri çekme) karar zamanını yazar; durum değişmediyse
//     ilk karar zamanı korunur.
//   * Sonuç durumu başvuru kaydı olmadan işaretlenirse başvuru zamanı da o an atanır.
//   * CV ve not verilmemişse mevcut değerler korunur; boş metin gönderildiğinde temizlenir.
export function planApplicationUpdate(
  current: ApplicationRecord | null,
  input: ApplicationInput,
  nowIso: string,
): ApplicationPlan {
  if (input.status === "none") return { ok: true, application: null };
  if (!isApplicationStatus(input.status)) return { ok: false, error: "Geçersiz başvuru durumu." };
  if (input.cvId !== undefined && input.cvId !== null && !CV_ID_PATTERN.test(input.cvId)) {
    return { ok: false, error: "Geçersiz CV kimliği." };
  }

  const cvProvided = input.cvId !== undefined || input.cvName !== undefined;
  const cvId = cvProvided ? (input.cvId ?? null) : (current?.cvId ?? null);
  const cvName = cvProvided ? optionalText(input.cvName, CV_NAME_MAX) : (current?.cvName ?? null);
  const notes = input.notes !== undefined ? optionalText(input.notes, NOTES_MAX) : (current?.notes ?? null);

  const isDecided = DECIDED.includes(input.status) || input.status === "withdrawn";
  const appliedAt = current?.appliedAt ?? nowIso;
  const decidedAt = isDecided ? (current?.status === input.status ? (current.decidedAt ?? nowIso) : nowIso) : null;

  return {
    ok: true,
    application: { status: input.status, appliedAt, decidedAt, cvId, cvName, notes, updatedAt: nowIso },
  };
}

export interface ApplicationBucket {
  key: string;
  label: string;
  total: number;
  pending: number;
  interview: number;
  offer: number;
  rejected: number;
  withdrawn: number;
  // Yanıt oranı: karar verilmiş / toplam. Karar oranı hesaplanamıyorsa null (bölme yok).
  responseRate: number | null;
  // Olumlu oran: (görüşme + teklif) / karar verilmiş.
  positiveRate: number | null;
}

function emptyBucket(key: string, label: string): ApplicationBucket {
  return {
    key,
    label,
    total: 0,
    pending: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
    responseRate: null,
    positiveRate: null,
  };
}

function finalize(bucket: ApplicationBucket): ApplicationBucket {
  const decided = bucket.interview + bucket.offer + bucket.rejected;
  return {
    ...bucket,
    responseRate: bucket.total > 0 ? decided / bucket.total : null,
    positiveRate: decided > 0 ? (bucket.interview + bucket.offer) / decided : null,
  };
}

type KeyOf = (job: StoredJobPosting, application: ApplicationRecord) => { key: string; label: string };

// Yalnızca başvuru kaydı olan ilanlar sayılır; kayıtsız ilanlar istatistiğe girmez.
export function summarizeApplications(jobs: readonly StoredJobPosting[], keyOf: KeyOf): ApplicationBucket[] {
  const buckets = new Map<string, ApplicationBucket>();
  for (const job of jobs) {
    const application = job.application;
    if (!application) continue;
    const { key, label } = keyOf(job, application);
    const bucket = buckets.get(key) ?? emptyBucket(key, label);
    bucket.total += 1;
    if (application.status === "applied") bucket.pending += 1;
    else if (application.status === "interview") bucket.interview += 1;
    else if (application.status === "offer") bucket.offer += 1;
    else if (application.status === "rejected") bucket.rejected += 1;
    else if (application.status === "withdrawn") bucket.withdrawn += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map(finalize).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "tr"));
}

export function summarizeByCv(jobs: readonly StoredJobPosting[]): ApplicationBucket[] {
  return summarizeApplications(jobs, (_job, application) => ({
    key: application.cvId ?? "none",
    label: application.cvName ?? "CV seçilmedi",
  }));
}

const SOURCE_LABELS: Record<JobSource, string> = {
  linkedin: "LinkedIn",
  kariyer: "Kariyer.net",
  indeed: "Indeed",
};

export function summarizeBySource(jobs: readonly StoredJobPosting[]): ApplicationBucket[] {
  return summarizeApplications(jobs, (job) => ({ key: job.source, label: SOURCE_LABELS[job.source] }));
}

// Deneyim düzeyi başlıktan çıkarılır (tahmin); çıkarılamayanlar tek grupta toplanır.
export function summarizeByExperience(jobs: readonly StoredJobPosting[]): ApplicationBucket[] {
  return summarizeApplications(jobs, (job) => {
    const inferred = inferExperienceLevel(job.title, job.description);
    return inferred ? { key: inferred.level, label: EXPERIENCE_LABELS[inferred.level] } : { key: "unknown", label: "Belirtilmemiş" };
  });
}

export interface ApplicationTotals {
  applications: number;
  pending: number;
  decided: number;
  positive: number;
  rejected: number;
}

export function applicationTotals(jobs: readonly StoredJobPosting[]): ApplicationTotals {
  let applications = 0;
  let pending = 0;
  let decided = 0;
  let positive = 0;
  let rejected = 0;
  for (const job of jobs) {
    const application = job.application;
    if (!application) continue;
    applications += 1;
    if (application.status === "applied") pending += 1;
    if (DECIDED.includes(application.status)) decided += 1;
    if (POSITIVE.includes(application.status)) positive += 1;
    if (application.status === "rejected") rejected += 1;
  }
  return { applications, pending, decided, positive, rejected };
}
