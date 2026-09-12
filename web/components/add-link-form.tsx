"use client";

import { useActionState, useEffect, useRef } from "react";
import { addJobLink, type AddLinkState } from "@/app/actions";

const initialState: AddLinkState = { status: "idle", message: null };

export function AddLinkForm() {
  const [state, formAction, pending] = useActionState(addJobLink, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "inserted" || state.status === "updated") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card">
      <h2>Bağlantı ekle</h2>
      <p className="muted">
        LinkedIn, Kariyer.net veya Indeed ilan bağlantısını yapıştırın. Başlık, şirket, konum ve açıklama isteğe
        bağlıdır; boş bırakılan alanlar boş kalır.
      </p>
      <div className="form-grid">
        <div className="full">
          <label htmlFor="url">İlan bağlantısı (zorunlu)</label>
          <input id="url" name="url" type="url" inputMode="url" placeholder="https://www.linkedin.com/jobs/view/..." required />
        </div>
        <div>
          <label htmlFor="title">Başlık</label>
          <input id="title" name="title" type="text" maxLength={240} />
        </div>
        <div>
          <label htmlFor="company">Şirket</label>
          <input id="company" name="company" type="text" maxLength={200} />
        </div>
        <div>
          <label htmlFor="location">Konum</label>
          <input id="location" name="location" type="text" maxLength={200} />
        </div>
        <div className="full">
          <label htmlFor="description">Açıklama</label>
          <textarea id="description" name="description" maxLength={5000} />
        </div>
      </div>
      {state.message ? (
        <p className={`message ${state.status === "error" ? "error" : "success"}`} role="status">
          {state.message}
        </p>
      ) : null}
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Kaydediliyor..." : "Bağlantıyı ekle"}
        </button>
      </div>
    </form>
  );
}
