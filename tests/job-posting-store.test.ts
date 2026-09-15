import assert from "node:assert/strict";
import test from "node:test";
import type { DiscoveryRunReport, JobPosting, StoredJobPostingInput } from "../src/domain.ts";
import { parseJobPostingDocument, planJobPostingUpsert, type DocumentData } from "../src/storage/job-posting-documents.ts";
import {
  FirestoreJobRepository,
  deleteStoredJobPosting,
  latestDiscoveryRun,
  listStoredJobPostings,
  saveDiscoveryRun,
  upsertStoredJobPosting,
} from "../src/storage/job-posting-store.ts";
import { MemoryStore } from "./helpers/memory-store.ts";

const OWNER = "owner-uid";

const gmailPosting: JobPosting = {
  source: "linkedin",
  sourceJobId: "4290012345",
  url: "https://www.linkedin.com/jobs/view/4290012345",
  title: null,
  titleStatus: "missing",
  company: null,
  location: null,
  descriptionStatus: "missing",
  firstSeenAt: "2026-09-11T08:00:00.000Z",
  sourceEmailId: "mail-late",
};

const manualInput: StoredJobPostingInput = {
  source: "linkedin",
  sourceJobId: "4290012345",
  url: "https://www.linkedin.com/jobs/view/4290012345",
  title: "Veri Mühendisi",
  company: "Örnek A.Ş.",
  location: null,
  description: null,
  firstSeenAt: "2026-09-12T08:00:00.000Z",
  acquisitionMethod: "manual",
  sourceEmailId: null,
};

test("Firestore adaptörü Gmail ilanını gmail yöntemiyle yazar, tekrarı unchanged sayar ve ilk görülmeyi korur", async () => {
  const store = new MemoryStore();
  const repository = new FirestoreJobRepository(store, OWNER, () => new Date("2026-09-12T09:00:00.000Z"));

  assert.equal(await repository.upsert(gmailPosting), "inserted");
  assert.equal(await repository.upsert(gmailPosting), "unchanged");
  assert.equal(
    await repository.upsert({
      ...gmailPosting,
      title: "Platform Mühendisi",
      titleStatus: "present",
      firstSeenAt: "2026-09-10T08:00:00.000Z",
      sourceEmailId: "mail-early",
    }),
    "updated",
  );

  const [stored] = await listStoredJobPostings(store, OWNER);
  assert.equal(stored?.id, "linkedin__4290012345");
  assert.equal(stored?.acquisitionMethod, "gmail");
  assert.equal(stored?.sourceEmailId, "mail-early");
  assert.equal(stored?.firstSeenAt, "2026-09-10T08:00:00.000Z");
  assert.equal(stored?.title, "Platform Mühendisi");
  assert.equal(stored?.company, null);

  const raw = store.documents.get(`users/${OWNER}/jobPostings/linkedin__4290012345`);
  assert.equal(raw?.ownerId, OWNER);
  assert.equal(raw?.createdAt, "2026-09-12T09:00:00.000Z");
  assert.equal(raw?.updatedAt, "2026-09-12T09:00:00.000Z");

  const [listed] = await repository.list();
  assert.deepEqual(listed, {
    source: "linkedin",
    sourceJobId: "4290012345",
    url: "https://www.linkedin.com/jobs/view/4290012345",
    title: "Platform Mühendisi",
    titleStatus: "present",
    company: null,
    location: null,
    descriptionStatus: "missing",
    firstSeenAt: "2026-09-10T08:00:00.000Z",
    sourceEmailId: "mail-early",
  });
});

test("elle eklenen ilan sonradan daha eski Gmail görülmesiyle birleşir; manuel alanlar korunur", async () => {
  const store = new MemoryStore();
  assert.equal(await upsertStoredJobPosting(store, OWNER, manualInput), "inserted");

  const repository = new FirestoreJobRepository(store, OWNER);
  assert.equal(await repository.upsert(gmailPosting), "updated");

  const [stored] = await listStoredJobPostings(store, OWNER);
  assert.equal(stored?.firstSeenAt, "2026-09-11T08:00:00.000Z");
  assert.equal(stored?.acquisitionMethod, "gmail");
  assert.equal(stored?.sourceEmailId, "mail-late");
  assert.equal(stored?.title, "Veri Mühendisi");
  assert.equal(stored?.company, "Örnek A.Ş.");

  // Manuel kayıtlar JobPosting sözleşmesine dönmez; Gmail kimliği olmayan satırlar CLI listesinden düşer.
  await upsertStoredJobPosting(store, OWNER, { ...manualInput, sourceJobId: "111", url: "https://www.linkedin.com/jobs/view/111" });
  assert.equal((await repository.list()).length, 1);
  assert.equal((await listStoredJobPostings(store, OWNER)).length, 2);
});

