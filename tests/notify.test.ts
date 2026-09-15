import assert from "node:assert/strict";
import test from "node:test";
import type { DiscoveryRunReport } from "../src/domain.ts";
import {
  TELEGRAM_MESSAGE_LIMIT,
  TelegramNotifier,
  discoverPrivateChatId,
  formatRunMessages,
  loadTelegramConfig,
  type FetchLike,
} from "../src/notify/telegram.ts";

function baseReport(overrides: Partial<DiscoveryRunReport> = {}): DiscoveryRunReport {
  return {
    startedAt: "2026-09-16T06:00:00.000Z",
    finishedAt: "2026-09-16T06:00:02.000Z",
    emailsRead: 3,
    unresolvedEmails: 0,
    repositoryErrors: 0,
    gmailStatus: "ok",
    sources: {
      linkedin: { status: "ok", jobsFound: 2, newJobs: 2, duplicateJobs: 0, errorCount: 0 },
      kariyer: { status: "ok", jobsFound: 0, newJobs: 0, duplicateJobs: 0, errorCount: 0 },
      indeed: { status: "ok", jobsFound: 1, newJobs: 0, duplicateJobs: 1, errorCount: 0 },
    },
    newPostings: [
      { source: "linkedin", sourceJobId: "1", url: "https://www.linkedin.com/jobs/view/1", title: "Veri Analisti <Junior> & Raporlama" },
      { source: "linkedin", sourceJobId: "2", url: "https://www.linkedin.com/jobs/view/2", title: null },
    ],
    notification: { channel: "none", status: "not_configured", messages: 0 },
    ...overrides,
  };
}

function fakeFetch(handler: (url: string, body: Record<string, unknown>) => { status: number; payload: unknown }): {
  fetchImpl: FetchLike;
  calls: Array<{ url: string; body: Record<string, unknown> }>;
} {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({ url, body });
    const { status, payload } = handler(url, body);
    return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
  };
  return { fetchImpl, calls };
}

test("yeni ilan yoksa mesaj üretilmez; hata varsa kısa uyarı gider", () => {
  assert.deepEqual(formatRunMessages(baseReport({ newPostings: [] })), []);
  const [warning] = formatRunMessages(baseReport({ newPostings: [], gmailStatus: "error", repositoryErrors: 2 }));
  assert.match(warning ?? "", /yeni ilan yok/);
  assert.match(warning ?? "", /Gmail okunamadı/);
  assert.match(warning ?? "", /2 depo hatası/);
});

test("yeni ilanlar HTML-kaçışlı bağlantı satırları olarak biçimlenir ve liste bağlantısı eklenir", () => {
  const [message] = formatRunMessages(baseReport(), "https://job-discovery-tr.vercel.app");
  assert.ok(message);
  assert.match(message, /^🆕 2 yeni iş ilanı\n/);
  assert.match(message, /<a href="https:\/\/www\.linkedin\.com\/jobs\/view\/1">Veri Analisti &lt;Junior&gt; &amp; Raporlama<\/a>/);
  assert.match(message, /Başlık yok/);
  assert.match(message, /Liste: https:\/\/job-discovery-tr\.vercel\.app$/);
});

test("çok sayıda ilan birden fazla mesaja bölünür ve Telegram sınırını aşmaz", () => {
  const newPostings = Array.from({ length: 40 }, (_, index) => ({
    source: "kariyer" as const,
    sourceJobId: String(1000 + index),
    url: `https://www.kariyer.net/is-ilani/${1000 + index}`,
    title: `İlan ${index} ${"x".repeat(150)}`,
  }));
  const messages = formatRunMessages(baseReport({ newPostings }));
  assert.equal(messages.length, 3);
  assert.match(messages[0] ?? "", /\(1\/3\)/);
  assert.ok(messages.every((message) => message.length <= TELEGRAM_MESSAGE_LIMIT));
});

test("TelegramNotifier sendMessage çağrısını doğru gövdeyle yapar ve hatayı token sızdırmadan raporlar", async () => {
  const ok = fakeFetch(() => ({ status: 200, payload: { ok: true, result: {} } }));
  const notifier = new TelegramNotifier({ botToken: "123:SECRET", chatId: "42" }, null, ok.fetchImpl);
  assert.deepEqual(await notifier.notifyRun(baseReport()), { channel: "telegram", status: "sent", messages: 1 });
  assert.equal(ok.calls[0]?.url, "https://api.telegram.org/bot123:SECRET/sendMessage");
  assert.equal(ok.calls[0]?.body.chat_id, "42");
  assert.equal(ok.calls[0]?.body.parse_mode, "HTML");
  assert.equal(ok.calls[0]?.body.disable_web_page_preview, true);

  assert.deepEqual(await notifier.notifyRun(baseReport({ newPostings: [] })), { channel: "telegram", status: "skipped", messages: 0 });

  const failing = fakeFetch(() => ({ status: 401, payload: { ok: false, description: "Unauthorized" } }));
  const broken = new TelegramNotifier({ botToken: "123:SECRET", chatId: "42" }, null, failing.fetchImpl);
  assert.deepEqual(await broken.notifyRun(baseReport()), { channel: "telegram", status: "error", messages: 0 });
  assert.equal(await broken.notifyFailure("Gmail e-postaları alınamadı."), false);
});

test("chat kimliği getUpdates içindeki son özel sohbetten bulunur; yapılandırma eksikse null", async () => {
  const updates = fakeFetch(() => ({
    status: 200,
    payload: {
      ok: true,
      result: [
        { update_id: 1, message: { chat: { id: -100, type: "group" } } },
        { update_id: 2, message: { chat: { id: 777, type: "private" } } },
      ],
    },
  }));
  assert.equal(await discoverPrivateChatId("123:SECRET", updates.fetchImpl), "777");
  assert.equal(await discoverPrivateChatId("123:SECRET", fakeFetch(() => ({ status: 200, payload: { ok: true, result: [] } })).fetchImpl), null);

  assert.equal(loadTelegramConfig({}), null);
  assert.equal(loadTelegramConfig({ TELEGRAM_BOT_TOKEN: "x" }), null);
  assert.deepEqual(loadTelegramConfig({ TELEGRAM_BOT_TOKEN: " x ", TELEGRAM_CHAT_ID: "7" }), { botToken: "x", chatId: "7" });
});
