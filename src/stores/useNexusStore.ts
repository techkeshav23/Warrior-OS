// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Store
// Persisted conversations + preferences, pomodoro timer,
// proactive-suggestion bookkeeping and the nudge feed.
// (Live voice state lives in lib/nexus/voice-store to keep
// high-frequency updates out of localStorage.)
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type {
  NexusActionButton,
  NexusContext,
  NexusConversation,
  NexusInputChannel,
  NexusMessage,
  NexusMood,
  NexusNudge,
  NexusPomodoroState,
  NexusPomodoroTransition,
  NexusReplySource,
  NexusRole,
} from '@/types/nexus';
import { generateId } from '@/lib/utils';

export const NEXUS_MAX_CONVERSATIONS = 20;
export const NEXUS_MAX_MESSAGES_PER_CONVERSATION = 80;
export const NEXUS_MAX_NUDGES = 12;
export const NEXUS_DEFAULT_FOCUS_MINUTES = 25;
export const NEXUS_DEFAULT_BREAK_MINUTES = 5;
export const NEXUS_DEFAULT_CONVERSATION_TITLE = 'New chat';

/** A phase that ended more than this long before the OS noticed counts as "late". */
const POMODORO_LATE_MS = 90_000;
const MAX_STORED_MESSAGE_CHARS = 12_000;

const EMPTY_MESSAGES: NexusMessage[] = [];

export interface NexusNewMessage {
  role: NexusRole;
  content: string;
  source?: NexusReplySource;
  via?: NexusInputChannel;
  actions?: NexusActionButton[];
}

interface NexusStore {
  // ── Conversations (persisted) ──
  conversations: NexusConversation[];
  activeConversationId: string | null;
  /** Mirror of the active conversation's messages (kept for older callers). */
  messages: NexusMessage[];

  // ── Live request state ──
  /** In-flight AI/command requests per conversation id */
  inFlight: Record<string, number>;
  isProcessing: boolean;

  // ── Legacy fields ──
  context: NexusContext;
  mood: NexusMood;
  isOpen: boolean;

  // ── Preferences (persisted) ──
  /** Attach an OS-state summary to AI requests */
  contextEnabled: boolean;
  /** Speak replies to voice commands through SpeechSynthesis */
  voiceReplies: boolean;
  /** Proactive NEXUS suggestions (nudges) */
  suggestionsEnabled: boolean;

  // ── Pomodoro (persisted) ──
  pomodoro: NexusPomodoroState;

  // ── Suggestion bookkeeping (persisted) ──
  lastSuggestionAt: number | null;
  lastSuggestionId: string | null;
  ruleLastFired: Record<string, number>;
  nudges: NexusNudge[];

  // ── Conversation actions ──
  newConversation: () => string;
  ensureConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearConversation: (id?: string) => void;
  renameConversation: (id: string, title: string) => void;
  appendMessage: (conversationId: string, message: NexusNewMessage) => string;
  beginRequest: (conversationId: string) => void;
  endRequest: (conversationId: string) => void;

  // ── Legacy actions ──
  addMessage: (role: NexusRole, content: string) => void;
  setContext: (context: Partial<NexusContext>) => void;
  setMood: (mood: NexusMood) => void;
  setProcessing: (processing: boolean) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  clearHistory: () => void;

  // ── Preference actions ──
  setContextEnabled: (enabled: boolean) => void;
  toggleContext: () => void;
  setVoiceReplies: (enabled: boolean) => void;
  toggleVoiceReplies: () => void;
  setSuggestionsEnabled: (enabled: boolean) => void;
  toggleSuggestions: () => void;

  // ── Pomodoro actions ──
  startPomodoro: (focusMinutes?: number, breakMinutes?: number) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  stopPomodoro: () => void;
  setPomodoroDurations: (focusMinutes: number, breakMinutes: number) => void;
  /** Advance the timer if its phase has ended; returns what completed (or null). */
  advancePomodoro: (now: number) => NexusPomodoroTransition | null;

  // ── Suggestion / nudge actions ──
  recordSuggestion: (ruleId: string, at: number) => void;
  pushNudge: (nudge: Omit<NexusNudge, 'id'>) => void;
  dismissNudge: (id: string) => void;
  clearNudges: () => void;
}

// ─── Helpers ───

/** UTC day key — same convention as habits/planner/dreams. */
export function nexusDayKey(ms: number): string {
  return new Date(ms).toISOString().split('T')[0];
}