test("liste ilk görülmeye göre yeniden eskiye sıralanır; silme yalnızca geçerli kimlikle çalışır", async () => {
  const store = new MemoryStore();
  await upsertStoredJobPosting(store, OWNER, manualInput);
  await upsertStoredJobPosting(store, OWNER, {
    ...manualInput,
    source: "kariyer",
    sourceJobId: "9876543",
    url: "https://www.kariyer.net/is-ilani/9876543",
    firstSeenAt: "2026-09-13T08:00:00.000Z",
  });
  const rows = await listStoredJobPostings(store, OWNER);
  assert.deepEqual(rows.map((row) => row.id), ["kariyer__9876543", "linkedin__4290012345"]);

  assert.equal(await deleteStoredJobPosting(store, OWNER, "../users/other"), false);
  assert.equal(await deleteStoredJobPosting(store, OWNER, "kariyer__9876543"), true);
  assert.equal((await listStoredJobPostings(store, OWNER)).length, 1);

  // Başka kullanıcının yolu ayrıdır.
  assert.equal((await listStoredJobPostings(store, "someone-else")).length, 0);
});

test("keşif koşusu özeti kaydedilir ve en son koşu okunur", async () => {
  const store = new MemoryStore();
  const report: DiscoveryRunReport = {
    startedAt: "2026-09-12T09:00:00.000Z",
    finishedAt: "2026-09-12T09:00:01.000Z",
    emailsRead: 5,
    unresolvedEmails: 1,
    repositoryErrors: 0,
    gmailStatus: "ok",
    sources: {
      linkedin: { status: "ok", jobsFound: 2, newJobs: 1, duplicateJobs: 1, errorCount: 0 },
      kariyer: { status: "ok", jobsFound: 1, newJobs: 1, duplicateJobs: 0, errorCount: 0 },
      indeed: { status: "ok", jobsFound: 1, newJobs: 1, duplicateJobs: 0, errorCount: 0 },
    },
    newPostings: [{ source: "kariyer", sourceJobId: "9876543", url: "https://www.kariyer.net/is-ilani/9876543", title: null, company: null, location: null }],
    notification: { channel: "telegram", status: "sent", messages: 1 },
  };
  assert.equal(await latestDiscoveryRun(store, OWNER), null);
  await saveDiscoveryRun(store, OWNER, report);
  await saveDiscoveryRun(store, OWNER, { ...report, startedAt: "2026-09-13T09:00:00.000Z", finishedAt: "2026-09-13T09:00:01.000Z", emailsRead: 2 });

  const latest = await latestDiscoveryRun(store, OWNER);
  assert.equal(latest?.id, "2026-09-13T09-00-00-000Z");
  assert.equal(latest?.emailsRead, 2);
  assert.equal(latest?.newJobsTotal, 3);
  assert.equal(latest?.duplicateJobsTotal, 1);
  assert.equal(latest?.sources.kariyer.newJobs, 1);
  assert.deepEqual(latest?.newPostings, [{ source: "kariyer", sourceJobId: "9876543", url: "https://www.kariyer.net/is-ilani/9876543", title: null, company: null, location: null }]);
  assert.deepEqual(latest?.notification, { channel: "telegram", status: "sent", messages: 1 });
});

test("bozuk belgeler görünüm modeline alınmaz; eski Timestamp değerleri ISO'ya çevrilir", () => {
  assert.equal(parseJobPostingDocument("x", { source: "linkedin" }), null);
  assert.equal(parseJobPostingDocument("x", { source: "evil", sourceJobId: "1", url: "https://a", firstSeenAt: "2026-09-12T08:00:00.000Z", acquisitionMethod: "manual" }), null);
  const parsed = parseJobPostingDocument("linkedin__1", {
    source: "linkedin",
    sourceJobId: "1",
    url: "https://www.linkedin.com/jobs/view/1",
    firstSeenAt: { toDate: () => new Date("2026-09-12T08:00:00.000Z") },
    acquisitionMethod: "manual",
  });
  assert.equal(parsed?.firstSeenAt, "2026-09-12T08:00:00.000Z");
  assert.equal(parsed?.titleStatus, "missing");
  assert.equal(parsed?.sourceEmailId, null);

  const plan = planJobPostingUpsert({ ...parsed, firstSeenAt: "2026-09-12T08:00:00.000Z" } as DocumentData, manualInput, OWNER, "2026-09-12T10:00:00.000Z");
  assert.equal(plan.outcome, "updated");
  if (plan.outcome === "updated") assert.deepEqual(plan.update, { title: "Veri Mühendisi", company: "Örnek A.Ş.", updatedAt: "2026-09-12T10:00:00.000Z" });
});
