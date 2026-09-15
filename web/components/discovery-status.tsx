import type { StoredDiscoveryRun } from "@/lib/core";
import { SOURCE_LABELS } from "@/lib/jobs/types";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

// Son Gmail keşif koşusunun özeti. Hiç koşu yoksa keşfin bağlı olmadığı açıkça söylenir.
export function DiscoveryStatus({ run }: { run: StoredDiscoveryRun | null }) {
  if (!run) {
    return (
      <p className="status muted">
        Gmail keşfi henüz çalıştırılmadı; ilanlar yalnızca elle ekleniyor. Keşif için bilgisayarınızda{" "}
        <code>npm run discover</code> komutu çalıştırılır.
      </p>
    );
  }

  const hasError =
    run.gmailStatus === "error" || run.repositoryErrors > 0 || Object.values(run.sources).some((source) => source.status === "error");
  const perSource = (Object.keys(run.sources) as Array<keyof typeof run.sources>)
    .map((source) => `${SOURCE_LABELS[source]} ${run.sources[source].newJobs} yeni / ${run.sources[source].duplicateJobs} tekrar`)
    .join(" · ");

  return (
    <p className={hasError ? "status error-text" : "status muted"}>
      Son Gmail keşfi: {dateFormatter.format(new Date(run.startedAt))} · okunan e-posta {run.emailsRead} · yeni ilan{" "}
      {run.newJobsTotal} · tekrar {run.duplicateJobsTotal} · çözümlenemeyen {run.unresolvedEmails}
      {hasError ? " · HATA: Gmail veya depo hatası oluştu; koşu çıktısını kontrol edin." : ""}
      <br />
      <span className="muted-small">{perSource}</span>
    </p>
  );
}
