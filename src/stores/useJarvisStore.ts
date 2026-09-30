// ═══════════════════════════════════════════════════════════
// WARRIOR OS — JARVIS Store
// Long-term memory: short facts about the owner that JARVIS saves with
// its `remember` tool and sends along with every request. Newest facts
// are kept when the list is full. Persisted to localStorage.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { generateId } from '@/lib/utils';
import { JARVIS_LIMITS, type JarvisMemoryFact } from '@/lib/jarvis/tools';

export const JARVIS_STORAGE_KEY = 'warrior-os-jarvis';
/** Longest fact kept. */
export const MAX_JARVIS_FACT_LENGTH = 300;

const STORE_VERSION = 1;

// ─── Helpers ───

/** Collapse whitespace and cap the length. */
export function cleanFact(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_JARVIS_FACT_LENGTH);
}

/** Comparison key: lower-case words only, so "I like tea." ≈ "i like tea". */
function factKey(fact: string): string {
  return fact
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeFact(raw: unknown): JarvisMemoryFact | null {
  if (!isRecord(raw)) return null;
  const { id, fact, createdAt } = raw;
  if (typeof id !== 'string' || !id || typeof fact !== 'string') return null;
  const clean = cleanFact(fact);
  if (!clean) return null;
  return {
    id: id.slice(0, 80),
    fact: clean,
    createdAt: typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt)) ? createdAt : new Date(0).toISOString(),
  };
}

// ─── Store ───

interface JarvisStore {
  /** Remembered facts, oldest first (capped at JARVIS_LIMITS.maxMemory). */
  memory: JarvisMemoryFact[];

  /**
   * Save a fact (whitespace-collapsed, max 300 chars). A fact that matches
   * an existing one (ignoring case and punctuation) refreshes that entry
   * instead of adding a copy. Returns the stored fact.
   */
  remember: (fact: string) => JarvisMemoryFact;
  /** Delete a fact by id; false when no such fact exists. */
  forget: (id: string) => boolean;
  clearMemory: () => void;
}

type JarvisPersisted = Pick<JarvisStore, 'memory'>;

export const useJarvisStore = create<JarvisStore>()(
  persist(
    immer((set, get) => ({
      memory: [],

      remember: (raw) => {
        const fact = cleanFact(typeof raw === 'string' ? raw : '');
        const key = factKey(fact);
        const existing = get().memory.find((m) => factKey(m.fact) === key);
        const entry: JarvisMemoryFact = {
          id: existing?.id ?? generateId('mem'),
          fact,
          createdAt: new Date().toISOString(),
        };
        set((s) => {
          // A repeated fact moves to the newest end with the fresh wording.
          s.memory = s.memory.filter((m) => m.id !== entry.id);
          s.memory.push(entry);
          if (s.memory.length > JARVIS_LIMITS.maxMemory) {
            s.memory.splice(0, s.memory.length - JARVIS_LIMITS.maxMemory);
          }
        });
        return entry;
      },

      forget: (id) => {
        if (!get().memory.some((m) => m.id === id)) return false;
        set((s) => {
          s.memory = s.memory.filter((m) => m.id !== id);
        });
        return true;
      },

      clearMemory: () =>
        set((s) => {
          s.memory = [];
        }),
    })),
    {
      name: JARVIS_STORAGE_KEY,
      version: STORE_VERSION,
      partialize: (state): JarvisPersisted => ({ memory: state.memory }),
      merge: (persisted, current) => {
        if (!isRecord(persisted) || !Array.isArray(persisted.memory)) return current;
        const seen = new Set<string>();
        const memory: JarvisMemoryFact[] = [];
        for (const raw of persisted.memory) {
          const fact = sanitizeFact(raw);
          if (!fact || seen.has(fact.id)) continue;
          seen.add(fact.id);
          memory.push(fact);
        }
        return { ...current, memory: memory.slice(-JARVIS_LIMITS.maxMemory) };
      },
    }
  )
);
