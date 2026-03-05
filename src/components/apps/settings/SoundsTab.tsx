// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Sounds Tab
// Sound effects + music volume controls
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/useSettingsStore';

function SoundsTabInner() {
  const {
    soundEnabled, soundVolume, musicEnabled, musicVolume,
    toggleSound, setSoundVolume, toggleMusic, setMusicVolume,
  } = useSettingsStore();

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">Sounds</h3>

      {/* Sound Effects */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Sound Effects</span>
          <button
            onClick={toggleSound}
            className={cn(
              'w-10 h-5 rounded-full transition-all relative',
              soundEnabled ? 'bg-cyan-500' : 'bg-white/20'
            )}
          >
            <div className={cn(
              'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all',
              soundEnabled ? 'left-5.5' : 'left-0.5'
            )} />
          </button>
        </div>
        {soundEnabled && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs text-white/50">Volume</label>
              <span className="text-xs text-white/40">{Math.round(soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={soundVolume}
              onChange={(e) => setSoundVolume(Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>
        )}
      </section>

      {/* Music */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Background Music</span>
          <button
            onClick={toggleMusic}
            className={cn(
              'w-10 h-5 rounded-full transition-all relative',
              musicEnabled ? 'bg-purple-500' : 'bg-white/20'
            )}
          >
            <div className={cn(
              'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all',
              musicEnabled ? 'left-5.5' : 'left-0.5'
            )} />
          </button>
        </div>
        {musicEnabled && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs text-white/50">Volume</label>
              <span className="text-xs text-white/40">{Math.round(musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
        )}
      </section>

      <p className="text-xs text-white/30">
        Sound effects play on window open/close, notifications, and OS interactions.
        Background music plays while using the OS.
      </p>
    </div>
  );
}

export const SoundsTab = memo(SoundsTabInner);
