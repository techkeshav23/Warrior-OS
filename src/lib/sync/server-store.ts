// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner sync: server-side store (Node.js only)
//
// One JSON file on disk: WARRIOR_DATA_DIR/sync.json (default ./.data).
// A single owner writes rarely, so a file is enough: writes are
// serialised in-process and land atomically (temp file + rename).
// In the Docker image WARRIOR_DATA_DIR is /data; mount a persistent
// volume there or the data is lost on redeploy.
// ═══════════════════════════════════════════════════════════

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isValidEntry, type SyncEntry } from './protocol';

interface StoredEntry extends SyncEntry {
  /** Server revision at which this entry last changed. */
  rev: number;
}

interface StoreFile {
  rev: number;
  entries: Record<string, StoredEntry>;
}

/** Hard cap on the file, so a runaway client cannot fill the disk. */
const MAX_FILE_BYTES = 32 * 1024 * 1024;

function dataFile(): string {
  const dir = process.env.WARRIOR_DATA_DIR?.trim() || path.join(process.cwd(), '.data');
  return path.join(dir, 'sync.json');
}

let cache: StoreFile | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Run `task` after every earlier one (reads see finished writes). */
function serialised<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<StoreFile> {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(await fs.readFile(dataFile(), 'utf8')) as Partial<StoreFile>;
    const entries: Record<string, StoredEntry> = {};
    for (const [key, value] of Object.entries(parsed.entries ?? {})) {
      const rev = (value as StoredEntry | undefined)?.rev;
      if (isValidEntry(value) && typeof rev === 'number') entries[key] = { v: value.v, t: value.t, rev };
    }
    cache = { rev: typeof parsed.rev === 'number' ? parsed.rev : 0, entries };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    cache = { rev: 0, entries: {} };
  }
  return cache;
}

async function save(store: StoreFile): Promise<void> {
  const file = dataFile();
  const raw = JSON.stringify(store);
  if (raw.length > MAX_FILE_BYTES) throw new Error('sync_store_full');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, raw, 'utf8');
  await fs.rename(tmp, file);
}

/** Entries changed after revision `since`. */
export function readSince(since: number): Promise<{ rev: number; entries: Record<string, SyncEntry> }> {
  return serialised(async () => {
    const store = await load();
    const entries: Record<string, SyncEntry> = {};
    for (const [key, e] of Object.entries(store.entries)) {
      if (e.rev > since) entries[key] = { v: e.v, t: e.t };
    }
    return { rev: store.rev, entries };
  });
}

/** Keep each change that is newer than what the server holds. */
export function applyChanges(
  changes: Record<string, SyncEntry>,
): Promise<{ rev: number; applied: string[]; ignored: string[] }> {
  return serialised(async () => {
    const store = await load();
    const applied: string[] = [];
    const ignored: string[] = [];
    const next: StoreFile = { rev: store.rev, entries: { ...store.entries } };
    for (const [key, change] of Object.entries(changes)) {
      const current = next.entries[key];
      if (current && current.t >= change.t) {
        ignored.push(key);
        continue;
      }
      if (!applied.length) next.rev += 1;
      next.entries[key] = { v: change.v, t: change.t, rev: next.rev };
      applied.push(key);
    }
    if (applied.length) {
      await save(next);
      cache = next;
    }
    return { rev: next.rev, applied, ignored };
  });
}
