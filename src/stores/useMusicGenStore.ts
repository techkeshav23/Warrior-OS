// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music Generation Store
// Generation state, current mood, typing BPM, the most recently
// generated notes (for the visual staff), and persisted listening
// statistics used by the music achievements.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export type MusicMood = 'morning' | 'study' | 'coding' | 'night';
export const MUSIC_MOODS: readonly MusicMood[] = ['morning', 'study', 'coding', 'night'];

export type MusicEngineStatus = 'idle' | 'starting' | 'playing' | 'error';

export interface GeneratedNote {
  id: string;
  note: string; // e.g. "C4"
  degree: number; // scale degree 0-4 (for staff placement)
  velocity: number; // 0-1
  at: number; // Date.now() when triggered
}

export type ListenSeconds = Record<MusicMood, number>;

interface PersistedMusicGen {
  volume: number; // 0-1
  autoMood: boolean; // auto-select mood by time of day, typing overrides
  currentMood: MusicMood;
  listenSeconds: ListenSeconds; // lifetime seconds composed per mood
  modesEver: MusicMood[];
  modesToday: { day: string; modes: MusicMood[] };
}

interface MusicGenStore extends PersistedMusicGen {
  // Transient runtime state (not persisted)
  isGenerating: boolean;
  status: MusicEngineStatus;
  error: string | null;
  typingBPM: number; // derived from keystroke timing, 60-140
  /** Typing-rhythm mode: is typing currently driving the beat (vs faded)? */
  typingActive: boolean;
  seed: number; // pattern seed; changing it re-rolls patterns
  recentNotes: GeneratedNote[]; // last few notes for visualization

  // Actions
  setGenerating: (generating: boolean) => void;
  setStatus: (status: MusicEngineStatus, error?: string | null) => void;
  setMood: (mood: MusicMood) => void;
  updateTypingRhythm: (bpm: number) => void;
  setTypingActive: (active: boolean) => void;
  setVolume: (volume: number) => void;
  randomizeSeed: () => void;
  pushNote: (note: GeneratedNote) => void;
  clearNotes: () => void;
  setAutoMood: (enabled: boolean) => void;
  toggleAutoMood: () => void;
  /** Credit listening time to a mood; returns the updated totals. */
  addListenTime: (mood: MusicMood, seconds: number) => ListenSeconds;
  /** Record that a mood was played on `day`; returns distinct counts. */
  markModeUsed: (mood: MusicMood, day: string) => { ever: number; today: number };
}

const MAX_RECENT_NOTES = 32;
const ZERO_LISTEN: ListenSeconds = { morning: 0, study: 0, coding: 0, night: 0 };

export const useMusicGenStore = create<MusicGenStore>()(
  persist(
    immer((set, get) => ({
      isGenerating: false,
      status: 'idle',
      error: null,
      currentMood: 'morning',
      typingBPM: 90,
      typingActive: false,
      volume: 0.6,
      seed: Math.floor(Math.random() * 1_000_000),
      recentNotes: [],
      autoMood: true,
      listenSeconds: { ...ZERO_LISTEN },
      modesEver: [],
      modesToday: { day: '', modes: [] },

      setGenerating: (generating) =>
        set((s) => {
          s.isGenerating = generating;
        }),

      setStatus: (status, error = null) =>
        set((s) => {
          s.status = status;
          s.error = error;
        }),

      setMood: (mood) =>
        set((s) => {
          s.currentMood = mood;
        }),

      updateTypingRhythm: (bpm) =>
        set((s) => {
          // Clamp to a musical, non-jarring range
          s.typingBPM = Math.max(60, Math.min(140, Math.round(bpm)));
        }),

      setTypingActive: (active) =>
        set((s) => {
          s.typingActive = active;
        }),

      setVolume: (volume) =>
        set((s) => {
          s.volume = Math.max(0, Math.min(1, volume));
        }),

      randomizeSeed: () =>
        set((s) => {
          s.seed = Math.floor(Math.random() * 1_000_000);
        }),

      pushNote: (note) =>
        set((s) => {
          s.recentNotes.push(note);
          if (s.recentNotes.length > MAX_RECENT_NOTES) {
            s.recentNotes.splice(0, s.recentNotes.length - MAX_RECENT_NOTES);
          }
        }),

      clearNotes: () =>
        set((s) => {
          s.recentNotes = [];
        }),

      setAutoMood: (enabled) =>
        set((s) => {
          s.autoMood = enabled;
        }),

      toggleAutoMood: () =>
        set((s) => {
          s.autoMood = !s.autoMood;
        }),

      addListenTime: (mood, seconds) => {
        if (seconds > 0) {
          set((s) => {
            s.listenSeconds[mood] = Math.round((s.listenSeconds[mood] + seconds) * 10) / 10;
          });
        }
        return { ...get().listenSeconds };
      },

      markModeUsed: (mood, day) => {
        set((s) => {
          if (!s.modesEver.includes(mood)) s.modesEver.push(mood);
          if (s.modesToday.day !== day) s.modesToday = { day, modes: [] };
          if (!s.modesToday.modes.includes(mood)) s.modesToday.modes.push(mood);
        });
        const { modesEver, modesToday } = get();
        return { ever: modesEver.length, today: modesToday.modes.length };
      },
    })),
    {
      name: 'warrior-os-musicgen',
      // Only persist preferences + statistics; runtime state stays in memory
      partialize: (state): PersistedMusicGen => ({
        volume: state.volume,
        autoMood: state.autoMood,
        currentMood: state.currentMood,
        listenSeconds: state.listenSeconds,
        modesEver: state.modesEver,
        modesToday: state.modesToday,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedMusicGen>;
        return {
          ...current,
          ...p,
          listenSeconds: { ...ZERO_LISTEN, ...(p.listenSeconds ?? {}) },
          modesEver: Array.isArray(p.modesEver) ? p.modesEver : [],
          modesToday:
            p.modesToday && Array.isArray(p.modesToday.modes)
              ? p.modesToday
              : { day: '', modes: [] },
        };
      },
    }
  )
);
