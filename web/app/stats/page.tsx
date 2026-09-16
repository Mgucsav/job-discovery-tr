import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getVerifiedUser } from "@/lib/auth/next";
import {
  applicationTotals,
  summarizeByCv,
  summarizeByExperience,
  summarizeBySource,
  type ApplicationBucket,
  type StoredJobPosting,
} from "@/lib/core";
import { listJobPostings } from "@/lib/jobs/repository";

// Kişisel sayfa: her istekte sunucuda doğrulanır, statik çıktı üretilmez.
export const dynamic = "force-dynamic";

function percent(value: number | null): string {
  return value === null ? "—" : `%${Math.round(value * 100)}`;
}

function BucketTable({ title, hint, buckets }: { title: string; hint: string; buckets: ApplicationBucket[] }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted">{hint}</p>
      {buckets.length === 0 ? (
        <div className="empty">
          <strong>Bu kırılımda henüz başvuru kaydı yok.</strong>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr>
                <th scope="col">{title.includes("CV") ? "CV" : "Grup"}</th>
                <th scope="col">Başvuru</th>
                <th scope="col">Yanıt bekleyen</th>
                <th scope="col">Görüşme</th>
                <th scope="col">Teklif</th>
                <th scope="col">Red</th>
                <th scope="col">Geri çekilen</th>
                <th scope="col">Yanıt oranı</th>
                <th scope="col">Olumlu oran</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket) => (
                <tr key={bucket.key}>
                  <th scope="row">{bucket.label}</th>
                  <td>{bucket.total}</td>
                  <td>{bucket.pending}</td>
                  <td>{bucket.interview}</td>
                  <td>{bucket.offer}</td>
                  <td>{bucket.rejected}</td>
                  <td>{bucket.withdrawn}</td>
                  <td>{percent(bucket.responseRate)}</td>
                  <td>{percent(bucket.positiveRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function StatsPage() {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  let jobs: StoredJobPosting[] = [];
  let loadError = false;
  try {
    jobs = await listJobPostings(user.id);
  } catch {
    loadError = true;
  }
  const totals = applicationTotals(jobs);

  return (
    <main className="container">
      <div className="topbar">
        <div>
          <h1>Başvuru istatistikleri</h1>
          <div className="who">{user.email ?? "Oturum açık"}</div>
        </div>
        <div className="actions">
          <Link href="/" className="button">
            İlanlar
          </Link>
          <Link href="/cvs" className="button">
            CV&apos;lerim
          </Link>
          <SignOutButton />
        </div>
      </div>

      {loadError ? (
        <p className="message error" role="alert">
          İstatistikler yüklenemedi. Sayfayı yenileyin; sorun sürerse Firebase bağlantısını kontrol edin.
        </p>
      ) : totals.applications === 0 ? (
        <div className="card">
          <div className="empty">
            <strong>Henüz başvuru kaydı yok.</strong>
            <span className="muted">
              İlanlar sayfasında her ilanın altındaki formdan durumu (&quot;Başvurdum&quot;, &quot;Reddedildi&quot; …) ve
              kullandığınız CV&apos;yi seçtikçe bu sayfa dolar. Oranlar yalnızca kaydettiğiniz başvurulardan hesaplanır.
            </span>
          </div>
        </div>
      ) : (
        <>
          <section className="card">
            <h2>Özet</h2>
            <p className="status muted">
              Toplam başvuru {totals.applications} · yanıt bekleyen {totals.pending} · yanıtlanan {totals.decided} · olumlu{" "}
              {totals.positive} · red {totals.rejected}
            </p>
          </section>
          <BucketTable
            title="CV performansı"
            hint="Hangi CV ile kaç başvuru yapıldı ve ne kadarı yanıtlandı. CV silinse bile kayıttaki ad korunur."
            buckets={summarizeByCv(jobs)}
          />
          <BucketTable
            title="Deneyim düzeyine göre (tahmin)"
            hint="Düzey ilan e-postasında yer almaz; başlıktan çıkarılır. Hangi seviyedeki ilanların dönüş verdiğini gösterir."
            buckets={summarizeByExperience(jobs)}
          />
          <BucketTable
            title="Kaynağa göre"
            hint="İlanın geldiği site. Hangi kaynaktan gelen başvuruların daha çok yanıtlandığını gösterir."
            buckets={summarizeBySource(jobs)}
          />
        </>
      )}
    </main>
  );
}
