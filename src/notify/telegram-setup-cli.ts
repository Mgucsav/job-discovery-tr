import { readFile, writeFile } from "node:fs/promises";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { discoverPrivateChatId, getBotIdentity, sendTelegramMessage } from "./telegram.ts";

// npm run telegram:setup
// 1) TELEGRAM_BOT_TOKEN yoksa terminalde gizli sorar ve .env.local'a yazar (ekrana basmaz),
// 2) botun t.me bağlantısını gösterir ve siz "Start"a basıp mesaj yazana kadar bekler,
// 3) TELEGRAM_CHAT_ID'yi .env.local'a yazar ve doğrulama mesajı gönderir.

async function upsertEnvLine(key: string, value: string): Promise<void> {
  const filePath = ".env.local";
  let content = "";
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}${content.trim() ? "\n" : ""}${line}\n`;
  await writeFile(filePath, next, { encoding: "utf8", mode: 0o600 });
}

async function promptHidden(question: string): Promise<string> {
  // Yazılanlar boş bir çıktıya yönlendirilir; token ekranda görünmez.
  const sink = new Writable({ write: (_chunk, _encoding, callback) => callback() });
  const rl = createInterface({ input: stdin, output: sink, terminal: true });
  stdout.write(question);
  try {
    const answer = await rl.question("");
    stdout.write("\n");
    return answer.trim();
  } finally {
    rl.close();
  }
}

const TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]{30,}$/;

async function main(): Promise<void> {
  let botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  if (!botToken) {
    botToken = await promptHidden("BotFather token'ını yapıştırın (gizli): ");
    if (!TOKEN_PATTERN.test(botToken)) throw new Error("Token biçimi beklenmedik (123456789:AAH... gibi olmalı). Tekrar deneyin.");
    await upsertEnvLine("TELEGRAM_BOT_TOKEN", botToken);
    console.log("TELEGRAM_BOT_TOKEN .env.local dosyasına kaydedildi.");
  }

  const bot = await getBotIdentity(botToken);
  console.log(`Bot: ${bot.firstName} (@${bot.username})`);

  let chatId = process.env.TELEGRAM_CHAT_ID?.trim() || null;
  if (!chatId) {
    console.log(`\nTelegram'da şu bağlantıyı açın, "Start"a basın ve bota bir mesaj yazın:\n  https://t.me/${bot.username}\n`);
    console.log("Mesajınız bekleniyor (en fazla 3 dakika)...");
    const deadline = Date.now() + 3 * 60_000;
    while (!chatId && Date.now() < deadline) {
      chatId = await discoverPrivateChatId(botToken);
      if (!chatId) await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    if (!chatId) throw new Error("Bota mesaj gelmedi. Botu açıp bir mesaj yazdıktan sonra komutu tekrar çalıştırın.");
    await upsertEnvLine("TELEGRAM_CHAT_ID", chatId);
    console.log("TELEGRAM_CHAT_ID .env.local dosyasına kaydedildi.");
  } else {
    console.log("TELEGRAM_CHAT_ID zaten tanımlı; kullanılıyor.");
  }

  await sendTelegramMessage(
    { botToken, chatId },
    "✅ İş ilanı keşfi bildirimleri bağlandı. Yeni ilan bulunduğunda bu sohbete yazacağım.",
  );
  console.log("Doğrulama mesajı gönderildi. Kurulum tamam.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bilinmeyen hata");
  process.exitCode = 1;
});
