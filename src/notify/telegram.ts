import type { DiscoveryRunReport, JobSource, NewPostingSummary, NotificationReport } from "../domain.ts";

// Telegram Bot API üzerinden bildirim. Token yalnızca istek URL'sinde kullanılır; loglanmaz.
// Mesajlar HTML biçiminde, bağlantı önizlemesi kapalı; 4096 karakter sınırı için parçalanır.

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export const TELEGRAM_MESSAGE_LIMIT = 4096;
const POSTINGS_PER_MESSAGE = 15;

const SOURCE_LABELS: Record<JobSource, string> = {
  linkedin: "LinkedIn",
  kariyer: "Kariyer.net",
  indeed: "Indeed",
};

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function postingLine(posting: NewPostingSummary): string {
  const title = posting.title ? escapeHtml(posting.title) : "Başlık yok";
  return `• <b>${SOURCE_LABELS[posting.source]}</b> — <a href="${escapeHtml(posting.url)}">${title}</a>`;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

// Yeni ilan yoksa boş dizi (sessiz). Hata varsa kısa uyarı satırı eklenir.
export function formatRunMessages(report: DiscoveryRunReport, appUrl: string | null = null): string[] {
  const warnings: string[] = [];
  if (report.gmailStatus === "error") warnings.push("⚠️ Gmail okunamadı.");
  if (report.repositoryErrors > 0) warnings.push(`⚠️ ${report.repositoryErrors} depo hatası.`);
  const failedSources = (Object.keys(report.sources) as JobSource[]).filter((source) => report.sources[source].status === "error");
  if (failedSources.length > 0) warnings.push(`⚠️ Hatalı kaynak: ${failedSources.map((source) => SOURCE_LABELS[source]).join(", ")}.`);

  if (report.newPostings.length === 0) {
    return warnings.length > 0 ? [`İş ilanı keşfi: yeni ilan yok.\n${warnings.join("\n")}`] : [];
  }

  const groups = chunk(report.newPostings, POSTINGS_PER_MESSAGE);
  return groups.map((group, index) => {
    const header =
      groups.length > 1
        ? `🆕 ${report.newPostings.length} yeni iş ilanı (${index + 1}/${groups.length})`
        : `🆕 ${report.newPostings.length} yeni iş ilanı`;
    const footer = index === groups.length - 1 ? [...warnings, appUrl ? `Liste: ${escapeHtml(appUrl)}` : ""].filter(Boolean) : [];
    const text = [header, ...group.map(postingLine), ...footer].join("\n");
    return text.length <= TELEGRAM_MESSAGE_LIMIT ? text : `${text.slice(0, TELEGRAM_MESSAGE_LIMIT - 1)}…`;
  });
}

export function formatFailureMessage(message: string): string {
  return `⚠️ İş ilanı keşfi başarısız: ${escapeHtml(message)}`;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface TelegramResponse {
  ok?: boolean;
  description?: string;
  result?: unknown;
}

async function callTelegram(config: TelegramConfig, method: string, body: unknown, fetchImpl: FetchLike): Promise<TelegramResponse> {
  const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as TelegramResponse | null;
  if (!response.ok || !payload?.ok) {
    // Token asla hata metnine girmez; Telegram'ın açıklaması sınırlı uzunlukta aktarılır.
    throw new Error(`Telegram ${method} başarısız (${response.status}): ${(payload?.description ?? "").slice(0, 120)}`);
  }
  return payload;
}

export async function sendTelegramMessage(config: TelegramConfig, text: string, fetchImpl: FetchLike = fetch): Promise<void> {
  await callTelegram(
    config,
    "sendMessage",
    { chat_id: config.chatId, text, parse_mode: "HTML", disable_web_page_preview: true },
    fetchImpl,
  );
}

export class TelegramNotifier {
  public constructor(
    private readonly config: TelegramConfig,
    private readonly appUrl: string | null = null,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  // Koşu raporunu bildirir; sonuç raporun notification alanına yazılmak üzere döner.
  public async notifyRun(report: DiscoveryRunReport): Promise<NotificationReport> {
    const messages = formatRunMessages(report, this.appUrl);
    if (messages.length === 0) return { channel: "telegram", status: "skipped", messages: 0 };
    let sent = 0;
    try {
      for (const text of messages) {
        await sendTelegramMessage(this.config, text, this.fetchImpl);
        sent += 1;
      }
      return { channel: "telegram", status: "sent", messages: sent };
    } catch {
      return { channel: "telegram", status: "error", messages: sent };
    }
  }

  public async notifyFailure(message: string): Promise<boolean> {
    try {
      await sendTelegramMessage(this.config, formatFailureMessage(message), this.fetchImpl);
      return true;
    } catch {
      return false;
    }
  }
}

export interface BotIdentity {
  username: string;
  firstName: string;
}

// Botun kullanıcı adını döner (telegram:setup bağlantıyı göstermek için kullanır).
export async function getBotIdentity(botToken: string, fetchImpl: FetchLike = fetch): Promise<BotIdentity> {
  const payload = await callTelegram({ botToken, chatId: "" }, "getMe", {}, fetchImpl);
  const result = (payload.result ?? {}) as Record<string, unknown>;
  if (typeof result.username !== "string") throw new Error("Telegram bot bilgisi alınamadı.");
  return { username: result.username, firstName: typeof result.first_name === "string" ? result.first_name : result.username };
}

// Kullanıcının bota yazdığı ilk özel sohbetin kimliğini bulur (telegram:setup için).
export async function discoverPrivateChatId(botToken: string, fetchImpl: FetchLike = fetch): Promise<string | null> {
  const payload = await callTelegram({ botToken, chatId: "" }, "getUpdates", { limit: 100 }, fetchImpl);
  const updates = Array.isArray(payload.result) ? (payload.result as Array<Record<string, unknown>>) : [];
  for (const update of updates.reverse()) {
    const message = (update.message ?? update.edited_message) as Record<string, unknown> | undefined;
    const chat = message?.chat as Record<string, unknown> | undefined;
    if (chat && chat.type === "private" && (typeof chat.id === "number" || typeof chat.id === "string")) return String(chat.id);
  }
  return null;
}

export function loadTelegramConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig | null {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}
