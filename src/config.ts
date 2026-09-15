import path from "node:path";

export type StoreKind = "json" | "firestore";

export interface AppConfig {
  gmail: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    label: string;
    maxMessages: number;
  };
  store:
    | { kind: "json"; filePath: string }
    | { kind: "firestore"; ownerEmail: string };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} ortam değişkeni eksik.`);
  }
  return value;
}

function storeKind(): StoreKind {
  const raw = (process.env.JOB_STORE ?? "json").trim().toLowerCase();
  if (raw === "json" || raw === "firestore") return raw;
  throw new Error('JOB_STORE yalnızca "json" veya "firestore" olabilir.');
}

export function loadConfig(): AppConfig {
  const maxMessages = Number.parseInt(process.env.GMAIL_MAX_MESSAGES ?? "100", 10);
  if (!Number.isInteger(maxMessages) || maxMessages < 1 || maxMessages > 500) {
    throw new Error("GMAIL_MAX_MESSAGES 1 ile 500 arasında bir tam sayı olmalı.");
  }

  const kind = storeKind();
  return {
    gmail: {
      clientId: required("GMAIL_CLIENT_ID"),
      clientSecret: required("GMAIL_CLIENT_SECRET"),
      refreshToken: required("GMAIL_REFRESH_TOKEN"),
      label: required("GMAIL_JOB_LABEL"),
      maxMessages,
    },
    store:
      kind === "firestore"
        ? { kind, ownerEmail: required("JOB_OWNER_EMAIL") }
        : { kind, filePath: path.resolve(process.env.JOB_STORE_PATH ?? "data/jobs.json") },
  };
}
