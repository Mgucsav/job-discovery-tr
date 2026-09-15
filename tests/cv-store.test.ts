import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  CV_CHUNK_SIZE,
  CV_MAX_BYTES,
  CV_MAX_COUNT,
  deleteCv,
  getCv,
  listCvs,
  readCvBytes,
  setDefaultCv,
  uploadCv,
  validateCvUpload,
} from "../src/storage/cv-store.ts";
import { MemoryStore } from "./helpers/memory-store.ts";

const OWNER = "owner-uid";

function fakePdf(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  const header = Buffer.from("%PDF-1.4\n");
  bytes.set(header, 0);
  for (let i = header.length; i < size; i += 1) bytes[i] = (i * 31) % 251;
  return bytes;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

test("CV doğrulama: uzantı + sihirli bayt, boyut ve ad sınırları", () => {
  assert.equal(validateCvUpload({ name: "  ", fileName: "cv.pdf", bytes: fakePdf(100) }).ok, false);
  assert.equal(validateCvUpload({ name: "CV", fileName: "cv.exe", bytes: fakePdf(100) }).ok, false);
  assert.equal(validateCvUpload({ name: "CV", fileName: "cv.pdf", bytes: new Uint8Array([1, 2, 3]) }).ok, false);
  assert.equal(validateCvUpload({ name: "CV", fileName: "cv.pdf", bytes: fakePdf(CV_MAX_BYTES + 1) }).ok, false);
  assert.equal(validateCvUpload({ name: "CV", fileName: "cv.docx", bytes: fakePdf(100) }).ok, false);

  const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
  const ok = validateCvUpload({ name: " Veri   Analisti CV ", fileName: "C:\\Users\\x\\Belgeler\\benim:cv?.docx", bytes: docx });
  assert.ok(ok.ok);
  assert.equal(ok.kind, "docx");
  assert.equal(ok.name, "Veri Analisti CV");
  assert.equal(ok.fileName, "benimcv.docx");
});

test("CV parçalara bölünerek yazılır, sha256 ile doğrulanarak geri okunur; ilk CV varsayılan olur", async () => {
  const store = new MemoryStore();
  const bytes = fakePdf(CV_CHUNK_SIZE * 2 + 1234);
  const result = await uploadCv(store, OWNER, { name: "Ana CV", fileName: "ana-cv.pdf", bytes }, () => new Date("2026-09-15T10:00:00.000Z"), nextId);
  assert.ok(result.ok);
  assert.equal(result.cv.chunkCount, 3);
  assert.equal(result.cv.size, bytes.byteLength);
  assert.equal(result.cv.sha256, sha256(bytes));
  assert.equal(result.cv.isDefault, true);
  assert.equal(result.cv.contentType, "application/pdf");

  const chunkKeys = [...store.documents.keys()].filter((key) => key.includes("/chunks/"));
  assert.equal(chunkKeys.length, 3);
  assert.ok(chunkKeys.every((key) => key.startsWith(`users/${OWNER}/cvs/${result.cv.id}/chunks/`)));

  const stored = await getCv(store, OWNER, result.cv.id);
  assert.equal(stored?.name, "Ana CV");
  const restored = await readCvBytes(store, OWNER, stored!);
  assert.ok(restored);
  assert.equal(Buffer.compare(restored, Buffer.from(bytes)), 0);

  // Bozulmuş parça bütünlük kontrolüne takılır.
  store.documents.set(`users/${OWNER}/cvs/${result.cv.id}/chunks/1`, { index: 1, data: Buffer.from("bozuk") });
  assert.equal(await readCvBytes(store, OWNER, stored!), null);
});

test("varsayılan CV değiştirilebilir; silinince kalanlardan biri varsayılan olur; sınır uygulanır", async () => {
  const store = new MemoryStore();
  let tick = 0;
  const clock = () => new Date(Date.UTC(2026, 8, 15, 10, tick++));
  const first = await uploadCv(store, OWNER, { name: "Birinci", fileName: "1.pdf", bytes: fakePdf(50) }, clock, nextId);
  const second = await uploadCv(store, OWNER, { name: "İkinci", fileName: "2.pdf", bytes: fakePdf(60) }, clock, nextId);
  assert.ok(first.ok && second.ok);
  assert.equal(second.cv.isDefault, false);

  assert.equal(await setDefaultCv(store, OWNER, second.cv.id), true);
  let cvs = await listCvs(store, OWNER);
  assert.deepEqual(cvs.map((cv) => [cv.name, cv.isDefault]), [["İkinci", true], ["Birinci", false]]);

  assert.equal(await setDefaultCv(store, OWNER, "00000000-0000-4000-8000-ffffffffffff"), false);
  assert.equal(await deleteCv(store, OWNER, "not-an-id"), false);

  assert.equal(await deleteCv(store, OWNER, second.cv.id), true);
  cvs = await listCvs(store, OWNER);
  assert.deepEqual(cvs.map((cv) => [cv.name, cv.isDefault]), [["Birinci", true]]);
  assert.equal([...store.documents.keys()].filter((key) => key.includes(second.cv.id)).length, 0);

  for (let i = cvs.length; i < CV_MAX_COUNT; i += 1) {
    const r = await uploadCv(store, OWNER, { name: `CV ${i}`, fileName: `${i}.pdf`, bytes: fakePdf(40) }, clock, nextId);
    assert.ok(r.ok);
  }
  const overflow = await uploadCv(store, OWNER, { name: "Fazla", fileName: "x.pdf", bytes: fakePdf(40) }, clock, nextId);
  assert.equal(overflow.ok, false);

  // Başka kullanıcının yolu ayrıdır.
  assert.equal((await listCvs(store, "someone-else")).length, 0);
});
