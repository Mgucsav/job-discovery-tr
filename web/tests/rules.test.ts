import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Firestore kuralları yanlışlıkla gevşetilirse test kırılır: istemci/anonim erişim tamamen kapalıdır.
test("firestore.rules tüm istemci erişimini reddeder", async () => {
  const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /rules_version = '2'/);
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.doesNotMatch(rules, /if true/);
  assert.doesNotMatch(rules, /request\.auth/);
});
