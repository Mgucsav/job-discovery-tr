import { JOB_SOURCES, type DiscoveryRunReport, type NormalizedEmail } from "../domain.ts";
import type { JobRepository } from "../storage/repository.ts";
import { parseJobAlertEmail } from "./parser.ts";

export interface EmailSource {
  listJobAlertEmails(): Promise<NormalizedEmail[]>;
}

function emptyReport(startedAt: string): DiscoveryRunReport {
  return {
    startedAt,
    finishedAt: startedAt,
    emailsRead: 0,
    unresolvedEmails: 0,
    repositoryErrors: 0,
    gmailStatus: "not_used",
    sources: {
      linkedin: { status: "ok", jobsFound: 0, newJobs: 0, duplicateJobs: 0, errorCount: 0 },
      kariyer: { status: "ok", jobsFound: 0, newJobs: 0, duplicateJobs: 0, errorCount: 0 },
      indeed: { status: "ok", jobsFound: 0, newJobs: 0, duplicateJobs: 0, errorCount: 0 },
    },
    newPostings: [],
    notification: { channel: "none", status: "not_configured", messages: 0 },
  };
}

export async function runDiscovery(
  source: EmailSource,
  repository: JobRepository,
  now: () => Date = () => new Date(),
): Promise<DiscoveryRunReport> {
  const report = emptyReport(now().toISOString());
  let emails: NormalizedEmail[];
  try {
    emails = await source.listJobAlertEmails();
    report.gmailStatus = "ok";
  } catch (error) {
    report.gmailStatus = "error";
    report.finishedAt = now().toISOString();
    throw new DiscoveryRunError("Gmail e-postaları alınamadı.", report, { cause: error });
  }

  report.emailsRead = emails.length;
  for (const email of emails) {
    try {
      const parsed = parseJobAlertEmail(email);
      if (parsed.jobs.length === 0) report.unresolvedEmails += 1;
      for (const job of parsed.jobs) {
        const sourceReport = report.sources[job.source];
        sourceReport.jobsFound += 1;
        try {
          const outcome = await repository.upsert(job);
          if (outcome === "inserted") {
            sourceReport.newJobs += 1;
            report.newPostings.push({
              source: job.source,
              sourceJobId: job.sourceJobId,
              url: job.url,
              title: job.title,
              company: job.company,
              location: job.location,
            });
          } else {
            sourceReport.duplicateJobs += 1;
          }
        } catch {
          report.repositoryErrors += 1;
          sourceReport.status = "error";
          sourceReport.errorCount += 1;
        }
      }
    } catch {
      report.unresolvedEmails += 1;
      for (const sourceName of JOB_SOURCES) {
        report.sources[sourceName].status = "error";
        report.sources[sourceName].errorCount += 1;
      }
    }
  }
  report.finishedAt = now().toISOString();
  return report;
}

export class DiscoveryRunError extends Error {
  public constructor(
    message: string,
    public readonly report: DiscoveryRunReport,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DiscoveryRunError";
  }
}
