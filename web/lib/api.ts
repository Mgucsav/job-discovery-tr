import "server-only";
import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth/next";
import type { VerifiedUser } from "@/lib/auth/session";

// JSON API yardımcıları: oturum doğrulama, JSON gövde okuma ve tekdüze hata yanıtları.
// Gövdesi olan istekler yalnızca application/json kabul eder; form gönderimleriyle CSRF yapılamaz.

export function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function requireUser(): Promise<VerifiedUser | NextResponse> {
  const user = await getVerifiedUser();
  return user ?? jsonError(401, "Oturum gerekli.");
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonError(415, "İstek gövdesi application/json olmalı.");
  }
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // aşağıda tek tip hata döner
  }
  return jsonError(400, "Geçersiz JSON gövdesi.");
}

export function optionalStringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}
