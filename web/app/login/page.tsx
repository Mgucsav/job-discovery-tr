import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getVerifiedUser();
  if (user) redirect("/");
  return (
    <main className="container login">
      <div className="topbar">
        <h1>İş İlanı Keşfi</h1>
      </div>
      <LoginForm />
    </main>
  );
}
