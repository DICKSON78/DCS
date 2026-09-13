import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { hmacSha256, randomUUID } from './crypto.js';

const EXTRA = Constants.expoConfig?.extra || {};

const DEFAULT_BASE = Platform.select({
  android: 'http://10.0.2.2:8080',
  ios: 'http://localhost:8080',
  default: 'http://localhost:8080',
});

export const CONFIG = {
  baseUrl: EXTRA.apiBase || DEFAULT_BASE,
  apiKey: EXTRA.apiKey || 'test-api-key-0001',
  signingSecret: EXTRA.signingSecret || 'test-signing-key-0001',
};

export async function dcsRequest({ method, path, payload }) {
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const body = payload ? JSON.stringify(payload) : '';
  const [pathname, query = ''] = path.split('?');
  const signature = hmacSha256(CONFIG.signingSecret, [timestamp, method, pathname, query, body].join('.'));

  const headers = {
    'x-tenant-key': CONFIG.apiKey,
    'x-timestamp': timestamp,
    'x-nonce': nonce,
    'x-signature': signature,
  };
  if (payload) headers['content-type'] = 'application/json';

  const res = await fetch(CONFIG.baseUrl + path, {
    method,
    headers,
    body: payload ? body : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, body: json };
}