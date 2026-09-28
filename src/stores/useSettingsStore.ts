// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Settings Store
// Manages all user-configurable settings
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Display
  wallpaper: string;
  accentColor: string;
  glassOpacity: number;     // 0.3 - 0.9
  crtEffect: boolean;
  cursorTrail: boolean;

  // Audio
  soundEnabled: boolean;
  soundVolume: number;       // 0 - 1
  musicEnabled: boolean;
  musicVolume: number;       // 0 - 1

  // Behavior
  autoLock: boolean;
  autoLockTimeout: number;   // minutes
  adaptiveWallpaper: boolean; // auto-switch by time

  // Phase 6 features
  ghostWarriors: boolean;     // anonymous multiplayer presence overlay
  phantomWindows: boolean;    // ghosts of closed apps
  dreams: boolean;            // NEXUS cinematic recap on login
  biometricsEnabled: boolean; // typing biometrics tracking

  // Actions
  setWallpaper: (id: string) => void;
  setAccentColor: (color: string) => void;
  setGlassOpacity: (opacity: number) => void;
  toggleCRT: () => void;
  toggleCursorTrail: () => void;
  toggleSound: () => void;
  setSoundVolume: (volume: number) => void;
  toggleMusic: () => void;
  setMusicVolume: (volume: number) => void;
  toggleAutoLock: () => void;
  setAutoLockTimeout: (minutes: number) => void;
  toggleAdaptiveWallpaper: () => void;
  toggleGhostWarriors: () => void;
  togglePhantomWindows: () => void;
  toggleDreams: () => void;
  toggleBiometrics: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      // Defaults
      wallpaper: 'nebula',
      accentColor: '#00f0ff',
      glassOpacity: 0.6,
      crtEffect: true,
      cursorTrail: true,
      soundEnabled: true,
      soundVolume: 0.5,
      musicEnabled: true,
      musicVolume: 0.3,
      autoLock: false,
      autoLockTimeout: 10,
      adaptiveWallpaper: true,
      ghostWarriors: true,
      phantomWindows: true,
      dreams: true,
      biometricsEnabled: true,

      setWallpaper: (id) => set((s) => { s.wallpaper = id; }),
      setAccentColor: (color) => set((s) => { s.accentColor = color; }),
      setGlassOpacity: (opacity) => set((s) => { s.glassOpacity = opacity; }),
      toggleCRT: () => set((s) => { s.crtEffect = !s.crtEffect; }),
      toggleCursorTrail: () => set((s) => { s.cursorTrail = !s.cursorTrail; }),
      toggleSound: () => set((s) => { s.soundEnabled = !s.soundEnabled; }),
      setSoundVolume: (volume) => set((s) => { s.soundVolume = volume; }),
      toggleMusic: () => set((s) => { s.musicEnabled = !s.musicEnabled; }),
      setMusicVolume: (volume) => set((s) => { s.musicVolume = volume; }),
      toggleAutoLock: () => set((s) => { s.autoLock = !s.autoLock; }),
      setAutoLockTimeout: (minutes) => set((s) => { s.autoLockTimeout = minutes; }),
      toggleAdaptiveWallpaper: () => set((s) => { s.adaptiveWallpaper = !s.adaptiveWallpaper; }),
      toggleGhostWarriors: () => set((s) => { s.ghostWarriors = !s.ghostWarriors; }),
      togglePhantomWindows: () => set((s) => { s.phantomWindows = !s.phantomWindows; }),
      toggleDreams: () => set((s) => { s.dreams = !s.dreams; }),
      toggleBiometrics: () => set((s) => { s.biometricsEnabled = !s.biometricsEnabled; }),
    })),
    {
      name: 'warrior-os-settings',
    }
  )
);
