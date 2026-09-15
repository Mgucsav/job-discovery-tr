import { NextResponse } from "next/server";
import { isNextResponse, jsonError, requireUser } from "@/lib/api";
import { CV_MAX_BYTES } from "@/lib/core";
import { listCvs, uploadCv } from "@/lib/cvs/repository";

export const dynamic = "force-dynamic";

// Oturum açmış kullanıcının CV meta listesi (dosya içeriği yok).
export async function GET(): Promise<NextResponse> {
  const user = await requireUser();
  if (isNextResponse(user)) return user;
  const cvs = await listCvs(user.id);
  return NextResponse.json({ cvs });
}

// multipart/form-data: name (metin) + file (PDF/DOCX). Web arayüzü aynı mantığı sunucu eylemiyle kullanır.
export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (isNextResponse(user)) return user;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return jsonError(415, "İstek gövdesi multipart/form-data olmalı.");
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "Form verisi okunamadı.");
  }
  const file = formData.get("file");
  const name = String(formData.get("name") ?? "");
  if (!(file instanceof File) || file.size === 0) return jsonError(422, "Bir PDF veya DOCX dosyası gerekli.");
  if (file.size > CV_MAX_BYTES) return jsonError(413, "Dosya en fazla 4 MB olabilir.");

  const result = await uploadCv(user.id, name, file);
  if (!result.ok) return jsonError(422, result.error);
  return NextResponse.json({ cv: result.cv }, { status: 201 });
}
