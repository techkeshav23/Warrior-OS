// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner password (server side, Node.js only)
//
// OWNER_PASSWORD (env) is the temporary first password. The first
// sign-in with it must set a new password; that one is stored as a
// salted scrypt hash in WARRIOR_DATA_DIR/owner.json, and from then on
// only the stored password works. Forgot it? Delete owner.json on the
// server and restart the app: the env password works again (as a
// temporary one).
//
// Devices never keep the password: a sign-in returns a credential,
// HMAC(secret, version), that /api/sync accepts. Changing the password
// bumps the version, so every device signs in again.
// ═══════════════════════════════════════════════════════════

import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { dataDir } from './server-store';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

interface OwnerFile {
  salt: string; // hex
  hash: string; // hex, scrypt(password, salt, 64)
  version: number;
  secret: string; // hex, signs device credentials
  updatedAt: string;
}

let cache: OwnerFile | null | undefined;

function ownerFile(): string {
  return path.join(dataDir(), 'owner.json');
}

async function loadOwner(): Promise<OwnerFile | null> {
  if (cache !== undefined) return cache;
  try {
    const parsed = JSON.parse(await fs.readFile(ownerFile(), 'utf8')) as Partial<OwnerFile>;
    const ok =
      typeof parsed.salt === 'string' &&
      typeof parsed.hash === 'string' &&
      typeof parsed.secret === 'string' &&
      typeof parsed.version === 'number';
    cache = ok ? (parsed as OwnerFile) : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    cache = null;
  }
  // Not found: look again next time (the first password may be set by
  // another request).
  const found = cache;
  if (found === null) cache = undefined;
  return found;
}

function envPassword(): string | null {
  const value = process.env.OWNER_PASSWORD?.trim();
  return value && value.length >= MIN_PASSWORD_LENGTH ? value : null;
}

/** Sync and owner sign-in are on when a temporary or stored password exists. */
export async function isOwnerAuthConfigured(): Promise<boolean> {
  return envPassword() !== null || (await loadOwner()) !== null;
}

function sameText(a: string, b: string): boolean {
  const da = createHash('sha256').update(a).digest();
  const db = createHash('sha256').update(b).digest();
  return timingSafeEqual(da, db);
}

/** 'owner' (stored password), 'temporary' (env password, must change) or null. */
export async function verifyPassword(password: string): Promise<'owner' | 'temporary' | null> {
  if (!password || password.length > MAX_PASSWORD_LENGTH) return null;
  const owner = await loadOwner();
  if (owner) {
    const hash = await scrypt(password, Buffer.from(owner.salt, 'hex'), 64);
    return timingSafeEqual(hash, Buffer.from(owner.hash, 'hex')) ? 'owner' : null;
  }
  const temp = envPassword();
  return temp && sameText(password, temp) ? 'temporary' : null;
}

function credentialOf(owner: OwnerFile): string {
  return createHmac('sha256', Buffer.from(owner.secret, 'hex')).update(`v${owner.version}`).digest('hex');
}

/** The credential for the stored password (null before one is set). */
export async function currentCredential(): Promise<string | null> {
  const owner = await loadOwner();
  return owner ? credentialOf(owner) : null;
}

/** Does a device credential match the current password version? */
export async function isValidCredential(credential: string): Promise<boolean> {
  const current = await currentCredential();
  return current !== null && credential.length > 0 && sameText(credential, current);
}

/** Store a new password; returns the new device credential. */
export async function setOwnerPassword(password: string): Promise<string> {
  const previous = await loadOwner();
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  const next: OwnerFile = {
    salt: salt.toString('hex'),
    hash: hash.toString('hex'),
    version: (previous?.version ?? 0) + 1,
    secret: previous?.secret ?? randomBytes(32).toString('hex'),
    updatedAt: new Date().toISOString(),
  };
  const file = ownerFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, file);
  cache = next;
  return credentialOf(next);
}

// ─── Wrong-password limiter (shared by /api/owner and /api/sync) ───

const FAIL_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 10;
const MAX_TRACKED_IPS = 5000;
const failures = new Map<string, number[]>();

function recent(ip: string, now: number): number[] {
  const list = (failures.get(ip) ?? []).filter((at) => now - at < FAIL_WINDOW_MS);
  if (list.length) failures.set(ip, list);
  else failures.delete(ip);
  return list;
}

export function isRateLimited(ip: string): boolean {
  return recent(ip, Date.now()).length >= MAX_FAILS;
}

export function recordFailure(ip: string): void {
  const now = Date.now();
  if (failures.size >= MAX_TRACKED_IPS && !failures.has(ip)) {
    const oldest = failures.keys().next().value;
    if (oldest !== undefined) failures.delete(oldest);
  }
  failures.set(ip, [...recent(ip, now), now]);
}
