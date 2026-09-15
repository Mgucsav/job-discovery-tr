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

// İlanın ilk görülmesini sağlayan yöntem: web arayüzünden elle veya Gmail keşif koşusu.
export const ACQUISITION_METHODS = ["manual", "gmail"] as const;

export type AcquisitionMethod = (typeof ACQUISITION_METHODS)[number];

// Kalıcı depoya (Firestore) yazılacak ilan: JobPosting sözleşmesi + edinilme yöntemi + isteğe bağlı alanlar.
// Manuel kayıtta sourceEmailId null'dır; Gmail kaydında zorunludur. Eksik alanlar null kalır, uydurulmaz.
export interface StoredJobPostingInput {
  source: JobSource;
  sourceJobId: string;
  url: string;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  firstSeenAt: string;
  acquisitionMethod: AcquisitionMethod;
  sourceEmailId: string | null;
}

// Kalıcı depodan okunan ilan (web görünüm modeli ve CLI listeleme için ortak).
export interface StoredJobPosting extends Omit<JobPosting, "sourceEmailId" | "descriptionStatus"> {
  id: string;
  company: string | null;
  location: string | null;
  description: string | null;
  descriptionStatus: "present" | "missing";
  acquisitionMethod: AcquisitionMethod;
  sourceEmailId: string | null;
}

// Gmail keşif koşusunun kalıcı özeti (web'de "son keşif" satırı için).
export interface StoredDiscoveryRun extends DiscoveryRunReport {
  id: string;
  newJobsTotal: number;
  duplicateJobsTotal: number;
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

// Bu koşuda ilk kez görülen ilanın bildirim için yeterli özeti (e-posta gövdesi yok).
export interface NewPostingSummary {
  source: JobSource;
  sourceJobId: string;
  url: string;
  title: string | null;
}

export type NotificationStatus = "not_configured" | "skipped" | "sent" | "error";

export interface NotificationReport {
  channel: "telegram" | "none";
  status: NotificationStatus;
  messages: number;
}

export interface DiscoveryRunReport {
  startedAt: string;
  finishedAt: string;
  emailsRead: number;
  unresolvedEmails: number;
  repositoryErrors: number;
  gmailStatus: "not_used" | "ok" | "error";
  sources: Record<JobSource, SourceRunReport>;
  newPostings: NewPostingSummary[];
  notification: NotificationReport;
}
