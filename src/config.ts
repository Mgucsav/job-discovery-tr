import path from "node:path";

export interface AppConfig {
  gmail: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    label: string;
    maxMessages: number;
  };
  storePath: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} ortam değişkeni eksik.`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const maxMessages = Number.parseInt(process.env.GMAIL_MAX_MESSAGES ?? "100", 10);
  if (!Number.isInteger(maxMessages) || maxMessages < 1 || maxMessages > 500) {
    throw new Error("GMAIL_MAX_MESSAGES 1 ile 500 arasında bir tam sayı olmalı.");
  }

  return {
    gmail: {
      clientId: required("GMAIL_CLIENT_ID"),
      clientSecret: required("GMAIL_CLIENT_SECRET"),
      refreshToken: required("GMAIL_REFRESH_TOKEN"),
      label: required("GMAIL_JOB_LABEL"),
      maxMessages,
    },
    storePath: path.resolve(process.env.JOB_STORE_PATH ?? "data/jobs.json"),
  };
}
