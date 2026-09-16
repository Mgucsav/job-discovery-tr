import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplicationRow } from "@/components/application-row";
import { Nav } from "@/components/nav";
import { getVerifiedUser } from "@/lib/auth/next";
import {
  APPLICATION_LABELS,
  isApplicationStatus,
  type ApplicationStatus,
  type StoredCv,
  type StoredJobPosting,
} from "@/lib/core";
import { listCvs } from "@/lib/cvs/repository";
import { listJobPostings } from "@/lib/jobs/repository";

// Kişisel sayfa: her istekte sunucuda doğrulanır, statik çıktı üretilmez.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Sekme sırası akışı izler: aktif -> görüşme -> teklif; sonuçlar ayrı sekmelerde.
const TABS: Array<{ status: ApplicationStatus; label: string; hint: string }> = [
  { status: "applied", label: "Aktif", hint: "Başvurdunuz, yanıt bekliyorsunuz. Yanıt geldiğinde aşağıdaki düğmelerle taşıyın." },
  { status: "interview", label: "Görüşmeler", hint: "Görüşmeye çağrıldığınız başvurular." },
  { status: "offer", label: "Teklifler", hint: "Teklif aldığınız başvurular." },
  { status: "rejected", label: "Reddedilenler", hint: "Red yanıtı gelen başvurular." },
  { status: "withdrawn", label: "Geri çekilenler", hint: "Sizin geri çektiğiniz başvurular." },
];

function sortKey(job: StoredJobPosting): string {
  const application = job.application;
  return application?.decidedAt ?? application?.appliedAt ?? job.firstSeenAt;
}

export default async function ApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const active: ApplicationStatus = isApplicationStatus(raw) ? raw : "applied";

  let jobs: StoredJobPosting[] = [];
  let cvs: StoredCv[] = [];
  let loadError = false;
  try {
    [jobs, cvs] = await Promise.all([listJobPostings(user.id), listCvs(user.id)]);
  } catch {
    loadError = true;
  }

  const counts = new Map<ApplicationStatus, number>();
  for (const job of jobs) {
    const status = job.application?.status;
    if (status) counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const rows = jobs
    .filter((job) => job.application?.status === active)
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  const tab = TABS.find((entry) => entry.status === active) ?? TABS[0]!;

  return (
    <main className="container">
      <Nav title="Başvurular" email={user.email} current="/applications" />

      <section className="card">
        <div className="filters">
          <div className="group">
            {TABS.map((entry) => (
              <Link
                key={entry.status}
                href={entry.status === "applied" ? "/applications" : `/applications?status=${entry.status}`}
                className={entry.status === active ? "chip active" : "chip"}
              >
                {entry.label} ({counts.get(entry.status) ?? 0})
              </Link>
            ))}
          </div>
        </div>
        <p className="status muted">{tab.hint}</p>

        {loadError ? (
          <p className="message error" role="alert">
            Başvurular yüklenemedi. Sayfayı yenileyin; sorun sürerse Firebase bağlantısını kontrol edin.
          </p>
        ) : rows.length === 0 ? (
          <div className="empty">
            <strong>
              {active === "applied"
                ? "Aktif başvuru yok."
                : `${APPLICATION_LABELS[active]} durumunda başvuru yok.`}
            </strong>
            <span className="muted">
              {active === "applied"
                ? "İlanlar sayfasında bir ilanın altındaki \"Başvurdum\" düğmesine bastığınızda başvuru buraya düşer."
                : "Aktif sekmesindeki başvuruları yanıt geldikçe buraya taşıyabilirsiniz."}
            </span>
          </div>
        ) : (
          <ul className="job-list">
            {rows.map((job) => (
              <ApplicationRow key={job.id} job={job} cvs={cvs} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
