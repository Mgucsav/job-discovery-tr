export interface SupabasePublicEnv {
  url: string;
  publishableKey: string;
}

// Tarayıcıya çıkabilecek tek iki değer: proje URL'si ve publishable anahtar.
export function readSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ortam değişkenleri tanımlı olmalı.",
    );
  }
  return { url, publishableKey };
}
