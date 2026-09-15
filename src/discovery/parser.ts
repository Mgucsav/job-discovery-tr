import type { JobPosting, JobSource, NormalizedEmail } from "../domain.ts";

interface CandidateLink {
  url: string;
  label: string | null;
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
  "başvur",
  "hemen başvur",
  "ilanı gör",
  "iş ilanını görüntüle",
]);

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
    if (href) links.push({ url: decodeHtmlEntities(href.trim()), label: cleanText(anchor[2] ?? "") || null });
  }

  const plainPattern = /https:\/\/[^\s<>"']+/gi;
  for (const body of [email.text, email.html.replace(anchorPattern, "")]) {
    for (const match of body.matchAll(plainPattern)) {
      links.push({ url: decodeHtmlEntities(match[0].replace(/[),.;!?]+$/, "")), label: null });
    }
  }
  return links;
}

function hostIs(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
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

  if (hostIs(hostname, "linkedin.com")) {
    const match = url.pathname.match(/^\/(?:comm\/)?jobs\/view\/(?:[^/]*-)?(\d+)\/?$/i);
    if (!match?.[1]) return null;
    return {
      source: "linkedin",
      sourceJobId: match[1],
      canonicalUrl: `https://www.linkedin.com/jobs/view/${match[1]}`,
    };
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

  if (hostIs(hostname, "indeed.com") && url.pathname.toLowerCase() === "/viewjob") {
    const jobKey = url.searchParams.get("jk");
    if (!jobKey || !/^[a-z0-9]{8,64}$/i.test(jobKey)) return null;
    return {
      source: "indeed",
      sourceJobId: jobKey.toLowerCase(),
      canonicalUrl: `https://tr.indeed.com/viewjob?jk=${encodeURIComponent(jobKey.toLowerCase())}`,
    };
  }

  return null;
}

function titleFromLabel(label: string | null): string | null {
  if (!label) return null;
  const title = cleanText(label);
  if (title.length < 2 || title.length > 240 || GENERIC_LABELS.has(title.toLocaleLowerCase("tr-TR"))) return null;
  return title;
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
    const title = titleFromLabel(candidate.label);
    const existing = jobs.get(key);
    if (existing && existing.title !== null) continue;
    jobs.set(key, {
      source: valid.source,
      sourceJobId: valid.sourceJobId,
      url: valid.canonicalUrl,
      title,
      titleStatus: title === null ? "missing" : "present",
      descriptionStatus: "missing",
      firstSeenAt: email.receivedAt,
      sourceEmailId: email.id,
    });
  }
  return { detectedSources, jobs: [...jobs.values()] };
}
