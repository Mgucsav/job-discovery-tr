import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { readSupabasePublicEnv } from "./env";

// Sunucu bileşenleri, sunucu eylemleri ve route handler'lar için oturum çerezlerini okuyan istemci.
// Yetki kanıtı olarak her zaman auth.getUser() (Auth sunucusunda doğrulanır) kullanılır.
export async function createSupabaseServerClient() {
  const { url, publishableKey } = readSupabasePublicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Sunucu bileşeninden çağrıldığında çerez yazılamaz; proxy.ts oturumu tazeler.
        }
      },
    },
  });
}

export interface VerifiedUser {
  id: string;
  email: string | null;
}

// Doğrulanmış kullanıcı yoksa null döner; getSession() içindeki kullanıcı nesnesine güvenilmez.
export async function getVerifiedUser(): Promise<VerifiedUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
