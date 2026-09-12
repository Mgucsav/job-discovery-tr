import { deleteJobPosting } from "@/app/actions";
import { ACQUISITION_LABELS, SOURCE_LABELS, type StoredJobPosting } from "@/lib/jobs/types";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export function JobList({ jobs }: { jobs: StoredJobPosting[] }) {
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
        </li>
      ))}
    </ul>
  );
}
