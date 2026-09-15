import Link from "next/link";
import { ACQUISITION_METHODS, JOB_SOURCES } from "@/lib/core";
import { buildJobListHref, type JobListQuery } from "@/lib/jobs/query";
import { ACQUISITION_LABELS, SOURCE_LABELS } from "@/lib/jobs/types";

function chipClass(active: boolean): string {
  return active ? "chip active" : "chip";
}

export function SourceFilter({ query }: { query: JobListQuery }) {
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