function clampMinutes(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function titleFrom(content: string): string {
  const line = content.replace(/\s+/g, ' ').trim();
  if (!line) return NEXUS_DEFAULT_CONVERSATION_TITLE;
  return line.length > 42 ? `${line.slice(0, 41)}…` : line;
}

function freshPomodoro(): NexusPomodoroState {
  return {
    phase: 'idle',
    endsAt: null,
    pausedRemainingMs: null,
    phaseDurationMs: 0,
    focusMinutes: NEXUS_DEFAULT_FOCUS_MINUTES,
    breakMinutes: NEXUS_DEFAULT_BREAK_MINUTES,
    dayKey: '',
    completedToday: 0,
    focusMinutesToday: 0,
    totalCompleted: 0,
  };
}

function rollPomodoroDay(p: NexusPomodoroState, now: number): void {
  const key = nexusDayKey(now);
  if (p.dayKey !== key) {
    p.dayKey = key;
    p.completedToday = 0;
    p.focusMinutesToday = 0;
  }
}

function sortedByRecent(conversations: NexusConversation[]): NexusConversation[] {
  return [...conversations].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

/** localStorage wrapper that never throws (quota, private mode, SSR). */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* quota exceeded or storage blocked — state stays in memory */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

// ─── Persisted-state sanitizing (defends against corrupt/old blobs) ───

const ROLES: readonly NexusRole[] = ['user', 'nexus', 'system'];

function isValidMessage(raw: unknown): raw is NexusMessage {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Partial<NexusMessage>;
  return (
    typeof m.id === 'string' &&
    typeof m.content === 'string' &&
    typeof m.timestamp === 'string' &&
    typeof m.role === 'string' &&
    (ROLES as readonly string[]).includes(m.role)
  );
}

function sanitizeConversations(raw: unknown): NexusConversation[] {
  if (!Array.isArray(raw)) return [];
  const out: NexusConversation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Partial<NexusConversation>;
    if (typeof c.id !== 'string' || !Array.isArray(c.messages)) continue;
    const fallbackIso = new Date(0).toISOString();
    out.push({
      id: c.id,
      title: typeof c.title === 'string' && c.title.trim() ? c.title : NEXUS_DEFAULT_CONVERSATION_TITLE,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : fallbackIso,
      updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : fallbackIso,
      messages: c.messages.filter(isValidMessage).slice(-NEXUS_MAX_MESSAGES_PER_CONVERSATION),
    });
    if (out.length >= NEXUS_MAX_CONVERSATIONS) break;
  }
  return out;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizePomodoro(raw: unknown): NexusPomodoroState {
  const base = freshPomodoro();
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<NexusPomodoroState>;
  const phase = p.phase === 'focus' || p.phase === 'break' ? p.phase : 'idle';
  return {
    phase,
    endsAt: phase !== 'idle' && typeof p.endsAt === 'number' ? p.endsAt : null,
    pausedRemainingMs:
      phase !== 'idle' && typeof p.pausedRemainingMs === 'number' ? p.pausedRemainingMs : null,
    phaseDurationMs: finiteOr(p.phaseDurationMs, 0),
    focusMinutes: clampMinutes(finiteOr(p.focusMinutes, base.focusMinutes), 1, 180),
    breakMinutes: clampMinutes(finiteOr(p.breakMinutes, base.breakMinutes), 1, 60),
    dayKey: typeof p.dayKey === 'string' ? p.dayKey : '',
    completedToday: finiteOr(p.completedToday, 0),
    focusMinutesToday: finiteOr(p.focusMinutesToday, 0),
    totalCompleted: finiteOr(p.totalCompleted, 0),
  };
}

type PersistedNexus = Pick<
  NexusStore,
  | 'conversations'
  | 'activeConversationId'
  | 'contextEnabled'
  | 'voiceReplies'
  | 'suggestionsEnabled'
  | 'pomodoro'
  | 'lastSuggestionAt'
  | 'lastSuggestionId'
  | 'ruleLastFired'
  | 'nudges'
>;

function sanitizePersisted(raw: unknown): Partial<PersistedNexus> {
  if (!raw || typeof raw !== 'object') return {};
  const p = raw as Partial<Record<keyof PersistedNexus, unknown>>;
  const conversations = sanitizeConversations(p.conversations);
  const activeId =
    typeof p.activeConversationId === 'string' && conversations.some((c) => c.id === p.activeConversationId)
      ? p.activeConversationId
      : (sortedByRecent(conversations)[0]?.id ?? null);
  const out: Partial<PersistedNexus> = {
    conversations,
    activeConversationId: activeId,
    pomodoro: sanitizePomodoro(p.pomodoro),
  };
  if (typeof p.contextEnabled === 'boolean') out.contextEnabled = p.contextEnabled;
  if (typeof p.voiceReplies === 'boolean') out.voiceReplies = p.voiceReplies;
  if (typeof p.suggestionsEnabled === 'boolean') out.suggestionsEnabled = p.suggestionsEnabled;
  if (typeof p.lastSuggestionAt === 'number') out.lastSuggestionAt = p.lastSuggestionAt;
  if (typeof p.lastSuggestionId === 'string') out.lastSuggestionId = p.lastSuggestionId;
  if (p.ruleLastFired && typeof p.ruleLastFired === 'object' && !Array.isArray(p.ruleLastFired)) {
    const fired: Record<string, number> = {};
    for (const [key, value] of Object.entries(p.ruleLastFired as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) fired[key] = value;
    }
    out.ruleLastFired = fired;
  }
  if (Array.isArray(p.nudges)) {
    out.nudges = (p.nudges as unknown[])
      .filter(
        (n): n is NexusNudge =>
          !!n &&
          typeof n === 'object' &&
          typeof (n as NexusNudge).id === 'string' &&
          typeof (n as NexusNudge).text === 'string' &&
          typeof (n as NexusNudge).at === 'number'
      )
      .slice(0, NEXUS_MAX_NUDGES);
  }
  return out;
}

// ─── Store ───

export const useNexusStore = create<NexusStore>()(
  persist(
    immer((set, get) => {
      /** Keep the legacy `messages` mirror pointing at the active conversation. */
      const syncMirror = () => {
        const s = get();
        const active = s.conversations.find((c) => c.id === s.activeConversationId);
        const next = active ? active.messages : EMPTY_MESSAGES;
        if (s.messages !== next) set({ messages: next });
      };

      return {
        conversations: [],
        activeConversationId: null,
        messages: EMPTY_MESSAGES,
        inFlight: {},
        isProcessing: false,
        context: {
          openApps: [],
          currentWorkspace: 'study',
          timeOfDay: 'morning',
          userLevel: 1,
          currentStreak: 0,
          idleMinutes: 0,
          studyHoursToday: 0,
        },
        mood: { type: 'neutral', intensity: 0.5 },
        isOpen: false,
        contextEnabled: true,
        voiceReplies: true,
        suggestionsEnabled: true,
        pomodoro: freshPomodoro(),
        lastSuggestionAt: null,
        lastSuggestionId: null,
        ruleLastFired: {},
        nudges: [],

        // ── Conversations ──
        newConversation: () => {
          const s = get();
          const active = s.conversations.find((c) => c.id === s.activeConversationId);
          if (active && active.messages.length === 0) return active.id;
          const id = generateId('chat');
          const nowIso = new Date().toISOString();
          set((state) => {
            state.conversations.unshift({
              id,
              title: NEXUS_DEFAULT_CONVERSATION_TITLE,
              createdAt: nowIso,
              updatedAt: nowIso,
              messages: [],
            });
            state.activeConversationId = id;
            if (state.conversations.length > NEXUS_MAX_CONVERSATIONS) {
              const keep = new Set(
                sortedByRecent(state.conversations)
                  .filter((c) => c.id !== id)
                  .slice(0, NEXUS_MAX_CONVERSATIONS - 1)
                  .map((c) => c.id)
              );
              keep.add(id);
              state.conversations = state.conversations.filter((c) => keep.has(c.id));
            }
          });
          syncMirror();
          return id;
        },

        ensureConversation: () => {
          const s = get();
          if (s.activeConversationId && s.conversations.some((c) => c.id === s.activeConversationId)) {
            return s.activeConversationId;
          }
          const recent = sortedByRecent(s.conversations)[0];
          if (recent) {
            set((state) => {
              state.activeConversationId = recent.id;
            });
            syncMirror();
            return recent.id;
          }
          return get().newConversation();
        },

        selectConversation: (id) => {
          if (!get().conversations.some((c) => c.id === id)) return;
          set((state) => {
            state.activeConversationId = id;
          });
          syncMirror();
        },

        deleteConversation: (id) => {
          set((state) => {
            state.conversations = state.conversations.filter((c) => c.id !== id);
            delete state.inFlight[id];
            state.isProcessing = Object.keys(state.inFlight).length > 0;
            if (state.activeConversationId === id) {
              state.activeConversationId = sortedByRecent(state.conversations)[0]?.id ?? null;
            }
          });
          syncMirror();
        },

        clearConversation: (id) => {
          const target = id ?? get().activeConversationId;
          if (!target) return;
          const nowIso = new Date().toISOString();
          set((state) => {
            const conv = state.conversations.find((c) => c.id === target);
            if (!conv) return;
            conv.messages = [];
            conv.title = NEXUS_DEFAULT_CONVERSATION_TITLE;
            conv.updatedAt = nowIso;
          });
          syncMirror();
        },

        renameConversation: (id, title) => {
          const clean = title.replace(/\s+/g, ' ').trim().slice(0, 60);
          if (!clean) return;
          set((state) => {
            const conv = state.conversations.find((c) => c.id === id);
            if (conv) conv.title = clean;
          });
        },

        appendMessage: (conversationId, message) => {
          const id = generateId('msg');
          const nowIso = new Date().toISOString();
          set((state) => {
            const conv = state.conversations.find((c) => c.id === conversationId);
            if (!conv) return; // conversation deleted while a request was in flight
            const entry: NexusMessage = {
              id,
              role: message.role,
              content: message.content.slice(0, MAX_STORED_MESSAGE_CHARS),
              timestamp: nowIso,
            };
            if (message.source) entry.source = message.source;
            if (message.via) entry.via = message.via;
            if (message.actions && message.actions.length > 0) entry.actions = message.actions;
            conv.messages.push(entry);
            if (conv.messages.length > NEXUS_MAX_MESSAGES_PER_CONVERSATION) {
              conv.messages.splice(0, conv.messages.length - NEXUS_MAX_MESSAGES_PER_CONVERSATION);
            }
            conv.updatedAt = nowIso;
            if (message.role === 'user' && conv.title === NEXUS_DEFAULT_CONVERSATION_TITLE) {
              conv.title = titleFrom(message.content);
            }
          });
          syncMirror();
          return id;
        },

        beginRequest: (conversationId) =>
          set((state) => {
            state.inFlight[conversationId] = (state.inFlight[conversationId] ?? 0) + 1;
            state.isProcessing = true;
          }),

        endRequest: (conversationId) =>
          set((state) => {
            const next = (state.inFlight[conversationId] ?? 0) - 1;
            if (next > 0) state.inFlight[conversationId] = next;
            else delete state.inFlight[conversationId];
            state.isProcessing = Object.keys(state.inFlight).length > 0;
          }),

        // ── Legacy ──
        addMessage: (role, content) => {
          const conversationId = get().ensureConversation();
          get().appendMessage(conversationId, { role, content });
        },

        setContext: (context) =>
          set((state) => {
            Object.assign(state.context, context);
          }),

        setMood: (mood) =>
          set((state) => {
            state.mood = mood;
          }),

        setProcessing: (processing) =>
          set((state) => {
            state.isProcessing = processing;
          }),

        toggleOpen: () =>
          set((state) => {
            state.isOpen = !state.isOpen;
          }),

        setOpen: (open) =>
          set((state) => {
            state.isOpen = open;
          }),

        clearHistory: () => get().clearConversation(),

        // ── Preferences ──
        setContextEnabled: (enabled) =>
          set((state) => {
            state.contextEnabled = enabled;
          }),
        toggleContext: () =>
          set((state) => {
            state.contextEnabled = !state.contextEnabled;
          }),
        setVoiceReplies: (enabled) =>
          set((state) => {
            state.voiceReplies = enabled;
          }),
        toggleVoiceReplies: () =>
          set((state) => {
            state.voiceReplies = !state.voiceReplies;
          }),
        setSuggestionsEnabled: (enabled) =>
          set((state) => {
            state.suggestionsEnabled = enabled;
          }),
        toggleSuggestions: () =>
          set((state) => {
            state.suggestionsEnabled = !state.suggestionsEnabled;
          }),

        // ── Pomodoro ──
        startPomodoro: (focusMinutes, breakMinutes) => {
          const now = Date.now();
          set((state) => {
            const p = state.pomodoro;
            rollPomodoroDay(p, now);
            p.focusMinutes = clampMinutes(focusMinutes ?? p.focusMinutes, 1, 180);
            p.breakMinutes = clampMinutes(breakMinutes ?? p.breakMinutes, 1, 60);
            p.phase = 'focus';
            p.phaseDurationMs = p.focusMinutes * 60_000;
            p.endsAt = now + p.phaseDurationMs;
            p.pausedRemainingMs = null;
          });
        },

        pausePomodoro: () => {
          const now = Date.now();
          set((state) => {
            const p = state.pomodoro;
            if (p.phase === 'idle' || p.endsAt === null) return;
            p.pausedRemainingMs = Math.max(0, p.endsAt - now);
            p.endsAt = null;
          });
        },

        resumePomodoro: () => {
          const now = Date.now();
          set((state) => {
            const p = state.pomodoro;
            if (p.phase === 'idle' || p.pausedRemainingMs === null) return;
            p.endsAt = now + p.pausedRemainingMs;
            p.pausedRemainingMs = null;
          });
        },

        stopPomodoro: () =>
          set((state) => {
            const p = state.pomodoro;
            p.phase = 'idle';
            p.endsAt = null;
            p.pausedRemainingMs = null;
            p.phaseDurationMs = 0;
          }),

        setPomodoroDurations: (focusMinutes, breakMinutes) =>
          set((state) => {
            state.pomodoro.focusMinutes = clampMinutes(focusMinutes, 1, 180);
            state.pomodoro.breakMinutes = clampMinutes(breakMinutes, 1, 60);
          }),

        advancePomodoro: (now) => {
          const p = get().pomodoro;
          if (p.phase === 'idle' || p.endsAt === null || now < p.endsAt) return null;
          const endedAt = p.endsAt;
          const lateMs = now - endedAt;
          const late = lateMs > POMODORO_LATE_MS;

          if (p.phase === 'focus') {
            const breakMs = p.breakMinutes * 60_000;
            set((state) => {
              const d = state.pomodoro;
              rollPomodoroDay(d, now);
              if (!late) {
                d.completedToday += 1;
                d.focusMinutesToday += d.focusMinutes;
                d.totalCompleted += 1;
              }
              if (lateMs >= breakMs) {
                d.phase = 'idle';
                d.endsAt = null;
                d.phaseDurationMs = 0;
              } else {
                d.phase = 'break';
                d.phaseDurationMs = breakMs;
                d.endsAt = endedAt + breakMs;
              }
              d.pausedRemainingMs = null;
            });
            return { completed: 'focus', late, focusMinutes: p.focusMinutes, breakMinutes: p.breakMinutes };
          }

          set((state) => {
            const d = state.pomodoro;
            d.phase = 'idle';
            d.endsAt = null;
            d.pausedRemainingMs = null;
            d.phaseDurationMs = 0;
          });
          return { completed: 'break', late, focusMinutes: p.focusMinutes, breakMinutes: p.breakMinutes };
        },

        // ── Suggestions / nudges ──
        recordSuggestion: (ruleId, at) =>
          set((state) => {
            state.lastSuggestionAt = at;
            state.lastSuggestionId = ruleId;
            state.ruleLastFired[ruleId] = at;
          }),

        pushNudge: (nudge) => {
          const id = generateId('nudge');
          set((state) => {
            state.nudges.unshift({ ...nudge, id });
            if (state.nudges.length > NEXUS_MAX_NUDGES) {
              state.nudges.splice(NEXUS_MAX_NUDGES);
            }
          });
        },

        dismissNudge: (id) =>
          set((state) => {
            state.nudges = state.nudges.filter((n) => n.id !== id);
          }),

        clearNudges: () =>
          set((state) => {
            state.nudges = [];
          }),
      };
    }),
    {
      name: 'warrior-os-nexus',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state): PersistedNexus => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        contextEnabled: state.contextEnabled,
        voiceReplies: state.voiceReplies,
        suggestionsEnabled: state.suggestionsEnabled,
        pomodoro: state.pomodoro,
        lastSuggestionAt: state.lastSuggestionAt,
        lastSuggestionId: state.lastSuggestionId,
        ruleLastFired: state.ruleLastFired,
        nudges: state.nudges,
      }),
      merge: (persisted, current) => {
        const merged: NexusStore = { ...current, ...sanitizePersisted(persisted) };
        const active = merged.conversations.find((c) => c.id === merged.activeConversationId);
        merged.messages = active ? active.messages : EMPTY_MESSAGES;
        return merged;
      },
    }
  )
);

/** Stable selector helper: messages of the active conversation. */
export function selectActiveMessages(state: NexusStore): NexusMessage[] {
  const active = state.conversations.find((c) => c.id === state.activeConversationId);
  return active ? active.messages : EMPTY_MESSAGES;
}
