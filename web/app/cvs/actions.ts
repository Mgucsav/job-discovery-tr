"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/auth/next";
import { CV_MAX_BYTES } from "@/lib/core";
import { deleteCv as deleteStoredCv, setDefaultCv as setStoredDefaultCv, uploadCv as uploadStoredCv } from "@/lib/cvs/repository";

export interface CvUploadState {
  status: "idle" | "uploaded" | "error";
  message: string | null;
}

// Her işlem sunucuda doğrulanmış oturum ister; dosya yalnızca sahibinin alanına yazılır.
export async function uploadCvAction(_previous: CvUploadState, formData: FormData): Promise<CvUploadState> {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  const file = formData.get("file");
  const name = String(formData.get("name") ?? "");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Bir PDF veya DOCX dosyası seçin." };
  if (file.size > CV_MAX_BYTES) return { status: "error", message: "Dosya en fazla 4 MB olabilir." };

  try {
    const result = await uploadStoredCv(user.id, name, file);
    if (!result.ok) return { status: "error", message: result.error };
    revalidatePath("/cvs");
    return { status: "uploaded", message: `"${result.cv.name}" kaydedildi.` };
  } catch {
    return { status: "error", message: "CV kaydedilemedi. Lütfen tekrar deneyin." };
  }
}

export async function setDefaultCvAction(formData: FormData): Promise<void> {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");
  await setStoredDefaultCv(user.id, String(formData.get("id") ?? "").trim());
  revalidatePath("/cvs");
}

export async function deleteCvAction(formData: FormData): Promise<void> {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");
  await deleteStoredCv(user.id, String(formData.get("id") ?? "").trim());
  revalidatePath("/cvs");
}
