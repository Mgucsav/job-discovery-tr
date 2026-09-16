import type { StoredJobPosting } from "../domain.ts";

// Dönemsel takip: "bu dönem ne kadar ilan açıldı, ne kadarına başvurdum, ne kadarı olumlu döndü"
// sorusunu önceki eşit uzunluktaki dönemle karşılaştırarak yanıtlar.
//
// Sınır: ilanda tek bir başvuru kaydı tutulur; sonuç tarihi (decidedAt) en son duruma aittir.
// Bir başvuru görüşmeden sonra reddedildiyse yalnızca "red" olarak sayılır, görüşme ayrıca sayılmaz.

export interface PeriodMetrics {
  discovered: number;
  applied: number;
  interview: number;
  offer: number;
  rejected: number;
  positive: number;
  decided: number;
  // Oranlar bölünecek değer yoksa null döner; sıfıra bölme veya uydurma yüzde yoktur.
  applyRate: number | null;
  responseRate: number | null;
  positiveRate: number | null;
}

export interface PeriodWindow {
  startAt: string;
  endAt: string;
  metrics: PeriodMetrics;
}

export interface PeriodComparison {
  windowDays: number;
  current: PeriodWindow;
  previous: PeriodWindow;
}

export const PERIOD_OPTIONS = [7, 30, 90] as const;

export type PeriodDays = (typeof PERIOD_OPTIONS)[number];

export function isPeriodDays(value: unknown): value is PeriodDays {
  return PERIOD_OPTIONS.some((option) => String(option) === String(value));
}

const DAY_MS = 24 * 60 * 60 * 1000;

function inRange(value: string | null | undefined, startAt: string, endAt: string): boolean {
  return typeof value === "string" && value >= startAt && value < endAt;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function metricsForRange(jobs: readonly StoredJobPosting[], startAt: string, endAt: string): PeriodMetrics {
  let discovered = 0;
  let applied = 0;
  let interview = 0;
  let offer = 0;
  let rejected = 0;

  for (const job of jobs) {
    if (inRange(job.firstSeenAt, startAt, endAt)) discovered += 1;
    const application = job.application;
    if (!application) continue;
    if (inRange(application.appliedAt, startAt, endAt)) applied += 1;
    if (inRange(application.decidedAt, startAt, endAt)) {
      if (application.status === "interview") interview += 1;
      else if (application.status === "offer") offer += 1;
      else if (application.status === "rejected") rejected += 1;
    }
  }

  const positive = interview + offer;
  const decided = positive + rejected;
  return {
    discovered,
    applied,
    interview,
    offer,
    rejected,
    positive,
    decided,
    applyRate: rate(applied, discovered),
    responseRate: rate(decided, applied),
    positiveRate: rate(positive, decided),
  };
}

// Bitiş anı hariç tutulur; böylece ardışık dönemler çakışmaz.
export function comparePeriods(
  jobs: readonly StoredJobPosting[],
  windowDays: PeriodDays,
  now: Date = new Date(),
): PeriodComparison {
  const end = now.getTime();
  const currentStart = end - windowDays * DAY_MS;
  const previousStart = currentStart - windowDays * DAY_MS;
  const iso = (value: number): string => new Date(value).toISOString();
  return {
    windowDays,
    current: {
      startAt: iso(currentStart),
      endAt: iso(end),
      metrics: metricsForRange(jobs, iso(currentStart), iso(end)),
    },
    previous: {
      startAt: iso(previousStart),
      endAt: iso(currentStart),
      metrics: metricsForRange(jobs, iso(previousStart), iso(currentStart)),
    },
  };
}

export interface MetricDelta {
  absolute: number;
  // Önceki dönem sıfırsa yüzde değişim tanımsızdır (null).
  ratio: number | null;
}

export function delta(current: number, previous: number): MetricDelta {
  return { absolute: current - previous, ratio: previous > 0 ? (current - previous) / previous : null };
}

export interface TrendBucket extends PeriodWindow {
  label: string;
}

// Son N haftanın (7 günlük dilimler, en yeni en üstte) kırılımı.
export function weeklyTrend(jobs: readonly StoredJobPosting[], weeks: number, now: Date = new Date()): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  const end = now.getTime();
  for (let index = 0; index < weeks; index += 1) {
    const bucketEnd = end - index * 7 * DAY_MS;
    const bucketStart = bucketEnd - 7 * DAY_MS;
    const startAt = new Date(bucketStart).toISOString();
    const endAt = new Date(bucketEnd).toISOString();
    buckets.push({
      startAt,
      endAt,
      label: index === 0 ? "Bu hafta" : index === 1 ? "Geçen hafta" : `${index} hafta önce`,
      metrics: metricsForRange(jobs, startAt, endAt),
    });
  }
  return buckets;
}
