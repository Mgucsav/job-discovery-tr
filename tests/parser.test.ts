import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { NormalizedEmail } from "../src/domain.ts";
import { parseJobAlertEmail, validateJobUrl } from "../src/discovery/parser.ts";

test("yalnızca izin verilen doğrudan HTTPS ilan URL'lerini kabul eder", () => {
  assert.deepEqual(validateJobUrl("https://www.linkedin.com/jobs/view/example-role-4290012345?trk=mail"), {
    source: "linkedin",
    sourceJobId: "4290012345",
    canonicalUrl: "https://www.linkedin.com/jobs/view/4290012345",
  });
  assert.deepEqual(validateJobUrl("https://www.kariyer.net/is-ilani/ornek-rol-9876543?x=1"), {
    source: "kariyer",
    sourceJobId: "9876543",
    canonicalUrl: "https://www.kariyer.net/is-ilani/9876543",
  });
  assert.deepEqual(validateJobUrl("https://tr.indeed.com/viewjob?jk=A1B2C3D4E5F60718&from=alert"), {
    source: "indeed",
    sourceJobId: "a1b2c3d4e5f60718",
    canonicalUrl: "https://tr.indeed.com/viewjob?jk=a1b2c3d4e5f60718",
  });

  assert.equal(validateJobUrl("http://www.linkedin.com/jobs/view/4290012345"), null);
  assert.equal(validateJobUrl("https://lnkd.in/abc123"), null);
  assert.equal(validateJobUrl("https://evil.example/?next=https://linkedin.com/jobs/view/4290012345"), null);
  assert.equal(validateJobUrl("https://linkedin.com.evil.example/jobs/view/4290012345"), null);
  assert.equal(validateJobUrl("https://www.linkedin.com/jobs/search/?keywords=veri"), null);
  assert.equal(validateJobUrl("https://www.linkedin.com/in/someone/?currentJobId=4290012345"), null);
  assert.equal(validateJobUrl("https://tr.indeed.com/cmp/company?vjk=a1b2c3d4e5f60718"), null);
});

test("arama/öneri sayfalarındaki açık ilan ve Indeed tıklama bağlantıları kimliğe göre kanonikleşir", () => {
  assert.deepEqual(validateJobUrl("https://www.linkedin.com/jobs/search/?currentJobId=4290012345&keywords=veri&refId=abc"), {
    source: "linkedin",
    sourceJobId: "4290012345",
    canonicalUrl: "https://www.linkedin.com/jobs/view/4290012345",
  });
  assert.equal(validateJobUrl("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4290012345")?.sourceJobId, "4290012345");
  assert.equal(validateJobUrl("https://www.linkedin.com/jobs/view/4290012345/?alternateChannel=search&trackingId=xyz")?.sourceJobId, "4290012345");
  assert.deepEqual(validateJobUrl("https://tr.indeed.com/jobs?q=data+analyst&l=%C4%B0stanbul&vjk=A1B2C3D4E5F60718"), {
    source: "indeed",
    sourceJobId: "a1b2c3d4e5f60718",
    canonicalUrl: "https://tr.indeed.com/viewjob?jk=a1b2c3d4e5f60718",
  });
  assert.equal(validateJobUrl("https://tr.indeed.com/rc/clk?jk=a1b2c3d4e5f60718&from=alert")?.canonicalUrl, "https://tr.indeed.com/viewjob?jk=a1b2c3d4e5f60718");
  assert.equal(validateJobUrl("https://www.indeed.com/pagead/clk?jk=a1b2c3d4e5f60718")?.source, "indeed");
});

test("HTML başlığını alır; genel çağrı metnini başlık diye uydurmaz", () => {
  const email: NormalizedEmail = {
    id: "mail-1",
    receivedAt: "2026-09-10T08:00:00.000Z",
    from: "LinkedIn <jobs@linkedin.com>",
    subject: null,
    text: "",
    html: [
      '<a href="https://www.linkedin.com/jobs/view/1234567890">Veri Mühendisi</a>',
      '<a href="https://www.linkedin.com/jobs/view/2234567890">İlanı gör</a>',
    ].join(""),
  };
  const parsed = parseJobAlertEmail(email);
  assert.equal(parsed.jobs.length, 2);
  assert.equal(parsed.jobs[0]?.title, "Veri Mühendisi");
  assert.equal(parsed.jobs[0]?.descriptionStatus, "missing");
  assert.equal(parsed.jobs[1]?.title, null);
  assert.equal(parsed.jobs[1]?.titleStatus, "missing");
});

test("fixture e-postalarının tamamı kişisel verisiz ve parse edilebilir biçimdedir", async () => {
  const raw = await readFile(new URL("./fixtures/job-alert-emails.json", import.meta.url), "utf8");
  const fixtures = JSON.parse(raw) as NormalizedEmail[];
  assert.equal(fixtures.length, 5);
  assert.deepEqual(fixtures.map((email) => parseJobAlertEmail(email).jobs.length), [1, 1, 1, 1, 0]);
});
