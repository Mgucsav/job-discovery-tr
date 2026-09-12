"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prepareManualLink } from "@/lib/jobs/manual-link";
import { createSupabaseServerClient, getVerifiedUser } from "@/lib/supabase/server";

export interface AddLinkState {
  status: "idle" | "inserted" | "updated" | "unchanged" | "error";
  message: string | null;
}

const OUTCOME_MESSAGES: Record<Exclude<AddLinkState["status"], "idle" | "error">, string> = {
  inserted: "İlan eklendi.",
  updated: "İlan zaten kayıtlıydı; eksik alanlar tamamlandı.",
  unchanged: "Bu ilan zaten kayıtlı; değişiklik yapılmadı.",
};

// Her yazma işlemi sunucuda doğrulanmış oturum ister; proxy.ts tek başına yetki kaynağı değildir.
export async function addJobLink(_previous: AddLinkState, formData: FormData): Promise<AddLinkState> {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  const prepared = prepareManualLink({
    url: String(formData.get("url") ?? ""),
    title: String(formData.get("title") ?? ""),
    company: String(formData.get("company") ?? ""),
    location: String(formData.get("location") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!prepared.ok) return { status: "error", message: prepared.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("upsert_job_posting", prepared.args);
  if (error) {
    return { status: "error", message: "İlan kaydedilemedi. Lütfen tekrar deneyin." };
  }
  revalidatePath("/");
  const outcome = data === "inserted" || data === "updated" || data === "unchanged" ? data : "unchanged";
  return { status: outcome, message: OUTCOME_MESSAGES[outcome] };
}

export async function deleteJobPosting(formData: FormData): Promise<void> {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  const supabase = await createSupabaseServerClient();
  // RLS yalnızca sahibin satırını siler; owner_id koşulu ek güvence olarak tekrar verilir.
  await supabase.from("job_postings").delete().eq("id", id).eq("owner_id", user.id);
  revalidatePath("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
