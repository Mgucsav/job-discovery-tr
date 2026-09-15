import { NextResponse } from "next/server";
import { isNextResponse, jsonError, optionalStringField, readJsonObject, requireUser } from "@/lib/api";
import { prepareManualLink } from "@/lib/jobs/manual-link";
import { OUTCOME_MESSAGES } from "@/lib/jobs/messages";
import { deleteJobPosting, listJobPostings, upsertJobPosting } from "@/lib/jobs/repository";

export const dynamic = "force-dynamic";

// Oturum açmış kullanıcının ilanları (JSON). Web arayüzü aynı depo fonksiyonlarını sunucu eylemleriyle kullanır.
export async function GET(): Promise<NextResponse> {
  const user = await requireUser();
  if (isNextResponse(user)) return user;
  const jobs = await listJobPostings(user.id);
  return NextResponse.json({ jobs });
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (isNextResponse(user)) return user;
  const body = await readJsonObject(request);
  if (isNextResponse(body)) return body;

  const prepared = prepareManualLink({
    url: optionalStringField(body, "url"),
    title: optionalStringField(body, "title"),
    company: optionalStringField(body, "company"),
    location: optionalStringField(body, "location"),
    description: optionalStringField(body, "description"),
  });
  if (!prepared.ok) return jsonError(422, prepared.error);

  const outcome = await upsertJobPosting(user.id, prepared.input);
  return NextResponse.json({ outcome, message: OUTCOME_MESSAGES[outcome] }, { status: outcome === "inserted" ? 201 : 200 });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (isNextResponse(user)) return user;
  const body = await readJsonObject(request);
  if (isNextResponse(body)) return body;

  const id = optionalStringField(body, "id").trim();
  const deleted = await deleteJobPosting(user.id, id);
  if (!deleted) return jsonError(400, "Geçersiz ilan kimliği.");
  return NextResponse.json({ ok: true });
}
