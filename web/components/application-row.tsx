import { setApplicationStatus } from "@/app/actions";
import {
  APPLICATION_LABELS,
  EXPERIENCE_LABELS,
  inferExperienceLevel,
  type ApplicationStatus,
  type StoredCv,
  type StoredJobPosting,
} from "@/lib/core";
import { SOURCE_LABELS } from "@/lib/jobs/types";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" });

function formatDate(value: string | null | undefined): string | null {
  return value ? dateFormatter.format(new Date(value)) : null;
}

// Her durumdan geçilebilecek sonraki adımlar. Sonuç geldiğinde tek tıkla taşınır.
const NEXT_STEPS: Record<ApplicationStatus, ApplicationStatus[]> = {
  applied: ["interview", "offer", "rejected", "withdrawn"],
  interview: ["offer", "rejected", "withdrawn"],
  offer: ["rejected", "withdrawn"],
  rejected: ["applied", "interview"],
  withdrawn: ["applied"],
};

const STEP_LABELS: Record<ApplicationStatus, string> = {
  applied: "Aktife al",
  interview: "Görüşmeye çağrıldım",
  offer: "Teklif aldım",
  rejected: "Reddedildim",
  withdrawn: "Geri çektim",
};

function StatusButton({ jobId, status, cvId }: { jobId: string; status: ApplicationStatus; cvId: string | null }) {
  return (
    <form action={setApplicationStatus}>
      <input type="hidden" name="id" value={jobId} />
      <input type="hidden" name="status" value={status} />
      {cvId ? <input type="hidden" name="cvId" value={cvId} /> : null}
      <button type="submit" className={status === "rejected" ? "danger" : status === "offer" || status === "interview" ? "primary" : ""}>
        {STEP_LABELS[status]}
      </button>
    </form>
  );
}

export function ApplicationRow({ job, cvs }: { job: StoredJobPosting; cvs: StoredCv[] }) {
  const application = job.application;
  if (!application) return null;
  const inferred = inferExperienceLevel(job.title, job.description);
  const missingCv = application.cvId !== null && !cvs.some((cv) => cv.id === application.cvId);

  return (
    <li className="job">
      <div className="job-head">
        {job.title ? <span className="job-title">{job.title}</span> : <span className="job-title missing">Başlık yok</span>}
        <span className="muted">
          {SOURCE_LABELS[job.source]} · {job.sourceJobId}
        </span>
      </div>
      <div className="job-meta">
        <span>{job.company ?? "Şirket belirtilmedi"}</span>
        <span>{job.location ?? "Konum belirtilmedi"}</span>
        <span>Başvuru: {formatDate(application.appliedAt) ?? "tarih yok"}</span>
        {application.decidedAt ? <span>Sonuç: {formatDate(application.decidedAt)}</span> : null}
        <span className={`badge status-${application.status}`}>{APPLICATION_LABELS[application.status]}</span>
        {inferred ? <span className="badge guess">{EXPERIENCE_LABELS[inferred.level]} (tahmin)</span> : null}
      </div>

      <div className="job-actions">
        <a className="button" href={job.url} target="_blank" rel="noopener noreferrer">
          İlanı aç
        </a>
        {NEXT_STEPS[application.status].map((status) => (
          <StatusButton key={status} jobId={job.id} status={status} cvId={application.cvId} />
        ))}
        <form action={setApplicationStatus}>
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="status" value="none" />
          <button type="submit">Başvuruyu kaldır</button>
        </form>
      </div>

      {/* Kullanılan CV ve not sonradan düzeltilebilir; durum aynı kalır. */}
      <form action={setApplicationStatus} className="application">
        <input type="hidden" name="id" value={job.id} />
        <input type="hidden" name="status" value={application.status} />
        <label className="sr-only" htmlFor={`cv-${job.id}`}>
          Kullanılan CV
        </label>
        <select id={`cv-${job.id}`} name="cvId" defaultValue={application.cvId ?? ""}>
          <option value="">CV seçilmedi</option>
          {cvs.map((cv) => (
            <option key={cv.id} value={cv.id}>
              {cv.name}
            </option>
          ))}
          {missingCv ? <option value={application.cvId ?? ""}>{`${application.cvName ?? "Bilinmeyen CV"} (silinmiş)`}</option> : null}
        </select>
        <label className="sr-only" htmlFor={`notes-${job.id}`}>
          Not
        </label>
        <input
          id={`notes-${job.id}`}
          name="notes"
          type="text"
          maxLength={2000}
          placeholder="Not (ör. 3 Ekim görüşme)"
          defaultValue={application.notes ?? ""}
        />
        <button type="submit">Kaydet</button>
      </form>
    </li>
  );
}
