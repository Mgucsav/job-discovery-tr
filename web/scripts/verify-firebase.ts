// Dağıtılmış (veya yerel) web uygulamasına karşı uçtan uca doğrulama.
// Kullanıcı e-posta ve şifresini KENDİ terminalinde girer; şifre ekranda gösterilmez, dosyaya yazılmaz,
// çıktıda yer almaz. Yalnızca sonuç özeti (durum kodları ve evet/hayır) basılır.
//
// Kullanım: npm run verify:firebase -- --base-url https://<uygulama>.vercel.app
//
// Kontroller:
//  1. Oturumsuz: "/" -> /login yönlendirmesi, "/api/jobs" -> 401
//  2. Giriş (/api/login) -> HttpOnly oturum çerezi
//  3. TEST kaydı ekleme -> "inserted"; sayfa yeniden istendiğinde ("yenileme") kayıt HTML'de görünür
//  4. Aynı bağlantıyı tekrar ekleme -> "unchanged" (ilk görülme korunur)
//  5. TEST kaydını silme -> listede yok
//  6. Çıkış -> eski çerezle "/" yine /login'e gider, "/api/jobs" 401
//  7. Doğrudan Firestore REST isteği (anonim ve kullanıcının kendi ID token'ı ile) -> 403
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Writable } from "node:stream";

const TEST_URL = "https://www.linkedin.com/jobs/view/0000000000";
const TEST_ID = "linkedin__0000000000";
const TEST_TITLE = "TEST doğrulama kaydı (otomatik silinir)";
const TEST_MARKER = "TEST doğrulama kaydı";
const SESSION_COOKIE_NAME = "__session";

