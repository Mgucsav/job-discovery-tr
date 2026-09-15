import type { DocumentData } from "../../src/storage/job-posting-documents.ts";
import type {
  JobPostingStore,
  StoreCollectionReference,
  StoreDocumentReference,
  StoreDocumentSnapshot,
  StoreQuery,
  StoreTransaction,
} from "../../src/storage/job-posting-store.ts";

// Bellek içi sahte depo: JobPostingStore arayüzünün Firestore ile aynı davranan asgari hali.
// Belgeler tam yol ("users/uid/jobPostings/id") ile tutulur; koleksiyon sorgusu yalnızca doğrudan
// çocukları döndürür (alt koleksiyon belgeleri hariç).
export class MemoryStore implements JobPostingStore {
  public readonly documents = new Map<string, DocumentData>();

  private snapshot(id: string, data: DocumentData | undefined): StoreDocumentSnapshot {
    return { id, exists: data !== undefined, data: () => (data ? { ...data } : undefined) };
  }

  public collection(path: string): StoreCollectionReference {
    const documents = this.documents;
    const prefix = `${path}/`;
    const makeQuery = (order: { field: string; direction: "asc" | "desc" } | null, limit: number | null): StoreQuery => ({
      orderBy: (field, direction = "asc") => makeQuery({ field, direction }, limit),
      limit: (count) => makeQuery(order, count),
      get: async () => {
        let docs = [...documents.entries()]
          .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
          .map(([key, data]) => this.snapshot(key.slice(prefix.length), data));
        if (order) {
          docs.sort((a, b) => {
            const left = String(a.data()?.[order.field] ?? "");
            const right = String(b.data()?.[order.field] ?? "");
            return order.direction === "asc" ? left.localeCompare(right) : right.localeCompare(left);
          });
        }
        if (limit !== null) docs = docs.slice(0, limit);
        return { docs };
      },
    });
    return {
      ...makeQuery(null, null),
      doc: (id: string): StoreDocumentReference & { key: string } => ({
        id,
        key: `${prefix}${id}`,
        get: async () => this.snapshot(id, documents.get(`${prefix}${id}`)),
        delete: async () => {
          documents.delete(`${prefix}${id}`);
        },
      }),
    };
  }

  public async runTransaction<T>(updateFunction: (transaction: StoreTransaction) => Promise<T>): Promise<T> {
    const documents = this.documents;
    const keyOf = (reference: StoreDocumentReference): string => (reference as unknown as { key: string }).key;
    const transaction: StoreTransaction = {
      get: async (reference) => this.snapshot(reference.id, documents.get(keyOf(reference))),
      set: (reference, data) => documents.set(keyOf(reference), { ...data }),
      update: (reference, data) => {
        const current = documents.get(keyOf(reference));
        if (!current) throw new Error("update on missing document");
        documents.set(keyOf(reference), { ...current, ...data });
      },
    };
    return updateFunction(transaction);
  }
}
