export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

export function createAuthorizationUrl(config: OAuthClientConfig, state: string): string {
  const url = new URL(AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GMAIL_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  return url.toString();
}

async function requestToken(params: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google OAuth token isteği başarısız (${response.status}): ${body.slice(0, 300)}`);
  }
  return (await response.json()) as TokenResponse;
}

export async function exchangeAuthorizationCode(
  config: OAuthClientConfig,
  code: string,
): Promise<TokenResponse> {
  return requestToken(
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
      grant_type: "authorization_code",
    }),
  );
}

export async function refreshAccessToken(
  config: Omit<OAuthClientConfig, "redirectUri">,
  refreshToken: string,
): Promise<string> {
  const token = await requestToken(
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  );
  return token.access_token;
}
