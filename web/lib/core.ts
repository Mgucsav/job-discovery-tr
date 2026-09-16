// Depo kökündeki keşif çekirdeği tek noktadan içe aktarılır; sözleşme, URL doğrulama kuralları ve
// Firestore belge mantığı çoğaltılmaz. (Turbopack kökü next.config.ts içinde depo köküne ayarlıdır.)
export {
  ACQUISITION_METHODS,
  APPLICATION_STATUSES,
  JOB_SOURCES,
  type AcquisitionMethod,
  type ApplicationRecord,
  type ApplicationStatus,
  type DiscoveryRunReport,
  type JobPosting,
  type JobSource,
  type StoredDiscoveryRun,
  type StoredJobPosting,
  type StoredJobPostingInput,
} from "../../src/domain";
export { validateJobUrl } from "../../src/discovery/parser";
export {
  APPLICATION_LABELS,
  applicationTotals,
  isApplicationStatus,
  summarizeByCv,
  summarizeByExperience,
  summarizeBySource,
  type ApplicationBucket,
  type ApplicationInput,
} from "../../src/applications/tracking";
export {
  PERIOD_OPTIONS,
  comparePeriods,
  delta,
  isPeriodDays,
  metricsForRange,
  weeklyTrend,
  type PeriodComparison,
  type PeriodDays,
  type PeriodMetrics,
} from "../../src/applications/trends";
export {
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  experienceLabel,
  extractExperienceYears,
  inferExperienceLevel,
  type ExperienceInference,
  type ExperienceLevel,
} from "../../src/discovery/experience";
export type { UpsertOutcome } from "../../src/storage/repository";
export {
  deleteStoredJobPosting,
  latestDiscoveryRun,
  listStoredJobPostings,
  setJobApplication,
  upsertStoredJobPosting,
  type JobPostingStore,
} from "../../src/storage/job-posting-store";
export {
  CV_MAX_BYTES,
  CV_MAX_COUNT,
  deleteCv,
  getCv,
  isCvId,
  listCvs,
  readCvBytes,
  setDefaultCv,
  uploadCv,
  validateCvUpload,
  type CvKind,
  type StoredCv,
} from "../../src/storage/cv-store";
