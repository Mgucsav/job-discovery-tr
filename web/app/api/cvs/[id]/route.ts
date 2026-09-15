import { NextResponse } from "next/server";
import { isNextResponse, jsonError, requireUser } from "@/lib/api";
import { isCvId } from "@/lib/core";
import { contentDisposition, deleteCv, getCvFile } from "@/lib/cvs/repository";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Dosya sunucudan akıtılır; yalnızca sahibi, oturumla. Önbelleğe alınmaz.
export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const user = await requireUser();
  if (isNextResponse(user)) return user;
  const { id } = await params;
  if (!isCvId(id)) return jsonError(400, "Geçersiz CV kimliği.");

  const file = await getCvFile(user.id, id);
  if (!file) return jsonError(404, "CV bulunamadı.");

  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": file.cv.contentType,
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": contentDisposition(file.cv.fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  const user = await requireUser();
  if (isNextResponse(user)) return user;
  const { id } = await params;
  const deleted = await deleteCv(user.id, id);
  if (!deleted) return jsonError(404, "CV bulunamadı.");
  return NextResponse.json({ ok: true });
}
