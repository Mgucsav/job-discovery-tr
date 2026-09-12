// Depo kökündeki keşif çekirdeği tek noktadan içe aktarılır; sözleşme ve URL doğrulama
// kuralları çoğaltılmaz. (Turbopack kökü next.config.ts içinde depo köküne ayarlıdır.)
export { JOB_SOURCES, type JobPosting, type JobSource } from "../../src/domain";
export { validateJobUrl } from "../../src/discovery/parser";
