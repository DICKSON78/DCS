/**
 * DCS API client for the browser.
 * Signs every request with HMAC-SHA256 exactly like the gateway SDK does:
 *   signature = HMAC_SHA256(signingSecret, `${timestamp}.${method}.${path}.${query}.${body}`)
 * Nonces are UUIDs; a replayed nonce gets 409, a stale timestamp gets 401.
 */

export const DEFAULT_API_BASE = "http://localhost:8080";
export const DEFAULT_CREDENTIALS = {
  apiKey: "test-api-key-0001",
  signingSecret: "test-signing-key-0001",
  opsToken: "ops-secret-token-0001",
  baseUrl: DEFAULT_API_BASE,
};

const encoder = new TextEncoder();

async function hmacSHA256Hex(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(method, path, payload, signingSecret) {
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const body = payload ? JSON.stringify(payload) : "";
  const [pathname, query = ""] = path.split("?");
  const signature = await hmacSHA256Hex(
    signingSecret,
    [timestamp, method, pathname, query, body].join(".")
  );
  return {
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-signature": signature,
    "content-type": "application/json",
  };
}

export async function dcsRequest({ baseUrl, method, path, payload, apiKey, signingSecret, opsToken }) {
  const headers = {};

  if (opsToken) {
    headers["authorization"] = `Bearer ${opsToken}`;
  } else {
    const sig = await sign(method, path, payload, signingSecret);
    Object.assign(headers, sig);
    headers["x-tenant-key"] = apiKey;
  }

  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, body };
}