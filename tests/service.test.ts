import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { NormalizedEmail } from "../src/domain.js";
import { DiscoveryRunError, runDiscovery } from "../src/discovery/service.js";
import { MemoryJobRepository } from "../src/storage/memory-repository.js";

async function fixtures(): Promise<NormalizedEmail[]> {
  const raw = await readFile(new URL("./fixtures/job-alert-emails.json", import.meta.url), "utf8");
  return JSON.parse(raw) as NormalizedEmail[];
}

test("koşu raporu okunan, tekilleşen ve çözümlenemeyenleri ayrı sayar", async () => {
  const repository = new MemoryJobRepository();
  const times = [new Date("2026-09-12T09:00:00.000Z"), new Date("2026-09-12T09:00:01.000Z")];
  const report = await runDiscovery(
    { listJobAlertEmails: fixtures },
    repository,
    () => times.shift() ?? new Date("2026-09-12T09:00:01.000Z"),
  );

  assert.equal(report.gmailStatus, "ok");
  assert.equal(report.emailsRead, 5);
  assert.equal(report.unresolvedEmails, 1);
  assert.deepEqual(report.sources.linkedin, {
    status: "ok",
    jobsFound: 2,
    newJobs: 1,
    duplicateJobs: 1,
    errorCount: 0,
  });
  assert.equal(report.sources.kariyer.newJobs, 1);
  assert.equal(report.sources.indeed.newJobs, 1);
  assert.equal((await repository.list()).length, 3);
});

test("kaynakta sıfır ilan ile Gmail erişim hatasını karıştırmaz", async () => {
  const emptyReport = await runDiscovery(
    { listJobAlertEmails: async () => [] },
    new MemoryJobRepository(),
  );
  assert.equal(emptyReport.gmailStatus, "ok");
  assert.equal(emptyReport.sources.linkedin.status, "ok");
  assert.equal(emptyReport.sources.linkedin.jobsFound, 0);

  await assert.rejects(
    runDiscovery(
      { listJobAlertEmails: async () => Promise.reject(new Error("API unavailable")) },
      new MemoryJobRepository(),
    ),
    (error: unknown) => {
      assert.ok(error instanceof DiscoveryRunError);
      assert.equal(error.report.gmailStatus, "error");
      assert.equal(error.report.sources.linkedin.status, "ok");
      return true;
    },
  );
});
