import { setApplicationStatus } from "@/app/actions";
import type { StoredCv } from "@/lib/core";

// İlan listesinde tek işlem: "Başvurdum". Hangi CV ile başvurulduğu istatistiğin temeli olduğu için
// yanında CV seçimi durur; varsayılan CV önceden seçilidir, tek tıkla kaydedilir.
export function ApplyButton({ jobId, cvs }: { jobId: string; cvs: StoredCv[] }) {
  const defaultCv = cvs.find((cv) => cv.isDefault) ?? cvs[0];
  return (
    <form action={setApplicationStatus} className="apply">
      <input type="hidden" name="id" value={jobId} />
      <input type="hidden" name="status" value="applied" />
      {cvs.length > 0 ? (
        <>
          <label className="sr-only" htmlFor={`apply-cv-${jobId}`}>
            Başvuruda kullanılan CV
          </label>
          <select id={`apply-cv-${jobId}`} name="cvId" defaultValue={defaultCv?.id ?? ""}>
            {cvs.map((cv) => (
              <option key={cv.id} value={cv.id}>
                {cv.name}
                {cv.isDefault ? " (varsayılan)" : ""}
              </option>
            ))}
            <option value="">CV seçmeden</option>
          </select>
        </>
      ) : (
        <input type="hidden" name="cvId" value="" />
      )}
      <button type="submit" className="primary">
        Başvurdum
      </button>
      {cvs.length === 0 ? <span className="muted-small">CV yüklerseniz başvuruya iliştirilir.</span> : null}
    </form>
  );
}
