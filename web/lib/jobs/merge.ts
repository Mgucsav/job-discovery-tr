import type { AcquisitionMethod } from "./types";

// Birleştirme kuralı JsonFileJobRepository.upsert ile aynıdır (saf fonksiyon, Firestore'dan bağımsız):
//   * daha eski görülme -> ilk görülme bilgisi ve onu sağlayan edinilme kaynağı geriye çekilir
//   * eksik başlık/şirket/konum/açıklama sonradan tamamlanır; mevcut değer asla ezilmez
//   * değişiklik yoksa 'unchanged'
export interface MergeableJobPosting {
  firstSeenAt: string;
  acquisitionMethod: AcquisitionMethod;
  sourceEmailId: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
}

export type MergeChanges = Partial<MergeableJobPosting>;

const FILLABLE_FIELDS = ["title", "company", "location", "description"] as const;

export function mergeJobPosting(
  current: MergeableJobPosting,
  incoming: MergeableJobPosting,
): { outcome: "updated" | "unchanged"; changes: MergeChanges } {
  const changes: MergeChanges = {};
  if (incoming.firstSeenAt < current.firstSeenAt) {
    changes.firstSeenAt = incoming.firstSeenAt;
    changes.acquisitionMethod = incoming.acquisitionMethod;
    changes.sourceEmailId = incoming.sourceEmailId;
  }
  for (const field of FILLABLE_FIELDS) {
    if (current[field] === null && incoming[field] !== null) changes[field] = incoming[field];
  }
  return Object.keys(changes).length > 0 ? { outcome: "updated", changes } : { outcome: "unchanged", changes };
}
