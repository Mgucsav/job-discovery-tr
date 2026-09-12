import { redirect } from "next/navigation";
import { AddLinkForm } from "@/components/add-link-form";
import { JobList } from "@/components/job-list";
import { SignOutButton } from "@/components/sign-out-button";
import { SourceFilter } from "@/components/source-filter";
import { getVerifiedUser } from "@/lib/auth/next";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { applyJobListQuery, parseJobListQuery } from "@/lib/jobs/query";
import { listJobPostings } from "@/lib/jobs/repository";
import { SOURCE_LABELS, type StoredJobPosting } from "@/lib/jobs/types";

// Kişisel sayfa: her istekte sunucuda doğrulanır, statik çıktı üretilmez.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  const query = parseJobListQuery(await searchParams);

  let allJobs: StoredJobPosting[] = [];
  let loadError = false;
  try {
    allJobs = await listJobPostings(getAdminFirestore(), user.id);
  } catch {
    loadError = true;
  }
  const jobs = applyJobListQuery(allJobs, query);
  const total = allJobs.length;

  return (
    <main className="container">
      <div className="topbar">
        <div>
          <h1>İş İlanı Keşfi</h1>
          <div className="who">{user.email ?? "Oturum açık"}</div>
        </div>
        <SignOutButton />
      </div>

      <AddLinkForm />

      <section className="card">
        <h2>İlanlar {total > 0 ? `(${jobs.length} / ${total})` : ""}</h2>
        <SourceFilter query={query} />
        {loadError ? (
          <p className="message error" role="alert">
            İlanlar yüklenemedi. Sayfayı yenileyin; sorun sürerse Firebase bağlantısını kontrol edin.
          </p>
        ) : total === 0 ? (
          <div className="empty">
            <strong>Henüz ilan yok; Gmail keşfi bağlı değil.</strong>
            <span className="muted">
              Bu aşamada ilanlar yalnızca yukarıdaki formla elle eklenir. Gmail iş alarmı keşfi (CLI) henüz bu veri
              tabanına yazmıyor.
            </span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty">
            <strong>{query.source ? `${SOURCE_LABELS[query.source]} kaynağında kayıtlı ilan yok.` : "Kayıtlı ilan yok."}</strong>
          </div>
        ) : (
          <JobList jobs={jobs} />
        )}
      </section>
    </main>
  );
}
