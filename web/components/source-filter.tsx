import Link from "next/link";
import { ACQUISITION_METHODS, EXPERIENCE_LABELS, JOB_SOURCES } from "@/lib/core";
import { buildJobListHref, type JobListQuery, type LevelFilter } from "@/lib/jobs/query";
import { ACQUISITION_LABELS, SOURCE_LABELS } from "@/lib/jobs/types";

function chipClass(active: boolean): string {
  return active ? "chip active" : "chip";
}

function levelLabel(level: LevelFilter): string {
  return level === "unknown" ? "Belirtilmemiş" : EXPERIENCE_LABELS[level];
}

export function SourceFilter({ query, levels }: { query: JobListQuery; levels: LevelFilter[] }) {
  return (
    <div className="filters">
      <div className="group">
        <span className="group-label">Kaynak:</span>
        <Link href={buildJobListHref({ ...query, source: null })} className={chipClass(query.source === null)}>
          Tümü
        </Link>
        {JOB_SOURCES.map((source) => (
          <Link key={source} href={buildJobListHref({ ...query, source })} className={chipClass(query.source === source)}>
            {SOURCE_LABELS[source]}
          </Link>
        ))}
      </div>
      {levels.length > 0 ? (
        <div className="group">
          <span className="group-label" title="Deneyim düzeyi ilan e-postasında yer almaz; başlıktan tahmin edilir.">
            Deneyim (tahmin):
          </span>
          <Link href={buildJobListHref({ ...query, level: null })} className={chipClass(query.level === null)}>
            Tümü
          </Link>
          {levels.map((level) => (
            <Link key={level} href={buildJobListHref({ ...query, level })} className={chipClass(query.level === level)}>
              {levelLabel(level)}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="group">
        <span className="group-label">Edinilme:</span>
        <Link href={buildJobListHref({ ...query, method: null })} className={chipClass(query.method === null)}>
          Tümü
        </Link>
        {ACQUISITION_METHODS.map((method) => (
          <Link key={method} href={buildJobListHref({ ...query, method })} className={chipClass(query.method === method)}>
            {ACQUISITION_LABELS[method]}
          </Link>
        ))}
      </div>
      <div className="group">
        <span className="group-label">Sıralama:</span>
        <Link href={buildJobListHref({ ...query, sort: "newest" })} className={chipClass(query.sort === "newest")}>
          Önce yeni
        </Link>
        <Link href={buildJobListHref({ ...query, sort: "oldest" })} className={chipClass(query.sort === "oldest")}>
          Önce eski
        </Link>
      </div>
    </div>
  );
}
