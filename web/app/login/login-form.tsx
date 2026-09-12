"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  return (
    <form action={formAction} className="card">
      <h2>Giriş</h2>
      <div className="form-grid">
        <div className="full">
          <label htmlFor="email">E-posta</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="full">
          <label htmlFor="password">Şifre</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
      </div>
      {state.error ? (
        <p className="message error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </div>
      <p className="muted">Yeni kullanıcı kaydı kapalıdır; yalnızca tanımlı hesap giriş yapabilir.</p>
    </form>
  );
}
