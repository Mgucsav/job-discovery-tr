import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationTotals,
  planApplicationUpdate,
  summarizeByCv,
  summarizeByExperience,
  summarizeBySource,
} from "../src/applications/tracking.ts";
import type { ApplicationRecord, StoredJobPosting } from "../src/domain.ts";
import { setJobApplication, listStoredJobPostings, upsertStoredJobPosting } from "../src/storage/job-posting-store.ts";
import { MemoryStore } from "./helpers/memory-store.ts";

const CV_A = "11111111-1111-4111-8111-111111111111";
const CV_B = "22222222-2222-4222-8222-222222222222";
const T1 = "2026-09-16T10:00:00.000Z";
const T2 = "2026-09-18T10:00:00.000Z";
const T3 = "2026-09-20T10:00:00.000Z";

test("başvuru zamanı ilk işaretlemede yazılır ve sonraki güncellemelerde korunur", () => {
  const first = planApplicationUpdate(null, { status: "applied", cvId: CV_A, cvName: "Veri Analisti CV" }, T1);
  assert.ok(first.ok);
  assert.deepEqual(first.application, {
    status: "applied",
    appliedAt: T1,
    decidedAt: null,
    cvId: CV_A,
    cvName: "Veri Analisti CV",
    notes: null,
    updatedAt: T1,
  });

  const rejected = planApplicationUpdate(first.application, { status: "rejected", notes: "  Otomatik   red e-postası " }, T2);
  assert.ok(rejected.ok);
  assert.equal(rejected.application?.appliedAt, T1, "başvuru tarihi korunur");
  assert.equal(rejected.application?.decidedAt, T2);
  assert.equal(rejected.application?.cvId, CV_A, "CV verilmediğinde mevcut CV korunur");
  assert.equal(rejected.application?.notes, "Otomatik red e-postası");

  // Aynı durum tekrar kaydedilirse ilk karar zamanı korunur.
  const again = planApplicationUpdate(rejected.application, { status: "rejected" }, T3);
  assert.ok(again.ok);
  assert.equal(again.application?.decidedAt, T2);
});

test("sonuç durumu başvuru kaydı olmadan işaretlenebilir; 'none' kaydı siler", () => {
  const direct = planApplicationUpdate(null, { status: "interview" }, T2);
  assert.ok(direct.ok);
  assert.equal(direct.application?.appliedAt, T2);
  assert.equal(direct.application?.decidedAt, T2);

  const cleared = planApplicationUpdate(direct.application, { status: "none" }, T3);
  assert.ok(cleared.ok);
  assert.equal(cleared.application, null);
});

test("geçersiz durum ve CV kimliği reddedilir; boş not temizlenir", () => {
  const badStatus = planApplicationUpdate(null, { status: "hired" as never }, T1);
  assert.equal(badStatus.ok, false);

  const badCv = planApplicationUpdate(null, { status: "applied", cvId: "not-a-uuid" }, T1);
  assert.equal(badCv.ok, false);

  const withNote = planApplicationUpdate(null, { status: "applied", notes: "not" }, T1);
  assert.ok(withNote.ok);
  const clearedNote = planApplicationUpdate(withNote.application, { status: "applied", notes: "   " }, T2);
  assert.ok(clearedNote.ok);
  assert.equal(clearedNote.application?.notes, null);
});

function job(id: string, overrides: Partial<StoredJobPosting> & { application?: ApplicationRecord | null }): StoredJobPosting {
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
    firstSeenAt: T1,
    acquisitionMethod: "gmail",
    sourceEmailId: "mail-1",
    application: null,
    ...overrides,
  };
}

function application(status: ApplicationRecord["status"], cvId: string | null, cvName: string | null): ApplicationRecord {
  return { status, appliedAt: T1, decidedAt: status === "applied" ? null : T2, cvId, cvName, notes: null, updatedAt: T2 };
}

