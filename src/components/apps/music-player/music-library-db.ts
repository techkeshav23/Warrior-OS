// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Music Library storage (IndexedDB)
// The warrior's own audio files, kept on this device only. Browser-
// only; every function rejects cleanly when IndexedDB is unavailable
// (private mode etc.) so the UI can fall back to session-only files.
// ═══════════════════════════════════════════════════════════

const DB_NAME = 'warrior-music-library';
const DB_VERSION = 1;
const STORE = 'tracks';
/** Refuse single files above this size (keeps the browser quota sane). */
export const MAX_TRACK_BYTES = 200 * 1024 * 1024;

export interface LibraryTrack {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: number;
}

interface LibraryRecord extends LibraryTrack {
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error('Could not open the music library'));
      };
    });
  }
  return dbPromise;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function strip(record: LibraryRecord): LibraryTrack {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    size: record.size,
    addedAt: record.addedAt,
  };
}

/** True for files the <audio> element can plausibly play. */
export function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  return /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i.test(file.name);
}

/** All saved tracks (metadata only), oldest first. */
export async function listLibraryTracks(): Promise<LibraryTrack[]> {
  const db = await openDb();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const records = await requestToPromise(store.getAll() as IDBRequest<LibraryRecord[]>);
  return records.map(strip).sort((a, b) => a.addedAt - b.addedAt);
}

/** The audio data for one track, or null if it is gone. */
export async function getLibraryBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const record = await requestToPromise(store.get(id) as IDBRequest<LibraryRecord | undefined>);
  return record?.blob ?? null;
}

/** Save audio files; returns the tracks that were added. */
export async function addLibraryFiles(files: File[]): Promise<LibraryTrack[]> {
  const accepted = files.filter((f) => isAudioFile(f) && f.size > 0 && f.size <= MAX_TRACK_BYTES);
  if (accepted.length === 0) return [];
  const db = await openDb();
  const now = Date.now();
  const records: LibraryRecord[] = accepted.map((file, i) => ({
    id: `track-${now}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name.replace(/\.[^.]+$/, ''),
    type: file.type || 'audio/mpeg',
    size: file.size,
    addedAt: now + i,
    blob: file,
  }));
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    records.forEach((r) => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save the files'));
    tx.onabort = () => reject(tx.error ?? new Error('Saving was aborted (storage full?)'));
  });
  return records.map(strip);
}

/** Delete one track from this device. */
export async function removeLibraryTrack(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not delete the track'));
  });
}
