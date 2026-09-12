import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Migration dosyasındaki güvenlik ifadeleri yanlışlıkla silinirse test kırılır.
test("job_postings migration'ı RLS, sahip politikaları ve anon yetki iptalini içerir", async () => {
  const sql = await readFile(
    new URL("../../supabase/migrations/20260912120000_job_postings.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /alter table public\.job_postings enable row level security/);
  assert.match(sql, /unique \(owner_id, source, source_job_id\)/);
  for (const policy of ["select", "insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`create policy job_postings_${policy}_own`), policy);
  }
  assert.match(sql, /revoke all on table public\.job_postings from anon/);
  assert.match(sql, /grant select, insert, update, delete on table public\.job_postings to authenticated/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /acquisition_method = 'manual' and source_email_id is null/);
  assert.doesNotMatch(sql, /security definer/i);
  assert.doesNotMatch(sql, /to anon\b/i);
});
