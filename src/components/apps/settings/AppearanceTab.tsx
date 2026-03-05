// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Appearance Tab
// Wallpaper, accent color, glass opacity, CRT, cursor trail
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/useSettingsStore';

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

const WALLPAPERS = [
  { id: 'nebula', label: 'Nebula' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'gradient-dark', label: 'Dark Gradient' },
  { id: 'cyber-grid', label: 'Cyber Grid' },
  { id: 'deep-space', label: 'Deep Space' },
  { id: 'aurora', label: 'Aurora' },
];

function AppearanceTabInner() {
  const {
    wallpaper, accentColor, glassOpacity, crtEffect, cursorTrail, adaptiveWallpaper,
    setWallpaper, setAccentColor, setGlassOpacity, toggleCRT, toggleCursorTrail, toggleAdaptiveWallpaper,
  } = useSettingsStore();

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">Appearance</h3>

      {/* Wallpaper */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">Wallpaper</label>
        <div className="grid grid-cols-3 gap-2">
          {WALLPAPERS.map((w) => (
            <button
              key={w.id}
              onClick={() => setWallpaper(w.id)}
              className={cn(
                'p-3 rounded-lg border text-xs text-center transition-all',
                wallpaper === w.id
                  ? 'bg-white/15 border-white/30 text-white'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </section>

      {/* Accent Color */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">Accent Color</label>
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.value}
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
          <label className="text-xs text-white/60 font-semibold">Glass Opacity</label>
          <span className="text-xs text-white/40">{Math.round(glassOpacity * 100)}%</span>
        </div>
        <input
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
        <ToggleRow label="CRT Scanlines" enabled={crtEffect} onToggle={toggleCRT} />
        <ToggleRow label="Cursor Trail" enabled={cursorTrail} onToggle={toggleCursorTrail} />
        <ToggleRow label="Adaptive Wallpaper" enabled={adaptiveWallpaper} onToggle={toggleAdaptiveWallpaper} />
      </section>
    </div>
  );
}

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/70">{label}</span>
      <button
        onClick={onToggle}
        className={cn(
          'w-10 h-5 rounded-full transition-all relative',
          enabled ? 'bg-cyan-500' : 'bg-white/20'
        )}
      >
        <div
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
