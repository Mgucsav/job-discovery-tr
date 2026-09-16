import Link from "next/link";
import { redirect } from "next/navigation";
import { AddLinkForm } from "@/components/add-link-form";
import { DiscoveryStatus } from "@/components/discovery-status";
import { JobList } from "@/components/job-list";
import { Nav } from "@/components/nav";
import { SourceFilter } from "@/components/source-filter";
import { getVerifiedUser } from "@/lib/auth/next";
import { EXPERIENCE_LABELS, type StoredCv, type StoredDiscoveryRun, type StoredJobPosting } from "@/lib/core";
import { listCvs } from "@/lib/cvs/repository";
import { applyJobListQuery, availableLevels, buildJobListHref, parseJobListQuery } from "@/lib/jobs/query";
import { getLatestDiscoveryRun, listJobPostings } from "@/lib/jobs/repository";
import { ACQUISITION_LABELS, SOURCE_LABELS } from "@/lib/jobs/types";

// Kişisel sayfa: her istekte sunucuda doğrulanır, statik çıktı üretilmez.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function emptyFilterMessage(query: ReturnType<typeof parseJobListQuery>): string {
  const parts: string[] = [];
  if (query.source) parts.push(SOURCE_LABELS[query.source]);
  if (query.method) parts.push(ACQUISITION_LABELS[query.method].toLocaleLowerCase("tr-TR"));
  if (query.level) parts.push(query.level === "unknown" ? "deneyim belirtilmemiş" : EXPERIENCE_LABELS[query.level]);
  return parts.length > 0 ? `${parts.join(" · ")} için kayıtlı ilan yok.` : "Kayıtlı ilan yok.";
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  const query = parseJobListQuery(await searchParams);

  let allJobs: StoredJobPosting[] = [];
  let lastRun: StoredDiscoveryRun | null = null;
  let cvs: StoredCv[] = [];
  let loadError = false;
  try {
    [allJobs, lastRun, cvs] = await Promise.all([listJobPostings(user.id), getLatestDiscoveryRun(user.id), listCvs(user.id)]);
  } catch {
    loadError = true;
  }
  const jobs = applyJobListQuery(allJobs, query);
  // Başvurulan ilanlar varsayılan listede görünmez; takipleri Başvurular sayfasındadır.
  const openJobs = allJobs.filter((job) => job.application === null);
  const appliedCount = allJobs.length - openJobs.length;

  return (
    <main className="container">
      <Nav title="İş İlanı Keşfi" email={user.email} current="/" />

      <AddLinkForm />

      <section className="card">
        <h2>
          İlanlar {allJobs.length > 0 ? `(${jobs.length} / ${query.includeApplied ? allJobs.length : openJobs.length})` : ""}
        </h2>
        {loadError ? null : <DiscoveryStatus run={lastRun} />}
        {appliedCount > 0 ? (
          <p className="status muted">
            {appliedCount} ilana başvurdunuz; başvurular listede görünmez.{" "}
            <Link href="/applications">Başvurular sayfası</Link> ·{" "}
            <Link href={buildJobListHref({ ...query, includeApplied: !query.includeApplied })}>
              {query.includeApplied ? "Başvurulanları gizle" : "Başvurulanları da göster"}
            </Link>
          </p>
        ) : null}
        <SourceFilter query={query} levels={availableLevels(query.includeApplied ? allJobs : openJobs)} />
        {loadError ? (
          <p className="message error" role="alert">
            İlanlar yüklenemedi. Sayfayı yenileyin; sorun sürerse Firebase bağlantısını kontrol edin.
          </p>
        ) : allJobs.length === 0 ? (
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
            <strong>
              {openJobs.length === 0 && !query.includeApplied ? "Bekleyen ilan kalmadı; hepsine başvurdunuz." : emptyFilterMessage(query)}
            </strong>
          </div>
        ) : (
          <JobList jobs={jobs} cvs={cvs} />
        )}
      </section>
    </main>
  );
}
