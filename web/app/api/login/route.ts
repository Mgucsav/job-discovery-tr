import { NextResponse } from "next/server";
import { isNextResponse, jsonError, optionalStringField, readJsonObject } from "@/lib/api";
import { LOGIN_ERRORS } from "@/lib/auth/messages";
import { establishSession } from "@/lib/auth/next";
import { signInWithPassword } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Programatik giriş (doğrulama scripti için). Web arayüzü aynı mantığı sunucu eylemiyle kullanır.
export async function POST(request: Request): Promise<NextResponse> {
  const body = await readJsonObject(request);
  if (isNextResponse(body)) return body;

  const email = optionalStringField(body, "email").trim();
  const password = optionalStringField(body, "password");
  if (!email || !password) return jsonError(400, "E-posta ve şifre gerekli.");

  const result = await signInWithPassword(email, password);
  if (!result.ok) {
    const status = result.reason === "invalid" ? 401 : result.reason === "too_many" ? 429 : 503;
    return jsonError(status, LOGIN_ERRORS[result.reason]);
  }

  await establishSession(result.idToken);
  return NextResponse.json({ ok: true });
}
