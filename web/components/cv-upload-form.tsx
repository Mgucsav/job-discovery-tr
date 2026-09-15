"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadCvAction, type CvUploadState } from "@/app/cvs/actions";

const initialState: CvUploadState = { status: "idle", message: null };

export function CvUploadForm({ remaining }: { remaining: number }) {
  const [state, formAction, pending] = useActionState(uploadCvAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "uploaded") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card" encType="multipart/form-data">
      <h2>CV yükle</h2>
      <p className="muted">
        PDF veya Word (.docx), en fazla 4 MB. Dosya yalnızca sizin hesabınızda saklanır; ileride başvuru
        asistanı buradan seçer. Kalan yer: {remaining}.
      </p>
      <div className="form-grid">
        <div>
          <label htmlFor="cv-name">CV adı (örn. &quot;Veri Analisti CV&quot;)</label>
          <input id="cv-name" name="name" type="text" maxLength={80} required />
        </div>
        <div>
          <label htmlFor="cv-file">Dosya</label>
          <input id="cv-file" name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
        </div>
      </div>
      {state.message ? (
        <p className={`message ${state.status === "error" ? "error" : "success"}`} role="status">
          {state.message}
        </p>
      ) : null}
      <div className="actions">
        <button type="submit" className="primary" disabled={pending || remaining <= 0}>
          {pending ? "Yükleniyor..." : "CV'yi kaydet"}
        </button>
      </div>
    </form>
  );
}
