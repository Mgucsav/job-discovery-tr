import { signOut } from "@/app/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit">Çıkış yap</button>
    </form>
  );
}
