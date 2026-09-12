import type { SignInResult } from "./session";

export type SignInFailure = Extract<SignInResult, { ok: false }>["reason"];

export const LOGIN_ERRORS: Record<SignInFailure, string> = {
  invalid: "Giriş başarısız. E-posta ve şifreyi kontrol edin.",
  too_many: "Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.",
  unavailable: "Kimlik doğrulama servisine ulaşılamadı. Daha sonra tekrar deneyin.",
};
