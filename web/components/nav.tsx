import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

const LINKS = [
  { href: "/", label: "İlanlar" },
  { href: "/applications", label: "Başvurular" },
  { href: "/stats", label: "İstatistikler" },
  { href: "/trends", label: "Dönemsel" },
  { href: "/cvs", label: "CV'lerim" },
] as const;

// Üst çubuk: başlık, oturum e-postası ve sayfalar arası gezinme.
export function Nav({ title, email, current }: { title: string; email: string | null; current: string }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        <div className="who">{email ?? "Oturum açık"}</div>
      </div>
      <div className="actions">
        {LINKS.filter((link) => link.href !== current).map((link) => (
          <Link key={link.href} href={link.href} className="button">
            {link.label}
          </Link>
        ))}
        <SignOutButton />
      </div>
    </div>
  );
}
