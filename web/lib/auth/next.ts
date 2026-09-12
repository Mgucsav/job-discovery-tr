import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  createSessionCookieValue,
  revokeUserSessions,
  sessionCookieOptions,
  verifySessionCookieValue,
  type VerifiedUser,
} from "./session";

// Sunucu bileşenleri, sunucu eylemleri ve route handler'lar için doğrulanmış kullanıcı.
export async function getVerifiedUser(): Promise<VerifiedUser | null> {
  const store = await cookies();
  return verifySessionCookieValue(store.get(SESSION_COOKIE_NAME)?.value);
}

// Yalnızca sunucu eylemi / route handler içinden çağrılabilir (çerez yazma).
export async function establishSession(idToken: string): Promise<void> {
  const value = await createSessionCookieValue(idToken);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, value, sessionCookieOptions());
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const user = await verifySessionCookieValue(store.get(SESSION_COOKIE_NAME)?.value);
  if (user) {
    try {
      await revokeUserSessions(user.id);
    } catch {
      // İptal başarısız olsa bile çerez silinir; çerez olmadan oturum kullanılamaz.
    }
  }
  store.delete(SESSION_COOKIE_NAME);
}