const jobs: StoredJobPosting[] = [
  job("1", { title: "Junior Data Analyst", application: application("rejected", CV_A, "Veri CV") }),
  job("2", { title: "Senior Data Analyst", application: application("interview", CV_A, "Veri CV") }),
  job("3", { title: "Finans Uzman Yardımcısı", application: application("rejected", CV_B, "Finans CV"), source: "kariyer" }),
  job("4", { title: "Data Engineer", application: application("applied", CV_B, "Finans CV") }),
  job("5", { title: "Data Scientist" }), // başvurulmamış: istatistiğe girmez
];

test("CV başına performans: yanıt ve olumlu oranları doğru hesaplanır", () => {
  const byCv = summarizeByCv(jobs);
  // Eşit sayıda başvuruda sıralama alfabetiktir (belirlenimli çıktı).
  assert.deepEqual(byCv.map((bucket) => bucket.label), ["Finans CV", "Veri CV"]);

  const veri = byCv[1]!;
  assert.equal(veri.total, 2);
  assert.equal(veri.rejected, 1);
  assert.equal(veri.interview, 1);
  assert.equal(veri.pending, 0);
  assert.equal(veri.responseRate, 1);
  assert.equal(veri.positiveRate, 0.5);

  const finans = byCv[0]!;
  assert.equal(finans.total, 2);
  assert.equal(finans.pending, 1);
  assert.equal(finans.responseRate, 0.5);
  assert.equal(finans.positiveRate, 0, "karar verilenlerin tamamı red");
});

test("kaynak ve deneyim düzeyi kırılımları; başvurusuz ilanlar sayılmaz", () => {
  const bySource = summarizeBySource(jobs);
  assert.deepEqual(
    bySource.map((bucket) => [bucket.label, bucket.total]),
    [["LinkedIn", 3], ["Kariyer.net", 1]],
  );

  const byLevel = summarizeByExperience(jobs);
  const labels = byLevel.map((bucket) => bucket.label);
  assert.ok(labels.includes("Junior"));
  assert.ok(labels.includes("Kıdemli"));
  assert.ok(labels.includes("Uzman yardımcısı"));
  assert.ok(labels.includes("Belirtilmemiş"), "Data Engineer başlığı düzey vermez");

  assert.deepEqual(applicationTotals(jobs), { applications: 4, pending: 1, decided: 3, positive: 1, rejected: 2 });
  assert.deepEqual(applicationTotals([job("6", {})]), { applications: 0, pending: 0, decided: 0, positive: 0, rejected: 0 });
});

test("depo: başvuru kaydı ilan belgesine yazılır, geçersiz ilan reddedilir", async () => {
  const store = new MemoryStore();
  const owner = "owner-uid";
  await upsertStoredJobPosting(store, owner, {
    source: "linkedin",
    sourceJobId: "4290012345",
    url: "https://www.linkedin.com/jobs/view/4290012345",
    title: "Junior Data Analyst",
    company: null,
    location: null,
    description: null,
    firstSeenAt: T1,
    acquisitionMethod: "manual",
    sourceEmailId: null,
  });

  const saved = await setJobApplication(
    store,
    owner,
    "linkedin__4290012345",
    { status: "applied", cvId: CV_A, cvName: "Veri CV" },
    () => new Date(T2),
  );
  assert.ok(saved.ok);
  assert.equal(saved.application?.appliedAt, T2);

  const [stored] = await listStoredJobPostings(store, owner);
  assert.equal(stored?.application?.status, "applied");
  assert.equal(stored?.application?.cvName, "Veri CV");

  const missing = await setJobApplication(store, owner, "linkedin__9999999999", { status: "applied" });
  assert.equal(missing.ok, false);
  const invalid = await setJobApplication(store, owner, "../users/other", { status: "applied" });
  assert.equal(invalid.ok, false);

  const cleared = await setJobApplication(store, owner, "linkedin__4290012345", { status: "none" }, () => new Date(T3));
  assert.ok(cleared.ok);
  assert.equal((await listStoredJobPostings(store, owner))[0]?.application, null);
});
