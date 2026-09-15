import { deleteCvAction, setDefaultCvAction } from "@/app/cvs/actions";
import type { StoredCv } from "@/lib/core";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function CvList({ cvs }: { cvs: StoredCv[] }) {
  return (
    <ul className="job-list">
      {cvs.map((cv) => (
        <li key={cv.id} className="job">
          <div className="job-head">
            <span className="job-title">
              {cv.name}
              {cv.isDefault ? <span className="badge">Varsayılan</span> : null}
            </span>
            <span className="muted">{cv.kind.toUpperCase()}</span>
          </div>
          <div className="job-meta">
            <span>{cv.fileName}</span>
            <span>{formatSize(cv.size)}</span>
            <span>Yüklendi: {dateFormatter.format(new Date(cv.createdAt))}</span>
          </div>
          <div className="job-actions">
            <a className="button primary" href={`/api/cvs/${cv.id}`}>
              İndir
            </a>
            {cv.isDefault ? null : (
              <form action={setDefaultCvAction}>
                <input type="hidden" name="id" value={cv.id} />
                <button type="submit">Varsayılan yap</button>
              </form>
            )}
            <form action={deleteCvAction}>
              <input type="hidden" name="id" value={cv.id} />
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
