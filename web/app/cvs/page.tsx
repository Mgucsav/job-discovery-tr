import Link from "next/link";
import { redirect } from "next/navigation";
import { CvList } from "@/components/cv-list";
import { CvUploadForm } from "@/components/cv-upload-form";
import { SignOutButton } from "@/components/sign-out-button";
import { getVerifiedUser } from "@/lib/auth/next";
import { CV_MAX_COUNT, type StoredCv } from "@/lib/core";
import { listCvs } from "@/lib/cvs/repository";

// Kişisel sayfa: her istekte sunucuda doğrulanır, statik çıktı üretilmez.
export const dynamic = "force-dynamic";

export default async function CvsPage() {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  let cvs: StoredCv[] = [];
  let loadError = false;
  try {
    cvs = await listCvs(user.id);
  } catch {
    loadError = true;
  }

  return (
    <main className="container">
      <div className="topbar">
        <div>
          <h1>CV&apos;lerim</h1>
          <div className="who">{user.email ?? "Oturum açık"}</div>
        </div>
        <div className="actions">
          <Link href="/" className="button">
            İlanlar
          </Link>
          <SignOutButton />
        </div>
      </div>

      <CvUploadForm remaining={Math.max(0, CV_MAX_COUNT - cvs.length)} />

      <section className="card">
        <h2>Kayıtlı CV&apos;ler {cvs.length > 0 ? `(${cvs.length} / ${CV_MAX_COUNT})` : ""}</h2>
        {loadError ? (
          <p className="message error" role="alert">
            CV&apos;ler yüklenemedi. Sayfayı yenileyin; sorun sürerse Firebase bağlantısını kontrol edin.
          </p>
        ) : cvs.length === 0 ? (
          <div className="empty">
            <strong>Henüz CV yok.</strong>
            <span className="muted">Yukarıdaki formla PDF veya DOCX yükleyin. İlk yüklenen CV varsayılan olur.</span>
          </div>
        ) : (
          <CvList cvs={cvs} />
        )}
      </section>
    </main>
  );
}
