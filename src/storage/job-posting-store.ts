import type { DiscoveryRunReport, JobPosting, StoredDiscoveryRun, StoredJobPosting, StoredJobPostingInput } from "../domain.ts";
import {
  DISCOVERY_RUNS_COLLECTION,
  JOB_POSTINGS_COLLECTION,
  USERS_COLLECTION,
  buildDiscoveryRunDocument,
  discoveryRunDocumentId,
  isJobPostingDocumentId,
  jobPostingDocumentId,
  parseDiscoveryRunDocument,
  parseJobPostingDocument,
  planJobPostingUpsert,
  type DocumentData,
} from "./job-posting-documents.ts";
import type { JobRepository, UpsertOutcome } from "./repository.ts";

// firebase-admin'in Firestore nesnesiyle yapısal olarak uyumlu, asgari depo arayüzü.
// Modül firebase-admin'i içe aktarmaz; CLI ve web kendi Firestore örneklerini verir,
// testler bellek içi sahte depo kullanır.
export interface StoreDocumentSnapshot {
  readonly id: string;
  readonly exists: boolean;
  data(): DocumentData | undefined;
}

export interface StoreDocumentReference {
  readonly id: string;
  get(): Promise<StoreDocumentSnapshot>;
  delete(): Promise<unknown>;
}

export interface StoreQuerySnapshot {
  readonly docs: StoreDocumentSnapshot[];
}

export interface StoreQuery {
  orderBy(field: string, direction?: "asc" | "desc"): StoreQuery;
  limit(count: number): StoreQuery;
  get(): Promise<StoreQuerySnapshot>;
}

export interface StoreCollectionReference extends StoreQuery {
  doc(id: string): StoreDocumentReference;
}

export interface StoreTransaction {
  get(reference: StoreDocumentReference): Promise<StoreDocumentSnapshot>;
  set(reference: StoreDocumentReference, data: DocumentData): unknown;
  update(reference: StoreDocumentReference, data: DocumentData): unknown;
}

export interface JobPostingStore {
  collection(path: string): StoreCollectionReference;
  runTransaction<T>(updateFunction: (transaction: StoreTransaction) => Promise<T>): Promise<T>;
}

const MAX_LISTED = 500;

function jobPostingsPath(ownerId: string): string {
  return `${USERS_COLLECTION}/${ownerId}/${JOB_POSTINGS_COLLECTION}`;
}

function discoveryRunsPath(ownerId: string): string {
  return `${USERS_COLLECTION}/${ownerId}/${DISCOVERY_RUNS_COLLECTION}`;
}

// Sahiplik yol tabanlıdır; ownerId her zaman doğrulanmış kimlikten gelir, istekten alınmaz.
export async function upsertStoredJobPosting(
  store: JobPostingStore,
  ownerId: string,
  input: StoredJobPostingInput,
  now: () => Date = () => new Date(),
): Promise<UpsertOutcome> {
  const reference = store.collection(jobPostingsPath(ownerId)).doc(jobPostingDocumentId(input.source, input.sourceJobId));
  return store.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists ? (snapshot.data() ?? null) : null;
    const plan = planJobPostingUpsert(current, input, ownerId, now().toISOString());
    if (plan.outcome === "inserted") transaction.set(reference, plan.write);
    else if (plan.outcome === "updated") transaction.update(reference, plan.update);
    return plan.outcome;
  });
}

export async function listStoredJobPostings(store: JobPostingStore, ownerId: string): Promise<StoredJobPosting[]> {
  const snapshot = await store.collection(jobPostingsPath(ownerId)).orderBy("firstSeenAt", "desc").limit(MAX_LISTED).get();
  const postings: StoredJobPosting[] = [];
  for (const doc of snapshot.docs) {
    const posting = parseJobPostingDocument(doc.id, doc.data() ?? {});
    if (posting) postings.push(posting);
  }
  return postings;
}

export async function deleteStoredJobPosting(store: JobPostingStore, ownerId: string, id: string): Promise<boolean> {
  if (!isJobPostingDocumentId(id)) return false;
  await store.collection(jobPostingsPath(ownerId)).doc(id).delete();
  return true;
}

export async function saveDiscoveryRun(store: JobPostingStore, ownerId: string, report: DiscoveryRunReport): Promise<string> {
  const id = discoveryRunDocumentId(report);
  const reference = store.collection(discoveryRunsPath(ownerId)).doc(id);
  await store.runTransaction(async (transaction) => {
    transaction.set(reference, buildDiscoveryRunDocument(report, ownerId));
  });
  return id;
}

export async function latestDiscoveryRun(store: JobPostingStore, ownerId: string): Promise<StoredDiscoveryRun | null> {
  const snapshot = await store.collection(discoveryRunsPath(ownerId)).orderBy("startedAt", "desc").limit(1).get();
  const doc = snapshot.docs[0];
  return doc ? parseDiscoveryRunDocument(doc.id, doc.data() ?? {}) : null;
}

// Gmail keşif koşusunun JobRepository adaptörü: ilanlar "gmail" edinilme yöntemiyle yazılır.
export class FirestoreJobRepository implements JobRepository {
  public constructor(
    private readonly store: JobPostingStore,
    private readonly ownerId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async upsert(posting: JobPosting): Promise<UpsertOutcome> {
    return upsertStoredJobPosting(
      this.store,
      this.ownerId,
      {
        source: posting.source,
        sourceJobId: posting.sourceJobId,
        url: posting.url,
        title: posting.title,
        company: null,
        location: null,
        description: null,
        firstSeenAt: posting.firstSeenAt,
        acquisitionMethod: "gmail",
        sourceEmailId: posting.sourceEmailId,
      },
      this.now,
    );
  }

  // Yalnızca Gmail kaynaklı (e-posta kimliği olan) kayıtlar JobPosting sözleşmesine dönebilir.
  public async list(): Promise<JobPosting[]> {
    const rows = await listStoredJobPostings(this.store, this.ownerId);
    const postings: JobPosting[] = [];
    for (const row of rows) {
      if (row.sourceEmailId === null) continue;
      postings.push({
        source: row.source,
        sourceJobId: row.sourceJobId,
        url: row.url,
        title: row.title,
        titleStatus: row.titleStatus,
        descriptionStatus: "missing",
        firstSeenAt: row.firstSeenAt,
        sourceEmailId: row.sourceEmailId,
      });
    }
    return postings;
  }
}