function readBaseUrl(): string {
  const index = process.argv.indexOf("--base-url");
  const raw = index >= 0 ? process.argv[index + 1] : process.env.VERIFY_BASE_URL;
  return (raw ?? "http://localhost:3000").replace(/\/+$/, "");
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

interface JobsPayload {
  jobs?: Array<{ id?: string; title?: string | null; acquisitionMethod?: string; sourceEmailId?: string | null }>;
}

async function fetchJobs(base: string, headers: Record<string, string>): Promise<JobsPayload> {
  const response = await fetch(`${base}/api/jobs`, { headers });
  return (await response.json().catch(() => ({}))) as JobsPayload;
}

async function main(): Promise<void> {
  const base = readBaseUrl();
  const summary: Record<string, unknown> = { baseUrl: base };
  const json = { "Content-Type": "application/json" };

  // 1) Oturumsuz erişim
  const anonHome = await fetch(`${base}/`, { redirect: "manual" });
  summary.anonymousHomeStatus = anonHome.status;
  summary.anonymousHomeRedirectsToLogin =
    anonHome.status === 307 && (anonHome.headers.get("location") ?? "").includes("/login");
  const anonJobs = await fetch(`${base}/api/jobs`);
  summary.anonymousApiStatus = anonJobs.status;

  // 2) Giriş
  const email = await promptVisible("Web uygulaması hesabının e-postası: ");
  const password = await promptHidden("Şifre (gizli): ");
  const login = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ email, password }),
  });
  summary.loginStatus = login.status;
  const cookieHeader = login.headers.getSetCookie().find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
  const sessionCookie = cookieHeader?.split(";")[0] ?? null;
  summary.sessionCookieHttpOnly = cookieHeader ? /httponly/i.test(cookieHeader) : false;
  if (login.status !== 200 || !sessionCookie) {
    summary.result = "FAIL (giriş başarısız)";
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }
  const authed = { Cookie: sessionCookie };

  // TEST anahtarı zaten varsa gerçek veriye dokunmadan dur.
  const before = await fetchJobs(base, authed);
  if (before.jobs?.some((job) => job.id === TEST_ID)) {
    summary.result = "FAIL (TEST kaydı zaten var; arayüzden silip tekrar deneyin)";
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  // 3) TEST kaydı ekle, sayfayı yeniden iste
  const insert = await fetch(`${base}/api/jobs`, {
    method: "POST",
    headers: { ...json, ...authed },
    body: JSON.stringify({ url: TEST_URL, title: TEST_TITLE }),
  });
  const insertBody = (await insert.json().catch(() => ({}))) as { outcome?: string };
  summary.insertStatus = insert.status;
  summary.insertOutcome = insertBody.outcome ?? null;

  const pageAfterInsert = await fetch(`${base}/`, { headers: authed });
  const htmlAfterInsert = await pageAfterInsert.text();
  summary.pageStatusSignedIn = pageAfterInsert.status;
  summary.testVisibleOnPageReload = htmlAfterInsert.includes(TEST_MARKER);

  const after = await fetchJobs(base, authed);
  const stored = after.jobs?.find((job) => job.id === TEST_ID);
  summary.persistedInApi = Boolean(stored);
  summary.persistedAcquisitionMethod = stored?.acquisitionMethod ?? null;
  summary.persistedSourceEmailIdIsNull = stored ? stored.sourceEmailId === null : null;

  // 4) Tekrar ekleme
  const repeat = await fetch(`${base}/api/jobs`, {
    method: "POST",
    headers: { ...json, ...authed },
    body: JSON.stringify({ url: TEST_URL, title: TEST_TITLE }),
  });
  summary.repeatOutcome = ((await repeat.json().catch(() => ({}))) as { outcome?: string }).outcome ?? null;

  // 5) Sil
  const del = await fetch(`${base}/api/jobs`, {
    method: "DELETE",
    headers: { ...json, ...authed },
    body: JSON.stringify({ id: TEST_ID }),
  });
  summary.deleteStatus = del.status;
  const afterDelete = await fetchJobs(base, authed);
  const pageAfterDelete = await (await fetch(`${base}/`, { headers: authed })).text();
  summary.deleted = !afterDelete.jobs?.some((job) => job.id === TEST_ID) && !pageAfterDelete.includes(TEST_MARKER);

  // 6) Çıkış ve eski çerezle deneme
  const logout = await fetch(`${base}/api/logout`, { method: "POST", headers: authed });
  summary.logoutStatus = logout.status;
  const homeAfterLogout = await fetch(`${base}/`, { headers: authed, redirect: "manual" });
  summary.afterLogoutHomeRedirectsToLogin =
    homeAfterLogout.status === 307 && (homeAfterLogout.headers.get("location") ?? "").includes("/login");
  const apiAfterLogout = await fetch(`${base}/api/jobs`, { headers: authed });
  summary.afterLogoutApiStatus = apiAfterLogout.status;

  // 7) Doğrudan Firestore REST (kurallar tüm istemci erişimini reddetmeli)
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const webApiKey = process.env.FIREBASE_WEB_API_KEY?.trim();
  if (projectId) {
    const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const direct = await fetch(`${firestoreBase}/users`);
    summary.directFirestoreAnonymousStatus = direct.status;
    if (webApiKey) {
      const tokenResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(webApiKey)}`,
        { method: "POST", headers: json, body: JSON.stringify({ email, password, returnSecureToken: true }) },
      );
      const token = (await tokenResponse.json().catch(() => ({}))) as { idToken?: string; localId?: string };
      if (token.idToken && token.localId) {
        const own = await fetch(`${firestoreBase}/users/${token.localId}/jobPostings`, {
          headers: { Authorization: `Bearer ${token.idToken}` },
        });
        summary.directFirestoreOwnTokenStatus = own.status;
      }
    }
  } else {
    summary.directFirestoreAnonymousStatus = "atlandı (FIREBASE_PROJECT_ID yok)";
  }

  const allGood =
    summary.anonymousHomeRedirectsToLogin === true &&
    summary.anonymousApiStatus === 401 &&
    summary.sessionCookieHttpOnly === true &&
    summary.insertOutcome === "inserted" &&
    summary.testVisibleOnPageReload === true &&
    summary.persistedInApi === true &&
    summary.persistedAcquisitionMethod === "manual" &&
    summary.persistedSourceEmailIdIsNull === true &&
    summary.repeatOutcome === "unchanged" &&
    summary.deleted === true &&
    summary.afterLogoutHomeRedirectsToLogin === true &&
    summary.afterLogoutApiStatus === 401 &&
    (summary.directFirestoreAnonymousStatus === 403 || typeof summary.directFirestoreAnonymousStatus === "string") &&
    (summary.directFirestoreOwnTokenStatus === undefined || summary.directFirestoreOwnTokenStatus === 403);
  summary.result = allGood ? "PASS" : "FAIL";
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = allGood ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bilinmeyen hata");
  process.exitCode = 1;
});
