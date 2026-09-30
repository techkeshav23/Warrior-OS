// ═══════════════════════════════════════════════════════════
// WARRIOR OS — JARVIS model access (server side, Node.js only)
//
// One generateContent call to Gemini, through whichever door is set up:
//   1. Vertex AI (VERTEX_PROJECT): Google Cloud billing, no API key.
//      Auth from GOOGLE_SERVICE_ACCOUNT_JSON (a service-account key,
//      raw JSON or base64) or, without it, the VM's own service account
//      via the metadata server (needs the cloud-platform scope).
//   2. The Gemini API (GEMINI_API_KEY), the same key NEXUS already uses.
// Access tokens are cached until shortly before they expire.
// ═══════════════════════════════════════════════════════════

import { createSign } from 'node:crypto';

export const DEFAULT_JARVIS_MODEL = 'gemini-2.5-flash';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
// The metadata server by IP: the hostname does not always resolve inside Docker.
const METADATA_TOKEN_URL = 'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const UPSTREAM_TIMEOUT_MS = 45_000;

export type JarvisProvider = 'vertex' | 'gemini-api';

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && !value.toLowerCase().startsWith('your_') ? value : null;
}

export function jarvisModel(): string {
  return env('JARVIS_MODEL') ?? DEFAULT_JARVIS_MODEL;
}

export function jarvisProvider(): JarvisProvider | null {
  if (env('VERTEX_PROJECT') ?? env('GOOGLE_CLOUD_PROJECT')) return 'vertex';
  if (env('GEMINI_API_KEY')) return 'gemini-api';
  return null;
}

// ─── Vertex auth ───

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  const raw = env('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!raw) return null;
  const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const parsed = JSON.parse(text) as Partial<ServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) throw new Error('service_account_invalid');
  return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, '\n') };
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString('base64url');

async function tokenFromServiceAccount(sa: ServiceAccount): Promise<{ token: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`token_${res.status}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('token_missing');
  return { token: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

async function tokenFromMetadata(): Promise<{ token: string; expiresIn: number }> {
  const res = await fetch(METADATA_TOKEN_URL, {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(3_000),
  });
  if (!res.ok) throw new Error(`metadata_${res.status}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('metadata_token_missing');
  return { token: data.access_token, expiresIn: data.expires_in ?? 300 };
}

async function vertexToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const sa = serviceAccount();
  const { token, expiresIn } = sa ? await tokenFromServiceAccount(sa) : await tokenFromMetadata();
  cachedToken = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

// ─── generateContent ───

export class JarvisUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function endpoint(model: string): Promise<{ url: string; headers: Record<string, string> }> {
  const provider = jarvisProvider();
  if (provider === 'vertex') {
    const project = env('VERTEX_PROJECT') ?? env('GOOGLE_CLOUD_PROJECT');
    const location = env('VERTEX_LOCATION') ?? 'global';
    const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
    return {
      url: `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`,
      headers: { Authorization: `Bearer ${await vertexToken()}` },
    };
  }
  if (provider === 'gemini-api') {
    return {
      // JARVIS_GEMINI_BASE_URL: optional override (a proxy, or a local stub in tests).
      url: `${env('JARVIS_GEMINI_BASE_URL') ?? 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent`,
      headers: { 'x-goog-api-key': env('GEMINI_API_KEY') ?? '' },
    };
  }
  throw new JarvisUpstreamError('not_configured', 503);
}

/** Call Gemini once; returns the parsed JSON response. */
export async function generateContent(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const model = jarvisModel();
  let target;
  try {
    target = await endpoint(model);
  } catch (err) {
    if (err instanceof JarvisUpstreamError) throw err;
    // Auth setup problems (bad key JSON, no metadata server, missing scope).
    throw new JarvisUpstreamError('auth_failed', 502);
  }
  let res: Response;
  try {
    res = await fetch(target.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...target.headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    throw new JarvisUpstreamError(timedOut ? 'upstream_timeout' : 'upstream_unreachable', 504);
  }
  if (res.status === 401 || res.status === 403) {
    cachedToken = null;
    throw new JarvisUpstreamError('upstream_denied', 502);
  }
  if (res.status === 429) throw new JarvisUpstreamError('upstream_rate_limited', 429);
  if (!res.ok) throw new JarvisUpstreamError(`upstream_${res.status}`, 502);
  return (await res.json()) as Record<string, unknown>;
}
