import type { JobPosting, JobSource, NormalizedEmail } from "../domain.ts";

interface CandidateLink {
  url: string;
  // Bağlantı metni blok sınırlarına (td/tr/p/div/li/br) göre satırlara bölünmüş hali:
  // e-posta kartlarında 1. satır başlık, 2. satır "Şirket · Konum" olur.
  lines: string[];
}

interface ValidatedLink {
  source: JobSource;
  sourceJobId: string;
  canonicalUrl: string;
}

const GENERIC_LABELS = new Set([
  "apply",
  "apply now",
  "job details",
  "see job",
  "view job",
  "view",
  "başvur",
  "hemen başvur",
  "ilanı gör",
  "ilanı görüntüle",
  "iş ilanını görüntüle",
  "görüntüle",
  "görüntüleyin",
  "detaylar",
  "detayları gör",
  "incele",
]);

const BLOCK_BOUNDARY = /<\/(?:td|tr|p|div|li|h[1-6]|table)\s*>|<br\s*\/?>/gi;

function labelLines(innerHtml: string): string[] {
  return innerHtml
    .split(BLOCK_BOUNDARY)
    .map(cleanText)
    .filter((line) => line.length > 0);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractLinks(email: NormalizedEmail): CandidateLink[] {
  const links: CandidateLink[] = [];
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let anchor: RegExpExecArray | null;
  while ((anchor = anchorPattern.exec(email.html)) !== null) {
    const href = anchor[1];
    if (href) links.push({ url: decodeHtmlEntities(href.trim()), lines: labelLines(anchor[2] ?? "") });
  }

  const plainPattern = /https:\/\/[^\s<>"']+/gi;
  for (const body of [email.text, email.html.replace(anchorPattern, "")]) {
    for (const match of body.matchAll(plainPattern)) {
      links.push({ url: decodeHtmlEntities(match[0].replace(/[),.;!?]+$/, "")), lines: [] });
    }
  }
  return links;
}

function hostIs(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

// Kabul edilen biçimler (yalnızca HTTPS, yalnızca izin verilen alan adları; yönlendirme takip edilmez):
//   LinkedIn : /jobs/view/<id>, /comm/jobs/view/<id>, slug-<id> ve /jobs/... sayfalarında ?currentJobId=<id>
//   Kariyer  : /is-ilani/<slug>-<id>
//   Indeed   : /viewjob?jk=<key>, /jobs?...&vjk=<key>, /rc/clk?jk=<key>, /pagead/clk?jk=<key>
// Kimlik her zaman adresin içinden okunur ve kanonik adres üretilir; takip parametreleri atılır.
const LINKEDIN_JOB_ID = /^\d{6,20}$/;
const INDEED_JOB_KEY = /^[a-z0-9]{8,64}$/i;

function linkedinLink(jobId: string): ValidatedLink {
  return { source: "linkedin", sourceJobId: jobId, canonicalUrl: `https://www.linkedin.com/jobs/view/${jobId}` };
}

function indeedLink(jobKey: string): ValidatedLink {
  const key = jobKey.toLowerCase();
  return { source: "indeed", sourceJobId: key, canonicalUrl: `https://tr.indeed.com/viewjob?jk=${encodeURIComponent(key)}` };
}

export function validateJobUrl(rawUrl: string): ValidatedLink | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const pathname = url.pathname.toLowerCase();

  if (hostIs(hostname, "linkedin.com")) {
    const match = url.pathname.match(/^\/(?:comm\/)?jobs\/view\/(?:[^/]*-)?(\d+)\/?$/i);
    if (match?.[1] && LINKEDIN_JOB_ID.test(match[1])) return linkedinLink(match[1]);
    // Arama/öneri sayfalarında açık ilan: /jobs/search/?currentJobId=..., /jobs/collections/.../?currentJobId=...
    const currentJobId = url.searchParams.get("currentJobId");
    if (/^\/(?:comm\/)?jobs(?:\/|$)/.test(pathname) && currentJobId && LINKEDIN_JOB_ID.test(currentJobId)) {
      return linkedinLink(currentJobId);
    }
    return null;
  }

  if (hostIs(hostname, "kariyer.net")) {
    const match = url.pathname.match(/^\/is-ilani\/(?:[^/]*-)?(\d+)\/?$/i);
    if (!match?.[1]) return null;
    return {
      source: "kariyer",
      sourceJobId: match[1],
      canonicalUrl: `https://www.kariyer.net/is-ilani/${match[1]}`,
    };
  }

  if (hostIs(hostname, "indeed.com")) {
    if (pathname === "/viewjob" || pathname === "/rc/clk" || pathname === "/pagead/clk") {
      const jobKey = url.searchParams.get("jk");
      return jobKey && INDEED_JOB_KEY.test(jobKey) ? indeedLink(jobKey) : null;
    }
    // Arama sonuçlarında açık ilan: /jobs?q=...&vjk=<key>
    const viewedKey = url.searchParams.get("vjk");
    if ((pathname === "/jobs" || pathname === "/") && viewedKey && INDEED_JOB_KEY.test(viewedKey)) return indeedLink(viewedKey);
    return null;
  }

  return null;
}

function isGenericLabel(value: string): boolean {
  return GENERIC_LABELS.has(value.toLocaleLowerCase("tr-TR"));
}

function titleFromLabel(label: string | null): string | null {
  if (!label) return null;
  const title = cleanText(label);
  if (title.length < 2 || title.length > 240 || isGenericLabel(title)) return null;
  return title;
}

interface LabelFields {
  title: string | null;
  company: string | null;
  location: string | null;
}

// 1. satır başlık; 2. satır "Şirket · Konum" ise ayrıştırılır. Belirsiz olan uydurulmaz, null kalır.
function fieldsFromLines(lines: string[]): LabelFields {
  const meaningful = lines.filter((line) => !isGenericLabel(line));
  const title = titleFromLabel(meaningful[0] ?? null);
  const meta = meaningful[1] ?? null;
  if (!title || !meta || meta.length > 240) return { title, company: null, location: null };
  const separator = meta.indexOf(" · ");
  if (separator <= 0) return { title, company: null, location: null };
  const company = meta.slice(0, separator).trim();
  const location = meta.slice(separator + 3).trim();
  return {
    title,
    company: company.length >= 2 && company.length <= 200 ? company : null,
    location: location.length >= 2 && location.length <= 200 ? location : null,
  };
}

export interface ParsedEmail {
  detectedSources: Set<JobSource>;
  jobs: JobPosting[];
}

export function parseJobAlertEmail(email: NormalizedEmail): ParsedEmail {
  const detectedSources = new Set<JobSource>();
  const sender = email.from.toLowerCase();
  if (sender.includes("linkedin")) detectedSources.add("linkedin");
  if (sender.includes("kariyer")) detectedSources.add("kariyer");
  if (sender.includes("indeed")) detectedSources.add("indeed");

  const jobs = new Map<string, JobPosting>();
  for (const candidate of extractLinks(email)) {
    const valid = validateJobUrl(candidate.url);
    if (!valid) continue;
    detectedSources.add(valid.source);
    const key = `${valid.source}:${valid.sourceJobId}`;
    const fields = fieldsFromLines(candidate.lines);
    const existing = jobs.get(key);
    if (existing && existing.title !== null) continue;
    jobs.set(key, {
      source: valid.source,
      sourceJobId: valid.sourceJobId,
      url: valid.canonicalUrl,
      title: fields.title,
      titleStatus: fields.title === null ? "missing" : "present",
      company: fields.company,
      location: fields.location,
      descriptionStatus: "missing",
      firstSeenAt: email.receivedAt,
      sourceEmailId: email.id,
    });
  }
  return { detectedSources, jobs: [...jobs.values()] };
}
