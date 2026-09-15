import type { AcquisitionMethod, JobSource } from "@/lib/core";

// Depo tipleri (StoredJobPosting, StoredJobPostingInput, UpsertOutcome) depo kökündeki src/domain.ts'te
// tanımlıdır ve @/lib/core üzerinden içe aktarılır; burada yalnızca arayüz etiketleri bulunur.
export type { AcquisitionMethod, StoredJobPosting, StoredJobPostingInput, UpsertOutcome } from "@/lib/core";

export const SOURCE_LABELS: Record<JobSource, string> = {
  linkedin: "LinkedIn",
  kariyer: "Kariyer.net",
  indeed: "Indeed",
};

export const ACQUISITION_LABELS: Record<AcquisitionMethod, string> = {
  manual: "Elle eklendi",
  gmail: "Gmail keşfi",
};
