import type { NormalizedEmail } from "../domain.ts";
import { refreshAccessToken } from "./oauth.ts";

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  internalDate?: string;
  payload?: GmailPart;
}

interface GmailListResponse {
  messages?: Array<{ id: string }>;
  nextPageToken?: string;
}

interface GmailLabelsResponse {
  labels?: Array<{ id: string; name: string }>;
}

export interface GmailClientConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  label: string;
  maxMessages: number;
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function collectBodies(part: GmailPart | undefined, result: { text: string[]; html: string[] }): void {
  if (!part) return;
  if (part.body?.data && part.mimeType === "text/plain") result.text.push(decodeBase64Url(part.body.data));
  if (part.body?.data && part.mimeType === "text/html") result.html.push(decodeBase64Url(part.body.data));
  for (const child of part.parts ?? []) collectBodies(child, result);
}

function header(part: GmailPart | undefined, name: string): string | null {
  return part?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function normalizeMessage(message: GmailMessage): NormalizedEmail {
  const bodies = { text: [] as string[], html: [] as string[] };
  collectBodies(message.payload, bodies);
  const timestamp = Number(message.internalDate);
  return {
    id: message.id,
    receivedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString(),
    from: header(message.payload, "from") ?? "",
    subject: header(message.payload, "subject"),
    text: bodies.text.join("\n"),
    html: bodies.html.join("\n"),
  };
}

export class GmailReadonlyClient {
  private accessToken: string | null = null;

  public constructor(private readonly config: GmailClientConfig) {}

  private async request<T>(path: string): Promise<T> {
    this.accessToken ??= await refreshAccessToken(
      { clientId: this.config.clientId, clientSecret: this.config.clientSecret },
      this.config.refreshToken,
    );
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
      headers: { authorization: `Bearer ${this.accessToken}` },
    });
    if (response.status === 401) {
      this.accessToken = null;
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gmail API isteği başarısız (${response.status}): ${body.slice(0, 300)}`);
    }
    return (await response.json()) as T;
  }

  private async findLabelId(): Promise<string> {
    const result = await this.request<GmailLabelsResponse>("/labels");
    const match = result.labels?.find((label) => label.name === this.config.label);
    if (!match) throw new Error(`Gmail etiketi bulunamadı: ${this.config.label}`);
    return match.id;
  }

  public async listJobAlertEmails(): Promise<NormalizedEmail[]> {
    const labelId = await this.findLabelId();
    const ids: string[] = [];
    let pageToken: string | undefined;

    while (ids.length < this.config.maxMessages) {
      const params = new URLSearchParams({
        labelIds: labelId,
        maxResults: String(Math.min(100, this.config.maxMessages - ids.length)),
      });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await this.request<GmailListResponse>(`/messages?${params.toString()}`);
      ids.push(...(page.messages ?? []).map((message) => message.id));
      pageToken = page.nextPageToken;
      if (!pageToken) break;
    }

    const emails: NormalizedEmail[] = [];
    for (let index = 0; index < ids.length; index += 8) {
      const batch = ids.slice(index, index + 8);
      const messages = await Promise.all(
        batch.map((id) => this.request<GmailMessage>(`/messages/${encodeURIComponent(id)}?format=full`)),
      );
      emails.push(...messages.map(normalizeMessage));
    }
    return emails;
  }
}
