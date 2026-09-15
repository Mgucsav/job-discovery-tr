import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createAuthorizationUrl, exchangeAuthorizationCode, GMAIL_READONLY_SCOPE } from "./oauth.ts";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} .env.local içinde tanımlanmalı.`);
  return value;
}

async function saveRefreshToken(refreshToken: string): Promise<void> {
  const filePath = ".env.local";
  let content = "";
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const line = `GMAIL_REFRESH_TOKEN=${refreshToken}`;
  const next = /^GMAIL_REFRESH_TOKEN=.*$/m.test(content)
    ? content.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, line)
    : `${content.trimEnd()}${content.trim() ? "\n" : ""}${line}\n`;
  await writeFile(filePath, next, { encoding: "utf8", mode: 0o600 });
}

async function main(): Promise<void> {
  const config = {
    clientId: required("GMAIL_CLIENT_ID"),
    clientSecret: required("GMAIL_CLIENT_SECRET"),
    redirectUri: process.env.GMAIL_REDIRECT_URI?.trim() || "http://127.0.0.1:53682/oauth2/callback",
  };
  const redirect = new URL(config.redirectUri);
  if (redirect.protocol !== "http:" || redirect.hostname !== "127.0.0.1") {
    throw new Error("GMAIL_REDIRECT_URI güvenlik için http://127.0.0.1 tabanlı bir loopback adresi olmalı.");
  }
  const port = Number(redirect.port);
  if (!Number.isInteger(port) || port < 1024) throw new Error("Redirect URI geçerli bir port içermeli.");
  const state = randomBytes(24).toString("hex");

  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("OAuth işlemi 5 dakika içinde tamamlanmadı."));
    }, 300_000);
    const server = createServer((request, response) => {
      const callback = new URL(request.url ?? "/", config.redirectUri);
      if (callback.pathname !== redirect.pathname) {
        response.writeHead(404).end("Not found");
        return;
      }
      if (callback.searchParams.get("state") !== state) {
        response.writeHead(400).end("Invalid OAuth state");
        return;
      }
      const value = callback.searchParams.get("code");
      if (!value) {
        response.writeHead(400).end("Authorization code missing");
        return;
      }
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("Yetkilendirme tamamlandı. Bu pencereyi kapatabilirsiniz.");
      clearTimeout(timeout);
      server.close();
      resolve(value);
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      console.log(`Salt-okunur kapsam: ${GMAIL_READONLY_SCOPE}`);
      console.log("Aşağıdaki adresi tarayıcıda kendiniz açın:\n");
      console.log(createAuthorizationUrl(config, state));
    });
  });

  const token = await exchangeAuthorizationCode(config, code);
  if (!token.refresh_token) throw new Error("Google refresh token döndürmedi; erişimi kaldırıp yeniden deneyin.");
  await saveRefreshToken(token.refresh_token);
  console.log("Refresh token .env.local dosyasına kaydedildi; token ekrana yazdırılmadı.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bilinmeyen hata");
  process.exitCode = 1;
});
