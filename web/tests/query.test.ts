import assert from "node:assert/strict";
import test from "node:test";
import { buildJobListHref, parseJobListQuery } from "../lib/jobs/query";

test("kaynak filtresi ve sıralama yalnızca bilinen değerleri kabul eder", () => {
  assert.deepEqual(parseJobListQuery({}), { source: null, sort: "newest" });
  assert.deepEqual(parseJobListQuery({ source: "kariyer", sort: "oldest" }), { source: "kariyer", sort: "oldest" });
  assert.deepEqual(parseJobListQuery({ source: "evil", sort: "drop" }), { source: null, sort: "newest" });
  assert.deepEqual(parseJobListQuery({ source: ["indeed", "linkedin"] }), { source: "indeed", sort: "newest" });
});

test("filtre bağlantıları varsayılan değerleri URL'ye yazmaz", () => {
  assert.equal(buildJobListHref({ source: null, sort: "newest" }), "/");
  assert.equal(buildJobListHref({ source: "linkedin", sort: "newest" }), "/?source=linkedin");
  assert.equal(buildJobListHref({ source: "indeed", sort: "oldest" }), "/?source=indeed&sort=oldest");
});
