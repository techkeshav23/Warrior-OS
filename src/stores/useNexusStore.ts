// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Store
// The AI brain state management
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { NexusMessage, NexusContext, NexusMood } from '@/types/nexus';
import { generateId } from '@/lib/utils';

interface NexusStore {
  messages: NexusMessage[];
  context: NexusContext;
  mood: NexusMood;
  isProcessing: boolean;
  isOpen: boolean;

  // Actions
  addMessage: (role: 'user' | 'nexus' | 'system', content: string) => void;
  setContext: (context: Partial<NexusContext>) => void;
  setMood: (mood: NexusMood) => void;
  setProcessing: (processing: boolean) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  clearHistory: () => void;
}

export const useNexusStore = create<NexusStore>()(
  immer((set) => ({
    messages: [],
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
    isProcessing: false,
    isOpen: false,

    addMessage: (role, content) =>
      set((state) => {
        state.messages.push({
          id: generateId('msg'),
          role,
          content,
          timestamp: new Date().toISOString(),
        });
        // Keep last 100 messages in memory
        if (state.messages.length > 100) {
          state.messages = state.messages.slice(-100);
        }
      }),

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

    clearHistory: () =>
      set((state) => {
        state.messages = [];
      }),
  }))
);
