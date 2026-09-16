import assert from "node:assert/strict";
import test from "node:test";
import { applyJobListQuery, availableLevels, buildJobListHref, jobLevel, parseJobListQuery } from "../lib/jobs/query";

const jobs = [
  { id: "a", source: "linkedin" as const, acquisitionMethod: "manual" as const, firstSeenAt: "2026-09-10T00:00:00.000Z", title: "Junior Data Analyst" },
  { id: "b", source: "linkedin" as const, acquisitionMethod: "gmail" as const, firstSeenAt: "2026-09-12T00:00:00.000Z", title: "Finans Uzman Yardımcısı" },
  { id: "c", source: "indeed" as const, acquisitionMethod: "gmail" as const, firstSeenAt: "2026-09-11T00:00:00.000Z", title: "Data Solutions Analyst" },
];

test("kaynak, edinilme, deneyim ve sıralama yalnızca bilinen değerleri kabul eder", () => {
  assert.deepEqual(parseJobListQuery({}), { source: null, method: null, level: null, sort: "newest" });
  assert.deepEqual(parseJobListQuery({ source: "kariyer", method: "gmail", level: "senior", sort: "oldest" }), {
    source: "kariyer",
    method: "gmail",
    level: "senior",
    sort: "oldest",
  });
  assert.deepEqual(parseJobListQuery({ source: "evil", method: "bot", level: "boss", sort: "drop" }), {
    source: null,
    method: null,
    level: null,
    sort: "newest",
  });
  assert.equal(parseJobListQuery({ level: "unknown" }).level, "unknown");
  assert.deepEqual(parseJobListQuery({ source: ["indeed", "linkedin"] }), { source: "indeed", method: null, level: null, sort: "newest" });
});

test("filtre bağlantıları varsayılan değerleri URL'ye yazmaz", () => {
  assert.equal(buildJobListHref({ source: null, method: null, level: null, sort: "newest" }), "/");
  assert.equal(buildJobListHref({ source: "linkedin", method: null, level: null, sort: "newest" }), "/?source=linkedin");
  assert.equal(
    buildJobListHref({ source: "indeed", method: "manual", level: "junior", sort: "oldest" }),
    "/?source=indeed&method=manual&level=junior&sort=oldest",
  );
});

test("bellek içi filtre kaynak, edinilme ve deneyim düzeyini birlikte uygular, tarihe göre sıralar", () => {
  assert.deepEqual(applyJobListQuery(jobs, { source: null, method: null, level: null, sort: "newest" }).map((j) => j.id), ["b", "c", "a"]);
  assert.deepEqual(applyJobListQuery(jobs, { source: "linkedin", method: "gmail", level: null, sort: "oldest" }).map((j) => j.id), ["b"]);
  assert.deepEqual(applyJobListQuery(jobs, { source: null, method: "gmail", level: null, sort: "oldest" }).map((j) => j.id), ["c", "b"]);
});

test("deneyim düzeyi başlıktan çıkarılır; çıkarılamayan ilanlar 'unknown' grubunda toplanır", () => {
  assert.equal(jobLevel(jobs[0]!), "junior");
  assert.equal(jobLevel(jobs[1]!), "associate");
  assert.equal(jobLevel(jobs[2]!), "unknown");

  assert.deepEqual(applyJobListQuery(jobs, { source: null, method: null, level: "junior", sort: "newest" }).map((j) => j.id), ["a"]);
  assert.deepEqual(applyJobListQuery(jobs, { source: null, method: null, level: "unknown", sort: "newest" }).map((j) => j.id), ["c"]);
  assert.deepEqual(applyJobListQuery(jobs, { source: null, method: null, level: "senior", sort: "newest" }), []);

  // Açıklamadaki düzey, başlıkta ifade yoksa kullanılır.
  assert.equal(jobLevel({ title: "Veri Analisti", description: "Kıdemli adaylar aranıyor" }), "senior");
});

test("filtre çubuğunda yalnızca listede bulunan düzeyler, sabit sırayla gösterilir", () => {
  assert.deepEqual(availableLevels(jobs), ["junior", "associate", "unknown"]);
  assert.deepEqual(availableLevels([]), []);
});
