// ═══════════════════════════════════════════════════════════
// WARRIOR OS — SystemTray Component
// System tray with indicators and quick controls
// ═══════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Wifi, Battery, Sun, Moon } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useClock } from '@/hooks/useClock';
import { cn } from '@/lib/utils';

interface SystemTrayProps {
  onNotificationClick?: () => void;
}

export function SystemTray({ onNotificationClick }: SystemTrayProps) {
  const [expanded, setExpanded] = useState(false);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const toggleSound = useSettingsStore((s) => s.toggleSound);
  const soundVolume = useSettingsStore((s) => s.soundVolume);
  const setSoundVolume = useSettingsStore((s) => s.setSoundVolume);
  const { timeShort } = useClock();

  return (
    <div className="relative flex items-center gap-1">
      {/* Sound toggle */}
      <button
        onClick={toggleSound}
        className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
      >
        {soundEnabled ? (
          <Volume2 className="w-3.5 h-3.5" />
        ) : (
          <VolumeX className="w-3.5 h-3.5 text-accent-danger" />
        )}
      </button>

      {/* Wifi indicator */}
      <button className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors">
        <Wifi className="w-3.5 h-3.5" />
      </button>

      {/* Battery indicator */}
      <div className="p-1.5 flex items-center gap-1">
        <Battery className="w-3.5 h-3.5 text-accent-success" />
        <span className="text-[9px] font-mono text-text-muted">100%</span>
      </div>

      {/* Clock */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="px-2 py-1 rounded-[var(--radius-sm)] text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
      >
        <span className="text-xs font-mono">{timeShort}</span>
      </button>

      {/* Quick Settings Popup */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute bottom-full right-0 mb-2 w-64 rounded-[var(--radius-lg)] p-4"
            style={{
              background: 'rgba(12, 12, 20, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
            }}
          >
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-3">
              Quick Settings
            </p>

            {/* Volume slider */}
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                className="flex-1 h-1 appearance-none bg-white/10 rounded-full cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-primary"
              />
              <span className="text-[9px] font-mono text-text-muted w-6 text-right">
                {Math.round(soundVolume * 100)}
              </span>
            </div>

            {/* Toggle buttons */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={toggleSound}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)]',
                  'text-[10px] font-mono transition-colors',
                  soundEnabled
                    ? 'bg-accent-primary/10 text-accent-primary'
                    : 'bg-white/5 text-text-muted'
                )}
              >
                <Volume2 className="w-3 h-3" />
                Sound
              </button>
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] bg-white/5 text-text-muted text-[10px] font-mono"
              >
                <Wifi className="w-3 h-3" />
                Network
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
