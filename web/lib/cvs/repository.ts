import "server-only";
import { Buffer } from "node:buffer";
import {
  deleteCv as deleteStoredCv,
  getCv as getStoredCv,
  listCvs as listStoredCvs,
  readCvBytes,
  setDefaultCv as setStoredDefaultCv,
  uploadCv as uploadStoredCv,
  type StoredCv,
} from "@/lib/core";
import { getAdminFirestore } from "@/lib/firebase/admin";

// CV erişimi: parçalama, bütünlük ve varsayılan mantığı depo kökündeki src/storage/cv-store.ts içindedir.
// uid her zaman doğrulanmış oturumdan gelir; dosya içeriği loglanmaz.

export type CvUploadOutcome = { ok: true; cv: StoredCv } | { ok: false; error: string };

export async function listCvs(uid: string): Promise<StoredCv[]> {
  return listStoredCvs(getAdminFirestore(), uid);
}

export async function uploadCv(uid: string, name: string, file: File): Promise<CvUploadOutcome> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return uploadStoredCv(getAdminFirestore(), uid, { name, fileName: file.name, bytes });
}

export async function getCvFile(uid: string, cvId: string): Promise<{ cv: StoredCv; bytes: Buffer } | null> {
  const store = getAdminFirestore();
  const cv = await getStoredCv(store, uid, cvId);
  if (!cv) return null;
  const bytes = await readCvBytes(store, uid, cv);
  return bytes ? { cv, bytes } : null;
}

export async function setDefaultCv(uid: string, cvId: string): Promise<boolean> {
  return setStoredDefaultCv(getAdminFirestore(), uid, cvId);
}

export async function deleteCv(uid: string, cvId: string): Promise<boolean> {
  return deleteStoredCv(getAdminFirestore(), uid, cvId);
}

// RFC 5987 uyumlu indirme başlığı; Türkçe karakterli dosya adları için.
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
