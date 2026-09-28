// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Voice Live Store
// In-memory (never persisted) state of the Web Speech session:
// mic status, interim transcript, speaking flag, errors.
// Kept separate from useNexusStore so rapid interim updates do
// not rewrite the persisted conversation blob.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { NexusVoiceState } from '@/types/nexus';

interface NexusVoiceStore extends NexusVoiceState {
  patch: (partial: Partial<NexusVoiceState>) => void;
  reset: () => void;
}

const INITIAL_VOICE: NexusVoiceState = {
  supported: null,
  mode: 'off',
  wakeEnabled: false,
  micActive: false,
  capturing: false,
  processing: false,
  speaking: false,
  interim: '',
  lastHeard: '',
  lastReply: '',
  error: null,
};

export const useNexusVoiceStore = create<NexusVoiceStore>()((set) => ({
  ...INITIAL_VOICE,
  patch: (partial) => set(partial),
  reset: () => set((state) => ({ ...INITIAL_VOICE, supported: state.supported })),
}));
