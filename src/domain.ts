export const JOB_SOURCES = ["linkedin", "kariyer", "indeed"] as const;

export type JobSource = (typeof JOB_SOURCES)[number];

export interface JobPosting {
  source: JobSource;
  sourceJobId: string;
  url: string;
  title: string | null;
  titleStatus: "present" | "missing";
  descriptionStatus: "missing";
  firstSeenAt: string;
  sourceEmailId: string;
}

export interface NormalizedEmail {
  id: string;
  receivedAt: string;
  from: string;
  subject: string | null;
  text: string;
  html: string;
}

export interface SourceRunReport {
  status: "ok" | "error";
  jobsFound: number;
  newJobs: number;
  duplicateJobs: number;
  errorCount: number;
}

export interface DiscoveryRunReport {
  startedAt: string;
  finishedAt: string;
  emailsRead: number;
  unresolvedEmails: number;
  repositoryErrors: number;
  gmailStatus: "not_used" | "ok" | "error";
  sources: Record<JobSource, SourceRunReport>;
}
