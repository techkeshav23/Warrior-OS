// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Settings Store
// Manages all user-configurable settings
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { DEFAULT_ACCENT, PREVIOUS_DEFAULT_ACCENT } from '@/styles/tokens';

/**
 * Lite mode (Settings → Performance): 'auto' decides from the device
 * (see src/lib/lite-mode.ts), 'on' always lite, 'off' always full effects.
 */
export type PerformanceMode = 'auto' | 'on' | 'off';

export const PERFORMANCE_MODES: readonly PerformanceMode[] = ['auto', 'on', 'off'];

function isPerformanceMode(value: unknown): value is PerformanceMode {
  return typeof value === 'string' && (PERFORMANCE_MODES as readonly string[]).includes(value);
}

/** Wallpapers WallpaperEngine can draw (keep in sync with its component map). */
export const WALLPAPER_IDS = [
  'void',
  'embers',
  'molten',
  'dusk',
  'steelrain',
  'starfield',
  'nebula',
  'aurora',
  'fluid',
  'matrix',
  'neural',
] as const;

function isWallpaperId(value: unknown): value is string {
  return typeof value === 'string' && (WALLPAPER_IDS as readonly string[]).includes(value);
}

/** Default wallpaper: 'void' (Forge Night, the CSS forge/ember night). */
export const DEFAULT_WALLPAPER = 'void';

/** The pre-FORGED-ARMOR default look, which v2 → v3 moves to the new one. */
const PREVIOUS_DEFAULT_WALLPAPER = 'nebula';
const OLD_DEFAULT_ACCENTS = new Set([PREVIOUS_DEFAULT_ACCENT, '#00f0ff']);

function isOldDefaultAccent(value: unknown): boolean {
  return typeof value === 'string' && OLD_DEFAULT_ACCENTS.has(value.trim().toLowerCase());
}

/** Background slideshow: minutes between wallpapers (0 = off). */
export const SLIDESHOW_INTERVALS = [0, 5, 15, 30, 60] as const;
export type SlideshowInterval = (typeof SLIDESHOW_INTERVALS)[number];
/** Slideshow order: catalog order, or a random other wallpaper each time. */
export type SlideshowOrder = 'order' | 'shuffle';

function isSlideshowInterval(value: unknown): value is SlideshowInterval {
  return typeof value === 'number' && (SLIDESHOW_INTERVALS as readonly number[]).includes(value);
}

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

  // Performance
  performanceMode: PerformanceMode; // lite mode: auto-detect / forced on / forced off

  // Background slideshow (off while adaptive wallpaper or lite mode is on)
  slideshowInterval: SlideshowInterval; // minutes, 0 = off
  slideshowOrder: SlideshowOrder;

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
  setPerformanceMode: (mode: PerformanceMode) => void;
  setSlideshowInterval: (minutes: SlideshowInterval) => void;
  setSlideshowOrder: (order: SlideshowOrder) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      // Defaults
      wallpaper: DEFAULT_WALLPAPER,
      accentColor: DEFAULT_ACCENT,
      glassOpacity: 0.6,
      crtEffect: true,
      cursorTrail: true,
      soundEnabled: true,
      soundVolume: 0.5,
      musicEnabled: true,
      musicVolume: 0.3,
      autoLock: false,
      autoLockTimeout: 10,
      // Off for new installs: it overrides the chosen background and
      // pauses the slideshow. Saved values are kept as they are.
      adaptiveWallpaper: false,
      ghostWarriors: true,
      phantomWindows: true,
      dreams: true,
      biometricsEnabled: true,
      performanceMode: 'auto',
      slideshowInterval: 0,
      slideshowOrder: 'order',

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
      setPerformanceMode: (mode) => set((s) => { s.performanceMode = isPerformanceMode(mode) ? mode : 'auto'; }),
      setSlideshowInterval: (minutes) => set((s) => { s.slideshowInterval = isSlideshowInterval(minutes) ? minutes : 0; }),
      setSlideshowOrder: (order) => set((s) => { s.slideshowOrder = order === 'shuffle' ? 'shuffle' : 'order'; }),
    })),
    {
      name: 'warrior-os-settings',
      version: 4,
      // v0 → v1: adds performanceMode. Existing installs start on 'auto',
      // like new ones; anything unrecognised is reset to 'auto' too.
      // v1 → v2: older Appearance tabs could save wallpaper ids the engine
      // never had (gradient-dark, cyber-grid, deep-space); those go back to
      // the default wallpaper.
      // v2 → v3 (FORGED ARMOR): the old Plasma default accent becomes Ember;
      // an untouched default look (Plasma + Nebula) also moves to the new
      // default wallpaper. Accents a user picked themselves are kept.
      // v3 → v4: adds the background slideshow (off, in order).
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<SettingsState>;
        const oldDefaultLook =
          version < 3 &&
          isOldDefaultAccent(state.accentColor) &&
          (state.wallpaper === undefined || state.wallpaper === PREVIOUS_DEFAULT_WALLPAPER);
        const accentColor =
          version < 3 && (state.accentColor === undefined || isOldDefaultAccent(state.accentColor))
            ? DEFAULT_ACCENT
            : state.accentColor;
        const wallpaper = oldDefaultLook ? DEFAULT_WALLPAPER : state.wallpaper;
        return {
          ...state,
          accentColor,
          wallpaper: isWallpaperId(wallpaper) ? wallpaper : DEFAULT_WALLPAPER,
          performanceMode: isPerformanceMode(state.performanceMode) ? state.performanceMode : 'auto',
          slideshowInterval: isSlideshowInterval(state.slideshowInterval) ? state.slideshowInterval : 0,
          slideshowOrder: state.slideshowOrder === 'shuffle' ? 'shuffle' : 'order',
        } as SettingsState;
      },
    }
  )
);
