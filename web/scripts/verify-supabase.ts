// Gerçek Supabase projesine karşı uçtan uca doğrulama.
// Kullanıcı e-posta ve şifresini KENDİ terminalinde girer; şifre ekranda gösterilmez,
// dosyaya yazılmaz ve çıktıda yer almaz. Yalnızca sonuç özeti basılır.
//
// Kontroller:
//  1. Anonim (publishable key) okuma ve yazma reddediliyor mu?
//  2. Oturum açan kullanıcı TEST kaydı ekleyebiliyor mu; yeniden okunduğunda duruyor mu?
//  3. TEST kaydı siliniyor mu?
//  4. Oturum kapatılınca aynı istemci ilanları göremiyor mu?
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Writable } from "node:stream";
import type { Database } from "../lib/supabase/database.types";

const TEST_POSTING = {
  p_source: "linkedin" as const,
  p_source_job_id: "0000000000",
  p_url: "https://www.linkedin.com/jobs/view/0000000000",
  p_title: "TEST doğrulama kaydı (otomatik silinir)",
};

function makeClient(url: string, key: string): SupabaseClient<Database> {
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function promptVisible(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function promptHidden(question: string): Promise<string> {
  // Yazılanlar boş bir çıktıya yönlendirilir; böylece şifre ekranda görünmez.
  const sink = new Writable({ write: (_chunk, _encoding, callback) => callback() });
  const rl = createInterface({ input: stdin, output: sink, terminal: true });
  stdout.write(question);
  try {
    const answer = await rl.question("");
    stdout.write("\n");
    return answer;
  } finally {
    rl.close();
  }
}

interface ReadProbe {
  blocked: boolean;
  status: number;
  code: string | null;
}

async function probeRead(client: SupabaseClient<Database>): Promise<ReadProbe> {
  const { data, error, status } = await client.from("job_postings").select("id").limit(1);
  const blocked = Boolean(error) || (Array.isArray(data) && data.length === 0);
  return { blocked, status, code: error?.code ?? null };
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error("web/.env.local içinde NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY gerekli.");

  const summary: Record<string, unknown> = {};

  // 1) Anonim erişim
  const anonymous = makeClient(url, key);
  const anonRead = await probeRead(anonymous);
  summary.anonymousReadBlocked = anonRead.blocked;
  summary.anonymousReadStatus = anonRead.status;
  summary.anonymousReadErrorCode = anonRead.code;
  const anonInsert = await anonymous.rpc("upsert_job_posting", TEST_POSTING);
  summary.anonymousInsertBlocked = Boolean(anonInsert.error);
  summary.anonymousInsertErrorCode = anonInsert.error?.code ?? null;

  // 2) Oturum açma (kimlik bilgileri yalnızca Supabase Auth'a gider)
  const email = await promptVisible("Web uygulaması hesabının e-postası: ");
  const password = await promptHidden("Şifre (gizli): ");
  const session = makeClient(url, key);
  const signIn = await session.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.user) {
    summary.signIn = "failed";
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }
  summary.signIn = "ok";

  // Aynı anahtarla gerçek bir kayıt varsa dokunma.
  const existing = await session
    .from("job_postings")
    .select("id")
    .eq("source", TEST_POSTING.p_source)
    .eq("source_job_id", TEST_POSTING.p_source_job_id)
    .maybeSingle();
  if (existing.data) {
    summary.abortedBecauseTestKeyExists = true;
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  // 3) TEST kaydı ekle ve yeniden oku
  const upsert = await session.rpc("upsert_job_posting", TEST_POSTING);
  summary.insertOutcome = upsert.error ? `error:${upsert.error.code ?? "?"}` : upsert.data;

  const refetch = await session
    .from("job_postings")
    .select("id, title, acquisition_method, source_email_id, first_seen_at")
    .eq("source", TEST_POSTING.p_source)
    .eq("source_job_id", TEST_POSTING.p_source_job_id)
    .maybeSingle();
  const row = refetch.data;
  summary.persistedAfterRefetch = Boolean(row);
  summary.persistedAcquisitionMethod = row?.acquisition_method ?? null;
  summary.persistedSourceEmailIdIsNull = row ? row.source_email_id === null : null;

  // Tekrar eklemede ilk görülme korunur ve sonuç "unchanged" olur.
  const repeat = await session.rpc("upsert_job_posting", TEST_POSTING);
  summary.repeatOutcome = repeat.error ? `error:${repeat.error.code ?? "?"}` : repeat.data;

  // 4) TEST kaydını sil
  if (row) {
    const del = await session.from("job_postings").delete().eq("id", row.id);
    const after = await session.from("job_postings").select("id").eq("id", row.id).maybeSingle();
    summary.deleted = !del.error && after.data === null;
  } else {
    summary.deleted = false;
  }

  // 5) Oturumu kapat ve aynı istemcinin artık okuyamadığını doğrula
  await session.auth.signOut();
  const afterSignOut = await probeRead(session);
  summary.afterSignOutReadBlocked = afterSignOut.blocked;
  summary.afterSignOutReadStatus = afterSignOut.status;

  const allGood =
    summary.anonymousReadBlocked === true &&
    summary.anonymousInsertBlocked === true &&
    summary.insertOutcome === "inserted" &&
    summary.persistedAfterRefetch === true &&
    summary.persistedSourceEmailIdIsNull === true &&
    summary.repeatOutcome === "unchanged" &&
    summary.deleted === true &&
    summary.afterSignOutReadBlocked === true;
  summary.result = allGood ? "PASS" : "FAIL";
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = allGood ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bilinmeyen hata");
  process.exitCode = 1;
});
