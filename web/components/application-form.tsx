import { saveApplication } from "@/app/actions";
import { APPLICATION_LABELS, APPLICATION_STATUSES, type ApplicationRecord, type StoredCv } from "@/lib/core";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" });

function formatDate(value: string | null): string | null {
  return value ? dateFormatter.format(new Date(value)) : null;
}

// Başvuru durumu, kullanılan CV ve kısa not. JavaScript olmadan da çalışır (sunucu eylemi + form).
export function ApplicationForm({
  jobId,
  application,
  cvs,
}: {
  jobId: string;
  application: ApplicationRecord | null;
  cvs: StoredCv[];
}) {
  const appliedAt = formatDate(application?.appliedAt ?? null);
  const decidedAt = formatDate(application?.decidedAt ?? null);
  // Kayıttaki CV listeden silinmiş olabilir; ad kopyası korunduğu için yine gösterilir.
  const missingCv = application?.cvId && !cvs.some((cv) => cv.id === application.cvId);

  return (
    <form action={saveApplication} className="application">
      <input type="hidden" name="id" value={jobId} />
      <label className="sr-only" htmlFor={`status-${jobId}`}>
        Başvuru durumu
      </label>
      <select id={`status-${jobId}`} name="status" defaultValue={application?.status ?? "none"}>
        <option value="none">Başvurmadım</option>
        {APPLICATION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {APPLICATION_LABELS[status]}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={`cv-${jobId}`}>
        Kullanılan CV
      </label>
      <select id={`cv-${jobId}`} name="cvId" defaultValue={application?.cvId ?? ""}>
        <option value="">CV seçilmedi</option>
        {cvs.map((cv) => (
          <option key={cv.id} value={cv.id}>
            {cv.name}
            {cv.isDefault ? " (varsayılan)" : ""}
          </option>
        ))}
        {missingCv ? (
          <option value={application?.cvId ?? ""}>{`${application?.cvName ?? "Bilinmeyen CV"} (silinmiş)`}</option>
        ) : null}
      </select>

      <label className="sr-only" htmlFor={`notes-${jobId}`}>
        Not
      </label>
      <input
        id={`notes-${jobId}`}
        name="notes"
        type="text"
        maxLength={2000}
        placeholder="Not (ör. red e-postası geldi)"
        defaultValue={application?.notes ?? ""}
      />

      <button type="submit">Kaydet</button>

      {application ? (
        <span className="muted-small">
          {appliedAt ? `Başvuru: ${appliedAt}` : null}
          {decidedAt ? ` · Sonuç: ${decidedAt}` : null}
          {application.cvName ? ` · CV: ${application.cvName}` : " · CV kaydedilmedi"}
        </span>
      ) : null}
    </form>
  );
}
