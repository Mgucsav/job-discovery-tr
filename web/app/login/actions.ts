"use server";

import { redirect } from "next/navigation";
import { establishSession } from "@/lib/auth/next";
import { LOGIN_ERRORS } from "@/lib/auth/messages";
import { signInWithPassword } from "@/lib/auth/session";

export interface LoginState {
  error: string | null;
}

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "E-posta ve şifre gerekli." };

  const result = await signInWithPassword(email, password);
  if (!result.ok) return { error: LOGIN_ERRORS[result.reason] };

  await establishSession(result.idToken);
  redirect("/");
}
