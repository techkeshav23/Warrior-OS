// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Appearance Tab
// Wallpaper, accent color, glass opacity, CRT, cursor trail
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLiteMode } from '@/lib/lite-mode';

const ACCENT_COLORS = [
  { label: 'Cyan', value: '#00f0ff' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Yellow', value: '#eab308' },
];

/**
 * Exactly the wallpapers WallpaperEngine can draw (its WALLPAPER_COMPONENTS
 * keys). Any other saved id renders as Void there, so it shows as Void here.
 */
const WALLPAPERS = [
  { id: 'nebula', label: 'Nebula', hint: 'Shader' },
  { id: 'aurora', label: 'Aurora', hint: 'Shader' },
  { id: 'fluid', label: 'Fluid', hint: 'Shader · interactive' },
  { id: 'starfield', label: 'Starfield', hint: 'Canvas' },
  { id: 'matrix', label: 'Matrix Rain', hint: 'Canvas' },
  { id: 'neural', label: 'Neural Net', hint: 'Canvas' },
  { id: 'void', label: 'Void', hint: 'CSS · lightest' },
] as const;

const FALLBACK_WALLPAPER = 'void';

function isKnownWallpaper(id: string): boolean {
  return WALLPAPERS.some((w) => w.id === id);
}

function AppearanceTabInner() {
  const {
    wallpaper, accentColor, glassOpacity, crtEffect, cursorTrail, adaptiveWallpaper,
    ghostWarriors, phantomWindows, dreams, biometricsEnabled,
    setWallpaper, setAccentColor, setGlassOpacity, toggleCRT, toggleCursorTrail, toggleAdaptiveWallpaper,
    toggleGhostWarriors, togglePhantomWindows, toggleDreams, toggleBiometrics,
  } = useSettingsStore();
  const lite = useLiteMode();
  const activeWallpaper = isKnownWallpaper(wallpaper) ? wallpaper : FALLBACK_WALLPAPER;

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">Appearance</h3>

      {/* Lite mode keeps the GPU-heavy visuals off whatever is chosen here */}
      {lite && (
        <div
          role="note"
          data-testid="appearance-lite-note"
          className="flex gap-3 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3"
        >
          <span
            aria-hidden
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
          />
          <div className="space-y-1">
            <p className="text-sm text-cyan-100">Lite mode is on</p>
            <p className="text-[11px] text-white/50">
              The wallpaper stays a still Void background, and CRT scanlines and the cursor trail
              stay off. Your choices below are kept for when lite mode is off (Settings → Performance).
            </p>
          </div>
        </div>
      )}

      {/* Wallpaper */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">Wallpaper</label>
        <div role="group" aria-label="Wallpaper" className="grid grid-cols-3 gap-2">
          {WALLPAPERS.map((w) => {
            const selected = activeWallpaper === w.id;
            return (
              <button
                key={w.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setWallpaper(w.id)}
                className={cn(
                  'p-3 rounded-lg border text-xs text-center transition-all',
                  selected
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                )}
              >
                <span className="block">{w.label}</span>
                <span className="block text-[10px] text-white/40">{w.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Accent Color */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">Accent Color</label>
        <div role="group" aria-label="Accent color" className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              aria-pressed={accentColor === c.value}
              onClick={() => setAccentColor(c.value)}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-all',
                accentColor === c.value ? 'border-white scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>
      </section>

      {/* Glass Opacity */}
      <section className="space-y-2">
        <div className="flex justify-between">
          <label htmlFor="appearance-glass-opacity" className="text-xs text-white/60 font-semibold">
            Glass Opacity
          </label>
          <span className="text-xs text-white/40">{Math.round(glassOpacity * 100)}%</span>
        </div>
        <input
          id="appearance-glass-opacity"
          type="range"
          min={0.3}
          max={0.9}
          step={0.05}
          value={glassOpacity}
          onChange={(e) => setGlassOpacity(Number(e.target.value))}
          className="w-full accent-cyan-500"
        />
      </section>

      {/* Toggles */}
      <section className="space-y-3">
        <ToggleRow label="CRT Scanlines" enabled={crtEffect} onToggle={toggleCRT} note={lite ? 'Off in lite mode' : undefined} />
        <ToggleRow label="Cursor Trail" enabled={cursorTrail} onToggle={toggleCursorTrail} note={lite ? 'Off in lite mode' : undefined} />
        <ToggleRow label="Adaptive Wallpaper" enabled={adaptiveWallpaper} onToggle={toggleAdaptiveWallpaper} />
      </section>

      {/* Living OS features */}
      <section className="space-y-3">
        <label className="text-xs text-white/60 font-semibold">Living OS</label>
        <ToggleRow label="Ghost Warriors" enabled={ghostWarriors} onToggle={toggleGhostWarriors} />
        <ToggleRow label="Phantom Windows" enabled={phantomWindows} onToggle={togglePhantomWindows} />
        <ToggleRow label="NEXUS Dreams" enabled={dreams} onToggle={toggleDreams} />
        <ToggleRow label="Typing Biometrics" enabled={biometricsEnabled} onToggle={toggleBiometrics} />
      </section>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  /** Small muted remark after the label (e.g. "Off in lite mode"). */
  note?: string;
}

function ToggleRow({ label, enabled, onToggle, note }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/70">
        {label}
        {note && <span className="ml-2 text-[10px] text-cyan-300/70">{note}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          'w-10 h-5 rounded-full transition-all relative',
          enabled ? 'bg-cyan-500' : 'bg-white/20'
        )}
      >
        <span
          className={cn(
            'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all',
            enabled ? 'left-5.5' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

export const AppearanceTab = memo(AppearanceTabInner);
