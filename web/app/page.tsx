import Link from "next/link";
import { redirect } from "next/navigation";
import { AddLinkForm } from "@/components/add-link-form";
import { DiscoveryStatus } from "@/components/discovery-status";
import { JobList } from "@/components/job-list";
import { SignOutButton } from "@/components/sign-out-button";
import { SourceFilter } from "@/components/source-filter";
import { getVerifiedUser } from "@/lib/auth/next";
import type { StoredDiscoveryRun, StoredJobPosting } from "@/lib/core";
import { applyJobListQuery, parseJobListQuery } from "@/lib/jobs/query";
import { getLatestDiscoveryRun, listJobPostings } from "@/lib/jobs/repository";
import { ACQUISITION_LABELS, SOURCE_LABELS } from "@/lib/jobs/types";

// Kişisel sayfa: her istekte sunucuda doğrulanır, statik çıktı üretilmez.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function emptyFilterMessage(query: ReturnType<typeof parseJobListQuery>): string {
  const parts: string[] = [];
  if (query.source) parts.push(SOURCE_LABELS[query.source]);
  if (query.method) parts.push(ACQUISITION_LABELS[query.method].toLocaleLowerCase("tr-TR"));
  return parts.length > 0 ? `${parts.join(" · ")} için kayıtlı ilan yok.` : "Kayıtlı ilan yok.";
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  const query = parseJobListQuery(await searchParams);

  let allJobs: StoredJobPosting[] = [];
  let lastRun: StoredDiscoveryRun | null = null;
  let loadError = false;
  try {
    [allJobs, lastRun] = await Promise.all([listJobPostings(user.id), getLatestDiscoveryRun(user.id)]);
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
        <div className="actions">
          <Link href="/cvs" className="button">
            CV&apos;lerim
          </Link>
          <SignOutButton />
        </div>
      </div>

      <AddLinkForm />

      <section className="card">
        <h2>İlanlar {total > 0 ? `(${jobs.length} / ${total})` : ""}</h2>
        {loadError ? null : <DiscoveryStatus run={lastRun} />}
        <SourceFilter query={query} />
        {loadError ? (
          <p className="message error" role="alert">
            İlanlar yüklenemedi. Sayfayı yenileyin; sorun sürerse Firebase bağlantısını kontrol edin.
          </p>
        ) : total === 0 ? (
          <div className="empty">
            <strong>{lastRun ? "Henüz ilan yok." : "Henüz ilan yok; Gmail keşfi bağlı değil."}</strong>
            <span className="muted">
              {lastRun
                ? "Son Gmail keşfi ilan bulmadı. İş alarmı e-postalarının etikete düştüğünden emin olun veya yukarıdaki formla elle ekleyin."
                : "Bu aşamada ilanlar yalnızca yukarıdaki formla elle eklenir. Gmail iş alarmı keşfi (CLI) henüz bu hesaba yazmadı."}
            </span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty">
            <strong>{emptyFilterMessage(query)}</strong>
          </div>
        ) : (
          <JobList jobs={jobs} />
        )}
      </section>
    </main>
  );
}
