// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Audio Store
// Manages audio state and frequency analysis data
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface AudioStore {
  isPlaying: boolean;
  currentTrack: string | null;
  trackTitle: string;
  volume: number;
  // Frequency analysis bands (updated by audio analyser)
  bassLevel: number;     // 0-1
  midsLevel: number;     // 0-1
  highsLevel: number;    // 0-1
  overallLevel: number;  // 0-1

  // Actions
  setPlaying: (playing: boolean) => void;
  setTrack: (url: string, title: string) => void;
  setVolume: (volume: number) => void;
  setFrequencyData: (bass: number, mids: number, highs: number) => void;
  clearTrack: () => void;
}

export const useAudioStore = create<AudioStore>()(
  immer((set) => ({
    isPlaying: false,
    currentTrack: null,
    trackTitle: '',
    volume: 0.5,
    bassLevel: 0,
    midsLevel: 0,
    highsLevel: 0,
    overallLevel: 0,

    setPlaying: (playing) => set((s) => { s.isPlaying = playing; }),

    setTrack: (url, title) => set((s) => {
      s.currentTrack = url;
      s.trackTitle = title;
      s.isPlaying = true;
    }),

    setVolume: (volume) => set((s) => { s.volume = volume; }),

    setFrequencyData: (bass, mids, highs) => set((s) => {
      s.bassLevel = bass;
      s.midsLevel = mids;
      s.highsLevel = highs;
      s.overallLevel = (bass + mids + highs) / 3;
    }),

    clearTrack: () => set((s) => {
      s.currentTrack = null;
      s.trackTitle = '';
      s.isPlaying = false;
      s.bassLevel = 0;
      s.midsLevel = 0;
      s.highsLevel = 0;
      s.overallLevel = 0;
    }),
  }))
);
