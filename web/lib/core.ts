// Depo kökündeki keşif çekirdeği tek noktadan içe aktarılır; sözleşme, URL doğrulama kuralları ve
// Firestore belge mantığı çoğaltılmaz. (Turbopack kökü next.config.ts içinde depo köküne ayarlıdır.)
export {
  ACQUISITION_METHODS,
  JOB_SOURCES,
  type AcquisitionMethod,
  type DiscoveryRunReport,
  type JobPosting,
  type JobSource,
  type StoredDiscoveryRun,
  type StoredJobPosting,
  type StoredJobPostingInput,
} from "../../src/domain";
export { validateJobUrl } from "../../src/discovery/parser";
export type { UpsertOutcome } from "../../src/storage/repository";
export {
  deleteStoredJobPosting,
  latestDiscoveryRun,
  listStoredJobPostings,
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
