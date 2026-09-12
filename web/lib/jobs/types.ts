import type { JobPosting, JobSource } from "@/lib/core";

export type AcquisitionMethod = "manual" | "gmail";
export type UpsertOutcome = "inserted" | "updated" | "unchanged";

// Depoya yazılacak ilan: JobPosting sözleşmesi + edinilme yöntemi + isteğe bağlı alanlar.
// Manuel kayıtta sourceEmailId null'dır; uydurulmaz. Gmail kaydında zorunludur.
export interface JobPostingInput {
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

// Web görünüm modeli: JobPosting sözleşmesinin sahip/edinilme bilgisiyle genişletilmiş hali.
export interface StoredJobPosting extends Omit<JobPosting, "sourceEmailId" | "descriptionStatus"> {
  id: string;
  company: string | null;
  location: string | null;
  description: string | null;
  descriptionStatus: "missing" | "present";
  acquisitionMethod: AcquisitionMethod;
  sourceEmailId: string | null;
}

export const SOURCE_LABELS: Record<JobSource, string> = {
  linkedin: "LinkedIn",
  kariyer: "Kariyer.net",
  indeed: "Indeed",
};

export const ACQUISITION_LABELS: Record<AcquisitionMethod, string> = {
  manual: "Elle eklendi",
  gmail: "Gmail keşfi",
};
