import { readFile, writeFile } from "node:fs/promises";
import { discoverPrivateChatId, sendTelegramMessage } from "./telegram.ts";

// npm run telegram:setup
// 1) .env.local içindeki TELEGRAM_BOT_TOKEN ile bota yazılmış son özel sohbeti bulur,
// 2) TELEGRAM_CHAT_ID'yi .env.local'a yazar (ekrana basmaz),
// 3) doğrulama mesajı gönderir.

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

async function main(): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN .env.local içinde tanımlı olmalı (BotFather'dan alınan token).");

  let chatId = process.env.TELEGRAM_CHAT_ID?.trim() || null;
  if (!chatId) {
    chatId = await discoverPrivateChatId(botToken);
    if (!chatId) {
      throw new Error("Bota henüz mesaj gönderilmemiş. Telegram'da botunuzu açıp bir mesaj yazın, sonra tekrar çalıştırın.");
    }
    await upsertEnvLine("TELEGRAM_CHAT_ID", chatId);
    console.log("TELEGRAM_CHAT_ID .env.local dosyasına kaydedildi.");
  } else {
    console.log("TELEGRAM_CHAT_ID zaten tanımlı; kullanılıyor.");
  }

  await sendTelegramMessage(
    { botToken, chatId },
    "✅ İş ilanı keşfi bildirimleri bağlandı. Yeni ilan bulunduğunda bu sohbete yazacağım.",
  );
  console.log("Doğrulama mesajı gönderildi.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bilinmeyen hata");
  process.exitCode = 1;
});
