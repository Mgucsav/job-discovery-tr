import assert from "node:assert/strict";
import test from "node:test";
import { createAuthorizationUrl, GMAIL_READONLY_SCOPE } from "../src/gmail/oauth.js";

test("OAuth URL'si yalnızca Gmail salt-okunur kapsamını ister", () => {
  const url = new URL(
    createAuthorizationUrl(
      {
        clientId: "fixture-client-id",
        clientSecret: "fixture-secret",
        redirectUri: "http://127.0.0.1:53682/oauth2/callback",
      },
      "fixed-state",
    ),
  );
  assert.equal(url.searchParams.get("scope"), GMAIL_READONLY_SCOPE);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("state"), "fixed-state");
  assert.equal(url.searchParams.get("response_type"), "code");
});
