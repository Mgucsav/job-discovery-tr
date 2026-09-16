import assert from "node:assert/strict";
import test from "node:test";
import { comparePeriods, delta, isPeriodDays, metricsForRange, weeklyTrend } from "../src/applications/trends.ts";
import type { ApplicationRecord, StoredJobPosting } from "../src/domain.ts";

const NOW = new Date("2026-09-30T12:00:00.000Z");

function job(
  id: string,
  firstSeenAt: string,
  application: Partial<ApplicationRecord> & { status: ApplicationRecord["status"] } | null = null,
): StoredJobPosting {
  return {
    id,
    source: "linkedin",
    sourceJobId: id,
    url: `https://www.linkedin.com/jobs/view/${id}`,
    title: "Veri Analisti",
    titleStatus: "present",
    company: null,
    location: null,
    description: null,
    descriptionStatus: "missing",
    firstSeenAt,
    acquisitionMethod: "gmail",
    sourceEmailId: "mail",
    application: application
      ? {
          appliedAt: null,
          decidedAt: null,
          cvId: null,
          cvName: null,
          notes: null,
          updatedAt: firstSeenAt,
          ...application,
        }
      : null,
  };
}

// Bu dönem: 16–30 Eylül. Önceki dönem: 1–16 Eylül (15 günlük pencere yerine 30 gün kullanılacağı için
// aşağıdaki testte 30 günlük pencere 31 Ağustos'tan başlar.)
const jobs: StoredJobPosting[] = [
  job("1", "2026-09-20T09:00:00.000Z", { status: "rejected", appliedAt: "2026-09-21T09:00:00.000Z", decidedAt: "2026-09-25T09:00:00.000Z" }),
  job("2", "2026-09-22T09:00:00.000Z", { status: "interview", appliedAt: "2026-09-23T09:00:00.000Z", decidedAt: "2026-09-28T09:00:00.000Z" }),
  job("3", "2026-09-24T09:00:00.000Z", { status: "applied", appliedAt: "2026-09-24T10:00:00.000Z" }),
  job("4", "2026-09-26T09:00:00.000Z"), // başvurulmadı
  // Önceki dönem (Ağustos sonu / Eylül başı)
  job("5", "2026-08-25T09:00:00.000Z", { status: "rejected", appliedAt: "2026-08-26T09:00:00.000Z", decidedAt: "2026-08-30T09:00:00.000Z" }),
  job("6", "2026-08-28T09:00:00.000Z", { status: "offer", appliedAt: "2026-08-29T09:00:00.000Z", decidedAt: "2026-08-31T09:00:00.000Z" }),
];

test("dönem ölçütleri: ilan, başvuru ve sonuçlar kendi tarih alanlarından sayılır", () => {
  const metrics = metricsForRange(jobs, "2026-09-16T00:00:00.000Z", "2026-10-01T00:00:00.000Z");
  assert.equal(metrics.discovered, 4);
  assert.equal(metrics.applied, 3);
  assert.equal(metrics.interview, 1);
  assert.equal(metrics.offer, 0);
  assert.equal(metrics.rejected, 1);
  assert.equal(metrics.positive, 1);
  assert.equal(metrics.decided, 2);
  assert.equal(metrics.applyRate, 3 / 4);
  assert.equal(metrics.responseRate, 2 / 3);
  assert.equal(metrics.positiveRate, 1 / 2);
});

test("bölünecek değer yoksa oran null döner (sıfıra bölme yok)", () => {
  const empty = metricsForRange([], "2026-09-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z");
  assert.deepEqual([empty.applyRate, empty.responseRate, empty.positiveRate], [null, null, null]);
});

test("bu dönem ile önceki eşit dönem çakışmadan karşılaştırılır", () => {
  const comparison = comparePeriods(jobs, 30, NOW);
  assert.equal(comparison.windowDays, 30);
  assert.equal(comparison.current.startAt, "2026-08-31T12:00:00.000Z");
  assert.equal(comparison.current.endAt, "2026-09-30T12:00:00.000Z");
  assert.equal(comparison.previous.startAt, "2026-08-01T12:00:00.000Z");
  assert.equal(comparison.previous.endAt, comparison.current.startAt, "dönemler bitişik ve çakışmasız");

  assert.equal(comparison.current.metrics.discovered, 4);
  assert.equal(comparison.current.metrics.applied, 3);
  assert.equal(comparison.previous.metrics.discovered, 2);
  assert.equal(comparison.previous.metrics.applied, 2);
  assert.equal(comparison.previous.metrics.positive, 1, "teklif önceki dönemde sayılır");
});

test("fark hesabı: önceki dönem sıfırsa yüzde değişim tanımsızdır", () => {
  assert.deepEqual(delta(3, 2), { absolute: 1, ratio: 0.5 });
  assert.deepEqual(delta(0, 4), { absolute: -4, ratio: -1 });
  assert.deepEqual(delta(5, 0), { absolute: 5, ratio: null });
});

test("haftalık kırılım en yeniden eskiye üretilir ve etiketlenir", () => {
  const weeks = weeklyTrend(jobs, 3, NOW);
  assert.deepEqual(weeks.map((bucket) => bucket.label), ["Bu hafta", "Geçen hafta", "2 hafta önce"]);
  assert.equal(weeks[0]?.endAt, NOW.toISOString());
  assert.equal(weeks[0]?.startAt, "2026-09-23T12:00:00.000Z");
  // 24 ve 26 Eylül'de görülen ilanlar bu haftadadır.
  assert.equal(weeks[0]?.metrics.discovered, 2);
  assert.equal(weeks[1]?.metrics.discovered, 2);
  assert.equal(weeks[2]?.metrics.discovered, 0);
});

test("dönem uzunluğu yalnızca tanımlı seçeneklerden gelir", () => {
  assert.equal(isPeriodDays("30"), true);
  assert.equal(isPeriodDays(7), true);
  assert.equal(isPeriodDays("365"), false);
  assert.equal(isPeriodDays(undefined), false);
});
