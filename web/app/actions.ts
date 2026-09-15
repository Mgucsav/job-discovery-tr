"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, getVerifiedUser } from "@/lib/auth/next";
import { prepareManualLink } from "@/lib/jobs/manual-link";
import { OUTCOME_MESSAGES } from "@/lib/jobs/messages";
import { deleteJobPosting as deleteStoredJobPosting, upsertJobPosting } from "@/lib/jobs/repository";
import type { UpsertOutcome } from "@/lib/jobs/types";

export interface AddLinkState {
  status: "idle" | UpsertOutcome | "error";
  message: string | null;
}

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

  try {
    const outcome = await upsertJobPosting(user.id, prepared.input);
    revalidatePath("/");
    return { status: outcome, message: OUTCOME_MESSAGES[outcome] };
  } catch {
    return { status: "error", message: "İlan kaydedilemedi. Lütfen tekrar deneyin." };
  }
}

export async function deleteJobPosting(formData: FormData): Promise<void> {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "").trim();
  await deleteStoredJobPosting(user.id, id);
  revalidatePath("/");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/login");
}
