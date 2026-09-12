import "server-only";
import { getAdminAuth } from "@/lib/firebase/admin";
import { readFirebaseServerEnv } from "@/lib/firebase/env";

export const SESSION_COOKIE_NAME = "__session";
// Firebase oturum çerezi üst sınırı 14 gündür; kişisel kullanım için 5 gün yeterli.
const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000;

export interface VerifiedUser {
  id: string;
  email: string | null;
}

export type SignInResult =
  | { ok: true; idToken: string }
  | { ok: false; reason: "invalid" | "too_many" | "unavailable" };

const INVALID_CREDENTIAL_CODES = [
  "INVALID_LOGIN_CREDENTIALS",
  "INVALID_PASSWORD",
  "EMAIL_NOT_FOUND",
  "INVALID_EMAIL",
  "USER_DISABLED",
  "MISSING_PASSWORD",
];

// E-posta/şifre doğrulaması Identity Toolkit REST API'sinde yapılır (tarayıcıya SDK gitmez).
// Şifre yalnızca Google'a iletilir; ne loglanır ne de saklanır.
export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const { webApiKey } = readFirebaseServerEnv();
  let response: Response;
  try {
    response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(webApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
        cache: "no-store",
      },
    );
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const payload = (await response.json().catch(() => null)) as
    | { idToken?: string; error?: { message?: string } }
    | null;
  if (response.ok && typeof payload?.idToken === "string") return { ok: true, idToken: payload.idToken };

  const code = payload?.error?.message ?? "";
  if (code.startsWith("TOO_MANY_ATTEMPTS")) return { ok: false, reason: "too_many" };
  if (INVALID_CREDENTIAL_CODES.some((known) => code.startsWith(known))) return { ok: false, reason: "invalid" };
  return { ok: false, reason: "unavailable" };
}

export async function createSessionCookieValue(idToken: string): Promise<string> {
  return getAdminAuth().createSessionCookie(idToken, { expiresIn: SESSION_TTL_MS });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

// Oturum çerezi Firebase Auth tarafından imza + iptal kontrolüyle doğrulanır.
// Çerezin varlığı veya içindeki iddialar tek başına yetki kanıtı sayılmaz.
export async function verifySessionCookieValue(value: string | undefined): Promise<VerifiedUser | null> {
  if (!value) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(value, true);
    return { id: decoded.uid, email: typeof decoded.email === "string" ? decoded.email : null };
  } catch {
    return null;
  }
}

// Çıkışta refresh token'lar iptal edilir; mevcut oturum çerezleri de geçersizleşir.
export async function revokeUserSessions(uid: string): Promise<void> {
  await getAdminAuth().revokeRefreshTokens(uid);
}
