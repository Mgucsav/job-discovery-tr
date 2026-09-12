import type { JobPosting } from "@/lib/core";
import type { AcquisitionMethod, JobPostingRow } from "@/lib/supabase/database.types";

// Web görünüm modeli: JobPosting sözleşmesinin owner/edinilme bilgisiyle genişletilmiş hali.
// Manuel kayıtta sourceEmailId null'dır; uydurulmaz.
export interface StoredJobPosting extends Omit<JobPosting, "sourceEmailId" | "descriptionStatus"> {
  id: string;
  company: string | null;
  location: string | null;
  description: string | null;
  descriptionStatus: "missing" | "present";
  acquisitionMethod: AcquisitionMethod;
  sourceEmailId: string | null;
}

export function toStoredJobPosting(row: JobPostingRow): StoredJobPosting {
  return {
    id: row.id,
    source: row.source,
    sourceJobId: row.source_job_id,
    url: row.url,
    title: row.title,
    titleStatus: row.title === null ? "missing" : "present",
    company: row.company,
    location: row.location,
    description: row.description,
    descriptionStatus: row.description === null ? "missing" : "present",
    firstSeenAt: row.first_seen_at,
    acquisitionMethod: row.acquisition_method,
    sourceEmailId: row.source_email_id,
  };
}

export const SOURCE_LABELS: Record<JobPosting["source"], string> = {
  linkedin: "LinkedIn",
  kariyer: "Kariyer.net",
  indeed: "Indeed",
};

export const ACQUISITION_LABELS: Record<AcquisitionMethod, string> = {
  manual: "Elle eklendi",
  gmail: "Gmail keşfi",
};
