import assert from "node:assert/strict";
import test from "node:test";
import { MANUAL_LINK_URL_ERROR, prepareManualLink } from "../lib/jobs/manual-link";

test("elle eklenen bağlantı çekirdek doğrulama kurallarından geçer ve kanonik URL saklanır", () => {
  const result = prepareManualLink({
    url: "https://www.linkedin.com/jobs/view/example-role-4290012345?trk=share",
    title: "  Veri   Mühendisi ",
    company: "",
    location: "   ",
    description: undefined,
  });
  assert.ok(result.ok);
  assert.deepEqual(result.args, {
    p_source: "linkedin",
    p_source_job_id: "4290012345",
    p_url: "https://www.linkedin.com/jobs/view/4290012345",
    p_title: "Veri Mühendisi",
    p_company: null,
    p_location: null,
    p_description: null,
    p_acquisition_method: "manual",
    p_source_email_id: null,
  });
});

test("Kariyer.net ve Indeed bağlantıları kaynak ve ilan kimliğiyle ayrışır", () => {
  const kariyer = prepareManualLink({ url: "https://www.kariyer.net/is-ilani/ornek-rol-9876543" });
  assert.ok(kariyer.ok);
  assert.equal(kariyer.args.p_source, "kariyer");
  assert.equal(kariyer.args.p_source_job_id, "9876543");

  const indeed = prepareManualLink({ url: "https://tr.indeed.com/viewjob?jk=A1B2C3D4E5F60718&from=web" });
  assert.ok(indeed.ok);
  assert.equal(indeed.args.p_source, "indeed");
  assert.equal(indeed.args.p_source_job_id, "a1b2c3d4e5f60718");
  assert.equal(indeed.args.p_url, "https://tr.indeed.com/viewjob?jk=a1b2c3d4e5f60718");
});

test("doğrulanmamış, kısaltılmış veya HTTP bağlantılar reddedilir", () => {
  for (const url of [
    "",
    "   ",
    "not a url",
    "http://www.linkedin.com/jobs/view/4290012345",
    "https://lnkd.in/abc123",
    "https://tr.indeed.com/rc/clk?jk=a1b2c3d4e5f60718",
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
