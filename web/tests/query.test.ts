import assert from "node:assert/strict";
import test from "node:test";
import { buildJobListHref, parseJobListQuery } from "../lib/jobs/query";

test("kaynak filtresi ve sıralama yalnızca bilinen değerleri kabul eder", () => {
  assert.deepEqual(parseJobListQuery({}), { source: null, method: null, sort: "newest" });
  assert.deepEqual(parseJobListQuery({ source: "kariyer", method: "gmail", sort: "oldest" }), { source: "kariyer", method: "gmail", sort: "oldest" });
  assert.deepEqual(parseJobListQuery({ source: "evil", method: "bot", sort: "drop" }), { source: null, method: null, sort: "newest" });
  assert.deepEqual(parseJobListQuery({ source: ["indeed", "linkedin"] }), { source: "indeed", method: null, sort: "newest" });
});

test("filtre bağlantıları varsayılan değerleri URL'ye yazmaz", () => {
  assert.equal(buildJobListHref({ source: null, method: null, sort: "newest" }), "/");
  assert.equal(buildJobListHref({ source: "linkedin", method: null, sort: "newest" }), "/?source=linkedin");
  assert.equal(buildJobListHref({ source: "indeed", method: "manual", sort: "oldest" }), "/?source=indeed&method=manual&sort=oldest");
});

test("bellek içi filtre kaynak ve edinilme türünü birlikte uygular, tarihe göre sıralar", async () => {
  const { applyJobListQuery } = await import("../lib/jobs/query");
  const jobs = [
    { id: "a", source: "linkedin" as const, acquisitionMethod: "manual" as const, firstSeenAt: "2026-09-10T00:00:00.000Z" },
    { id: "b", source: "linkedin" as const, acquisitionMethod: "gmail" as const, firstSeenAt: "2026-09-12T00:00:00.000Z" },
    { id: "c", source: "indeed" as const, acquisitionMethod: "gmail" as const, firstSeenAt: "2026-09-11T00:00:00.000Z" },
  ];
  assert.deepEqual(applyJobListQuery(jobs, { source: null, method: null, sort: "newest" }).map((j) => j.id), ["b", "c", "a"]);
  assert.deepEqual(applyJobListQuery(jobs, { source: "linkedin", method: "gmail", sort: "oldest" }).map((j) => j.id), ["b"]);
  assert.deepEqual(applyJobListQuery(jobs, { source: null, method: "gmail", sort: "oldest" }).map((j) => j.id), ["c", "b"]);
});
