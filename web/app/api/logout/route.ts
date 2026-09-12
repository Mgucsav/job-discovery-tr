import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth/next";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  await endSession();
  return NextResponse.json({ ok: true });
}
