import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { getVerifiedUser } from "@/lib/auth/next";
import {
  PERIOD_OPTIONS,
  comparePeriods,
  delta,
  isPeriodDays,
  weeklyTrend,
  type PeriodDays,
  type PeriodMetrics,
  type StoredJobPosting,
} from "@/lib/core";
import { listJobPostings } from "@/lib/jobs/repository";

// Kişisel sayfa: her istekte sunucuda doğrulanır, statik çıktı üretilmez.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" });

function percent(value: number | null): string {
  return value === null ? "—" : `%${Math.round(value * 100)}`;
}

function formatDelta(current: number, previous: number): string {
  const { absolute, ratio } = delta(current, previous);
  if (absolute === 0) return "değişim yok";
  const sign = absolute > 0 ? "+" : "";
  return ratio === null ? `${sign}${absolute}` : `${sign}${absolute} (${sign}${Math.round(ratio * 100)}%)`;
}

function deltaClass(current: number, previous: number, higherIsBetter = true): string {
  if (current === previous) return "muted-small";
  const better = higherIsBetter ? current > previous : current < previous;
  return better ? "delta up" : "delta down";
}

const ROWS: Array<{ key: keyof PeriodMetrics; label: string; hint: string; higherIsBetter: boolean }> = [
  { key: "discovered", label: "Açılan ilan", hint: "Bu dönemde ilk kez görülen ilan sayısı", higherIsBetter: true },
  { key: "applied", label: "Başvuru", hint: "Bu dönemde başvurduğunuz ilan sayısı", higherIsBetter: true },
  { key: "positive", label: "Olumlu dönüş", hint: "Görüşme veya teklif ile sonuçlananlar", higherIsBetter: true },
  { key: "interview", label: "· Görüşme", hint: "Görüşmeye çağrıldığınız başvurular", higherIsBetter: true },
  { key: "offer", label: "· Teklif", hint: "Teklif aldığınız başvurular", higherIsBetter: true },
  { key: "rejected", label: "Red", hint: "Red yanıtı gelen başvurular", higherIsBetter: false },
];

const RATE_ROWS: Array<{ key: "applyRate" | "responseRate" | "positiveRate"; label: string; hint: string }> = [
  { key: "applyRate", label: "Başvuru oranı", hint: "Başvuru / açılan ilan" },
  { key: "responseRate", label: "Yanıt oranı", hint: "Yanıtlanan / başvuru" },
  { key: "positiveRate", label: "Olumlu oran", hint: "Olumlu / yanıtlanan" },
];

export default async function TrendsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const rawPeriod = Array.isArray(params.period) ? params.period[0] : params.period;
  const windowDays: PeriodDays = isPeriodDays(rawPeriod) ? (Number(rawPeriod) as PeriodDays) : 30;

  let jobs: StoredJobPosting[] = [];
  let loadError = false;
  try {
    jobs = await listJobPostings(user.id);
  } catch {
    loadError = true;
  }

  const comparison = comparePeriods(jobs, windowDays);
  const weeks = weeklyTrend(jobs, 8);
  const hasData = jobs.length > 0;

  return (
    <main className="container">
      <Nav title="Dönemsel takip" email={user.email} current="/trends" />

      <section className="card">
        <div className="filters">
          <div className="group">
            <span className="group-label">Dönem:</span>
            {PERIOD_OPTIONS.map((option) => (
              <Link
                key={option}
                href={option === 30 ? "/trends" : `/trends?period=${option}`}
                className={option === windowDays ? "chip active" : "chip"}
              >
                Son {option} gün
              </Link>
            ))}
          </div>
        </div>
        <p className="status muted">
          {dateFormatter.format(new Date(comparison.current.startAt))} – {dateFormatter.format(new Date(comparison.current.endAt))} dönemi,
          bir önceki {windowDays} günlük dönemle ({dateFormatter.format(new Date(comparison.previous.startAt))} –{" "}
          {dateFormatter.format(new Date(comparison.previous.endAt))}) karşılaştırılır. Sonuç tarihleri başvurunun{" "}
          <strong>en son</strong> durumuna aittir; görüşmeden sonra gelen red yalnızca red olarak sayılır.
        </p>

        {loadError ? (
          <p className="message error" role="alert">
            Veriler yüklenemedi. Sayfayı yenileyin; sorun sürerse Firebase bağlantısını kontrol edin.
          </p>
        ) : !hasData ? (
          <div className="empty">
            <strong>Henüz veri yok.</strong>
            <span className="muted">İlanlar düştükçe ve başvuru işaretledikçe bu sayfa dolar.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th scope="col">Ölçüt</th>
                  <th scope="col">Bu dönem</th>
                  <th scope="col">Önceki dönem</th>
                  <th scope="col">Fark</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const current = comparison.current.metrics[row.key] as number;
                  const previous = comparison.previous.metrics[row.key] as number;
                  return (
                    <tr key={row.key}>
                      <th scope="row" title={row.hint}>
                        {row.label}
                      </th>
                      <td>{current}</td>
                      <td>{previous}</td>
                      <td className={deltaClass(current, previous, row.higherIsBetter)}>{formatDelta(current, previous)}</td>
                    </tr>
                  );
                })}
                {RATE_ROWS.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" title={row.hint}>
                      {row.label}
                    </th>
                    <td>{percent(comparison.current.metrics[row.key])}</td>
                    <td>{percent(comparison.previous.metrics[row.key])}</td>
                    <td className="muted-small">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {hasData && !loadError ? (
        <section className="card">
          <h2>Haftalık akış</h2>
          <p className="muted">Son 8 hafta; her satır 7 günlük dilimdir.</p>
          <div className="table-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th scope="col">Hafta</th>
                  <th scope="col">Açılan ilan</th>
                  <th scope="col">Başvuru</th>
                  <th scope="col">Görüşme</th>
                  <th scope="col">Teklif</th>
                  <th scope="col">Red</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week.startAt}>
                    <th scope="row" title={`${dateFormatter.format(new Date(week.startAt))} – ${dateFormatter.format(new Date(week.endAt))}`}>
                      {week.label}
                    </th>
                    <td>{week.metrics.discovered}</td>
                    <td>{week.metrics.applied}</td>
                    <td>{week.metrics.interview}</td>
                    <td>{week.metrics.offer}</td>
                    <td>{week.metrics.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
