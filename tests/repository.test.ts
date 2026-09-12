import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { JobPosting } from "../src/domain.js";
import { JsonFileJobRepository } from "../src/storage/json-file-repository.js";

const base: JobPosting = {
  source: "linkedin",
  sourceJobId: "4290012345",
  url: "https://www.linkedin.com/jobs/view/4290012345",
  title: null,
  titleStatus: "missing",
  descriptionStatus: "missing",
  firstSeenAt: "2026-09-11T08:00:00.000Z",
  sourceEmailId: "mail-late",
};

test("JSON deposu kaynak+ilan ID ile tekilleştirir ve ilk görülmeyi korur", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "job-discovery-test-"));
  try {
    const storePath = path.join(directory, "jobs.json");
    const repository = new JsonFileJobRepository(storePath);
    assert.equal(await repository.upsert(base), "inserted");
    assert.equal(await repository.upsert(base), "unchanged");
    assert.equal(
      await repository.upsert({
        ...base,
        title: "Platform Mühendisi",
        titleStatus: "present",
        firstSeenAt: "2026-09-10T08:00:00.000Z",
        sourceEmailId: "mail-early",
      }),
      "updated",
    );

    const [saved] = await repository.list();
    assert.equal(saved?.title, "Platform Mühendisi");
    assert.equal(saved?.firstSeenAt, "2026-09-10T08:00:00.000Z");
    assert.equal(saved?.sourceEmailId, "mail-early");
    const onDisk = JSON.parse(await readFile(storePath, "utf8")) as { postings: JobPosting[] };
    assert.equal(onDisk.postings.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("aynı ID farklı kaynaklarda ayrı ilan olarak tutulur", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "job-discovery-test-"));
  try {
    const repository = new JsonFileJobRepository(path.join(directory, "jobs.json"));
    await repository.upsert(base);
    await repository.upsert({
      ...base,
      source: "kariyer",
      url: "https://www.kariyer.net/is-ilani/4290012345",
    });
    assert.equal((await repository.list()).length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
