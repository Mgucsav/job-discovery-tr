import assert from "node:assert/strict";
import test from "node:test";
import { mergeJobPosting, type MergeableJobPosting } from "../lib/jobs/merge";

const current: MergeableJobPosting = {
  firstSeenAt: "2026-09-11T08:00:00.000Z",
  acquisitionMethod: "manual",
  sourceEmailId: null,
  title: null,
  company: "Örnek A.Ş.",
  location: null,
  description: null,
};

test("aynı ilan tekrar gelirse değişiklik yapılmaz", () => {
  assert.deepEqual(mergeJobPosting(current, { ...current }), { outcome: "unchanged", changes: {} });
});

test("daha eski Gmail görülmesi ilk görülme bilgisini ve edinilme kaynağını geriye çeker", () => {
  const merged = mergeJobPosting(current, {
    ...current,
    firstSeenAt: "2026-09-10T08:00:00.000Z",
    acquisitionMethod: "gmail",
    sourceEmailId: "mail-early",
    title: "Platform Mühendisi",
  });
  assert.equal(merged.outcome, "updated");
  assert.deepEqual(merged.changes, {
    firstSeenAt: "2026-09-10T08:00:00.000Z",
    acquisitionMethod: "gmail",
    sourceEmailId: "mail-early",
    title: "Platform Mühendisi",
  });
});

test("daha yeni görülme ilk görülmeyi değiştirmez; yalnızca eksik alanları tamamlar, mevcut alanı ezmez", () => {
  const merged = mergeJobPosting(current, {
    ...current,
    firstSeenAt: "2026-09-12T08:00:00.000Z",
    acquisitionMethod: "gmail",
    sourceEmailId: "mail-late",
    company: "Başka Şirket",
    location: "İstanbul",
  });
  assert.equal(merged.outcome, "updated");
  assert.deepEqual(merged.changes, { location: "İstanbul" });
});
