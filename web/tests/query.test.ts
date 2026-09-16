import assert from "node:assert/strict";
import test from "node:test";
import { applyJobListQuery, availableLevels, buildJobListHref, jobLevel, parseJobListQuery } from "../lib/jobs/query";

const base = { source: null, method: null, level: null, sort: "newest" as const, includeApplied: false };

const jobs = [
  {
    id: "a",
    source: "linkedin" as const,
    acquisitionMethod: "manual" as const,
    firstSeenAt: "2026-09-10T00:00:00.000Z",
    title: "Junior Data Analyst",
    application: null,
  },
  {
    id: "b",
    source: "linkedin" as const,
    acquisitionMethod: "gmail" as const,
    firstSeenAt: "2026-09-12T00:00:00.000Z",
    title: "Finans Uzman Yardımcısı",
    application: null,
  },
  {
    id: "c",
    source: "indeed" as const,
    acquisitionMethod: "gmail" as const,
    firstSeenAt: "2026-09-11T00:00:00.000Z",
    title: "Data Solutions Analyst",
    application: { status: "applied" },
  },
];

test("kaynak, edinilme, deneyim ve sıralama yalnızca bilinen değerleri kabul eder", () => {
  assert.deepEqual(parseJobListQuery({}), base);
  assert.deepEqual(parseJobListQuery({ source: "kariyer", method: "gmail", level: "senior", sort: "oldest", applied: "1" }), {
    source: "kariyer",
    method: "gmail",
    level: "senior",
    sort: "oldest",
    includeApplied: true,
  });
  assert.deepEqual(parseJobListQuery({ source: "evil", method: "bot", level: "boss", sort: "drop", applied: "evet" }), base);
  assert.equal(parseJobListQuery({ level: "unknown" }).level, "unknown");
  assert.deepEqual(parseJobListQuery({ source: ["indeed", "linkedin"] }), { ...base, source: "indeed" });
});

test("filtre bağlantıları varsayılan değerleri URL'ye yazmaz", () => {
  assert.equal(buildJobListHref(base), "/");
  assert.equal(buildJobListHref({ ...base, source: "linkedin" }), "/?source=linkedin");
  assert.equal(
    buildJobListHref({ ...base, source: "indeed", method: "manual", level: "junior", sort: "oldest", includeApplied: true }),
    "/?source=indeed&method=manual&level=junior&sort=oldest&applied=1",
  );
});

test("başvurulan ilanlar varsayılan listede görünmez; istendiğinde eklenir", () => {
  assert.deepEqual(applyJobListQuery(jobs, base).map((job) => job.id), ["b", "a"]);
  assert.deepEqual(applyJobListQuery(jobs, { ...base, includeApplied: true }).map((job) => job.id), ["b", "c", "a"]);
});

test("bellek içi filtre kaynak, edinilme ve deneyim düzeyini birlikte uygular, tarihe göre sıralar", () => {
  assert.deepEqual(applyJobListQuery(jobs, { ...base, source: "linkedin", method: "gmail" }).map((job) => job.id), ["b"]);
  assert.deepEqual(
    applyJobListQuery(jobs, { ...base, method: "gmail", sort: "oldest", includeApplied: true }).map((job) => job.id),
    ["c", "b"],
  );
});

test("deneyim düzeyi başlıktan çıkarılır; çıkarılamayan ilanlar 'unknown' grubunda toplanır", () => {
  assert.equal(jobLevel(jobs[0]!), "junior");
  assert.equal(jobLevel(jobs[1]!), "associate");
  assert.equal(jobLevel(jobs[2]!), "unknown");

  assert.deepEqual(applyJobListQuery(jobs, { ...base, level: "junior" }).map((job) => job.id), ["a"]);
  assert.deepEqual(applyJobListQuery(jobs, { ...base, level: "unknown", includeApplied: true }).map((job) => job.id), ["c"]);
  assert.deepEqual(applyJobListQuery(jobs, { ...base, level: "senior" }), []);

  // Açıklamadaki düzey, başlıkta ifade yoksa kullanılır.
  assert.equal(jobLevel({ title: "Veri Analisti", description: "Kıdemli adaylar aranıyor" }), "senior");
});

test("filtre çubuğunda yalnızca listede bulunan düzeyler, sabit sırayla gösterilir", () => {
  assert.deepEqual(availableLevels(jobs), ["junior", "associate", "unknown"]);
  assert.deepEqual(availableLevels([]), []);
});
