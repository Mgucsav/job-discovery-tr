import { deleteJobPosting } from "@/app/actions";
import { ApplicationForm } from "@/components/application-form";
import {
  APPLICATION_LABELS,
  EXPERIENCE_LABELS,
  extractExperienceYears,
  inferExperienceLevel,
  type StoredCv,
} from "@/lib/core";
import { ACQUISITION_LABELS, SOURCE_LABELS, type StoredJobPosting } from "@/lib/jobs/types";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

// Deneyim düzeyi sitenin alanı değildir: başlıktan (yoksa açıklamadan) çıkarılır ve "tahmin" olarak
// gösterilir. Çıkarılamıyorsa hiçbir şey gösterilmez.
function ExperienceBadge({ job }: { job: StoredJobPosting }) {
  const inferred = inferExperienceLevel(job.title, job.description);
  if (!inferred) return null;
  const years = extractExperienceYears(job.description);
  const source = inferred.source === "title" ? "başlıktan" : "açıklamadan";
  return (
    <span className="badge guess" title={`"${inferred.evidence}" ifadesinden ${source} tahmin edildi; ilan e-postasında deneyim alanı yer almaz.`}>
      {EXPERIENCE_LABELS[inferred.level]}
      {years !== null ? ` · ${years}+ yıl` : ""} (tahmin)
    </span>
  );
}

export function JobList({ jobs, cvs }: { jobs: StoredJobPosting[]; cvs: StoredCv[] }) {
  return (
    <ul className="job-list">
      {jobs.map((job) => (
        <li key={job.id} className="job">
          <div className="job-head">
            {job.title ? (
              <span className="job-title">{job.title}</span>
            ) : (
              <span className="job-title missing">Başlık yok</span>
            )}
            <span className="muted">
              {SOURCE_LABELS[job.source]} · {job.sourceJobId}
            </span>
          </div>
          <div className="job-meta">
            <span>{job.company ?? "Şirket belirtilmedi"}</span>
            <span>{job.location ?? "Konum belirtilmedi"}</span>
            <span>İlk görülme: {dateFormatter.format(new Date(job.firstSeenAt))}</span>
            <span>{ACQUISITION_LABELS[job.acquisitionMethod]}</span>
            <ExperienceBadge job={job} />
            {job.application ? (
              <span className={`badge status-${job.application.status}`}>{APPLICATION_LABELS[job.application.status]}</span>
            ) : null}
          </div>
          {job.description ? <p className="job-desc">{job.description}</p> : null}
          <div className="job-actions">
            <a className="button primary" href={job.url} target="_blank" rel="noopener noreferrer">
              İlanı aç
            </a>
            <form action={deleteJobPosting}>
              <input type="hidden" name="id" value={job.id} />
              <button type="submit" className="danger">
                Sil
              </button>
            </form>
          </div>
          <ApplicationForm jobId={job.id} application={job.application} cvs={cvs} />
        </li>
      ))}
    </ul>
  );
}
