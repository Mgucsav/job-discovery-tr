import "server-only";
import {
  FieldValue,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";
import { JOB_SOURCES, type JobSource } from "@/lib/core";
import { mergeJobPosting, type MergeChanges, type MergeableJobPosting } from "./merge";
import type { JobPostingInput, StoredJobPosting, UpsertOutcome } from "./types";

// Firestore yerleşimi: users/{uid}/jobPostings/{source__sourceJobId}
// Belge kimliği tekillik anahtarıdır (sahip + kaynak + kaynak ilan ID'si).
// Sahiplik yol tabanlıdır; uid her zaman doğrulanmış oturumdan gelir, istekten alınmaz.

const MAX_LISTED = 500;
const DOC_ID_PATTERN = /^(linkedin|kariyer|indeed)__[a-z0-9]{1,64}$/;

export function jobPostingDocumentId(source: JobSource, sourceJobId: string): string {
  return `${source}__${sourceJobId}`;
}

export function isJobPostingDocumentId(value: string): boolean {
  return DOC_ID_PATTERN.test(value);
}

export function userJobPostings(db: Firestore, uid: string): CollectionReference {
  return db.collection("users").doc(uid).collection("jobPostings");
}

function isoFromTimestamp(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Bozuk/eksik belgeler görünüm modeline alınmaz; alanlar uydurulmaz.
export function toStoredJobPosting(id: string, data: DocumentData): StoredJobPosting | null {
  const source = JOB_SOURCES.find((candidate) => candidate === data.source);
  const sourceJobId = nullableString(data.sourceJobId);
  const url = nullableString(data.url);
  const firstSeenAt = isoFromTimestamp(data.firstSeenAt);
  const acquisitionMethod = data.acquisitionMethod === "gmail" ? "gmail" : data.acquisitionMethod === "manual" ? "manual" : null;
  if (!source || !sourceJobId || !url || !firstSeenAt || !acquisitionMethod) return null;

  const title = nullableString(data.title);
  const description = nullableString(data.description);
  return {
    id,
    source,
    sourceJobId,
    url,
    title,
    titleStatus: title === null ? "missing" : "present",
    company: nullableString(data.company),
    location: nullableString(data.location),
    description,
    descriptionStatus: description === null ? "missing" : "present",
    firstSeenAt,
    acquisitionMethod,
    sourceEmailId: nullableString(data.sourceEmailId),
  };
}

function toMergeable(data: DocumentData): MergeableJobPosting {
  return {
    firstSeenAt: isoFromTimestamp(data.firstSeenAt) ?? new Date(0).toISOString(),
    acquisitionMethod: data.acquisitionMethod === "gmail" ? "gmail" : "manual",
    sourceEmailId: nullableString(data.sourceEmailId),
    title: nullableString(data.title),
    company: nullableString(data.company),
    location: nullableString(data.location),
    description: nullableString(data.description),
  };
}

function changesToUpdate(changes: MergeChanges): DocumentData {
  const update: DocumentData = {};
  for (const [key, value] of Object.entries(changes)) {
    update[key] = key === "firstSeenAt" && typeof value === "string" ? Timestamp.fromDate(new Date(value)) : value;
  }
  return update;
}

export async function upsertJobPosting(db: Firestore, uid: string, input: JobPostingInput): Promise<UpsertOutcome> {
  const ref = userJobPostings(db, uid).doc(jobPostingDocumentId(input.source, input.sourceJobId));
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    if (!snapshot.exists || !data) {
      transaction.set(ref, {
        ownerId: uid,
        source: input.source,
        sourceJobId: input.sourceJobId,
        url: input.url,
        title: input.title,
        company: input.company,
        location: input.location,
        description: input.description,
        firstSeenAt: Timestamp.fromDate(new Date(input.firstSeenAt)),
        acquisitionMethod: input.acquisitionMethod,
        sourceEmailId: input.sourceEmailId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return "inserted";
    }

    const { outcome, changes } = mergeJobPosting(toMergeable(data), input);
    if (outcome === "unchanged") return "unchanged";
    transaction.update(ref, { ...changesToUpdate(changes), updatedAt: FieldValue.serverTimestamp() });
    return "updated";
  });
}

export async function listJobPostings(db: Firestore, uid: string): Promise<StoredJobPosting[]> {
  const snapshot = await userJobPostings(db, uid).orderBy("firstSeenAt", "desc").limit(MAX_LISTED).get();
  const postings: StoredJobPosting[] = [];
  for (const doc of snapshot.docs) {
    const posting = toStoredJobPosting(doc.id, doc.data());
    if (posting) postings.push(posting);
  }
  return postings;
}

export async function deleteJobPosting(db: Firestore, uid: string, id: string): Promise<boolean> {
  if (!isJobPostingDocumentId(id)) return false;
  await userJobPostings(db, uid).doc(id).delete();
  return true;
}
