import assert from "node:assert/strict";
import test from "node:test";
import { MANUAL_LINK_URL_ERROR, prepareManualLink } from "../lib/jobs/manual-link";

const fixedNow = () => new Date("2026-09-12T10:00:00.000Z");

test("elle eklenen bağlantı çekirdek doğrulama kurallarından geçer ve kanonik URL saklanır", () => {
  const result = prepareManualLink(
    {
      url: "https://www.linkedin.com/jobs/view/example-role-4290012345?trk=share",
      title: "  Veri   Mühendisi ",
      company: "",
      location: "   ",
      description: undefined,
    },
    fixedNow,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.input, {
    source: "linkedin",
    sourceJobId: "4290012345",
    url: "https://www.linkedin.com/jobs/view/4290012345",
    title: "Veri Mühendisi",
    company: null,
    location: null,
    description: null,
    firstSeenAt: "2026-09-12T10:00:00.000Z",
    acquisitionMethod: "manual",
    sourceEmailId: null,
  });
});

test("Kariyer.net ve Indeed bağlantıları kaynak ve ilan kimliğiyle ayrışır", () => {
  const kariyer = prepareManualLink({ url: "https://www.kariyer.net/is-ilani/ornek-rol-9876543" });
  assert.ok(kariyer.ok);
  assert.equal(kariyer.input.source, "kariyer");
  assert.equal(kariyer.input.sourceJobId, "9876543");

  const indeed = prepareManualLink({ url: "https://tr.indeed.com/viewjob?jk=A1B2C3D4E5F60718&from=web" });
  assert.ok(indeed.ok);
  assert.equal(indeed.input.source, "indeed");
  assert.equal(indeed.input.sourceJobId, "a1b2c3d4e5f60718");
  assert.equal(indeed.input.url, "https://tr.indeed.com/viewjob?jk=a1b2c3d4e5f60718");
});

test("doğrulanmamış, kısaltılmış veya HTTP bağlantılar reddedilir", () => {
  for (const url of [
    "",
    "   ",
    "not a url",
    "http://www.linkedin.com/jobs/view/4290012345",
    "https://lnkd.in/abc123",
    "https://evil.example/?next=https://linkedin.com/jobs/view/4290012345",
    "https://www.linkedin.com/jobs/search/?keywords=data",
  ]) {
    const result = prepareManualLink({ url });
    assert.equal(result.ok, false, url);
  }
  const rejected = prepareManualLink({ url: "https://lnkd.in/abc123" });
  assert.ok(!rejected.ok);
  assert.equal(rejected.error, MANUAL_LINK_URL_ERROR);
});

test("aşırı uzun isteğe bağlı alanlar açıkça reddedilir, uydurulmaz veya kırpılmaz", () => {
  const result = prepareManualLink({
    url: "https://www.linkedin.com/jobs/view/4290012345",
    title: "x".repeat(241),
  });
  assert.ok(!result.ok);
  assert.match(result.error, /Başlık en fazla 240/);
});
