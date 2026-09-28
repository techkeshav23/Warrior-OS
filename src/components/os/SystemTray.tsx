// ═══════════════════════════════════════════════════════════
// WARRIOR OS — SystemTray Component (FORGE HUD)
// Compact tray with indicators and a Quick Settings popover (volume
// slider + sound / network toggles). The Taskbar renders its own tray;
// this stays exported for other shells.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Battery, Volume2, VolumeX, Wifi } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useClock } from '@/hooks/useClock';
import { IconButton } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { cn } from '@/lib/utils';

interface SystemTrayProps {
  onNotificationClick?: () => void;
}

export function SystemTray({ onNotificationClick: _onNotificationClick }: SystemTrayProps) {
  const [expanded, setExpanded] = useState(false);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const toggleSound = useSettingsStore((s) => s.toggleSound);
  const soundVolume = useSettingsStore((s) => s.soundVolume);
  const setSoundVolume = useSettingsStore((s) => s.setSoundVolume);
  const { timeShort } = useClock();

  return (
    <div className="relative flex items-center gap-0.5">
      {/* Sound toggle */}
      <IconButton
        icon={soundEnabled ? Volume2 : VolumeX}
        onClick={toggleSound}
        aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
        aria-pressed={!soundEnabled}
        tooltip={soundEnabled ? 'Sound on' : 'Sound off'}
      />

      {/* Wifi indicator */}
      <IconButton icon={Wifi} aria-label="Network" tooltip="Network" />

      {/* Battery indicator */}
      <div className="flex h-8 items-center gap-1 px-1.5 text-fg-muted" role="img" aria-label="Battery 100%">
        <Battery size={16} strokeWidth={1.75} aria-hidden className="text-success" />
        <span className="tabular font-mono text-2xs">100%</span>
      </div>

      {/* Clock */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className={cn(
          'flex h-8 items-center rounded-control px-2 text-fg-muted transition-colors duration-120 ease-out-quint focus-ring',
          expanded ? 'bg-surface-active text-fg' : 'hover:bg-surface-hover hover:text-fg'
        )}
      >
        <span className="tabular font-mono text-xs">{timeShort}</span>
      </button>

      {/* Quick Settings Popup */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="glass-popover absolute bottom-full right-0 mb-2 w-64 rounded-card p-4"
            role="dialog"
            aria-label="Quick settings"
          >
            <p className="hud-label mb-3">Quick settings</p>

            {/* Volume slider */}
            <Slider
              label="Volume"
              min={0}
              max={1}
              step={0.05}
              value={soundVolume}
              onValueChange={setSoundVolume}
              formatValue={(v) => `${Math.round(v * 100)}`}
              wrapperClassName="mb-4"
            />

            {/* Toggle tiles */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={soundEnabled}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-control border px-3 text-xs font-medium transition-colors duration-120 ease-out-quint focus-ring',
                  soundEnabled
                    ? 'border-accent/30 bg-accent/12 text-accent'
                    : 'border-line-strong bg-surface-2 text-fg-muted hover:bg-surface-hover hover:text-fg'
                )}
              >
                <Volume2 size={14} strokeWidth={1.75} aria-hidden />
                Sound
              </button>
              <button
                type="button"
                className="flex h-9 items-center gap-2 rounded-control border border-line-strong bg-surface-2 px-3 text-xs font-medium text-fg-muted transition-colors duration-120 ease-out-quint hover:bg-surface-hover hover:text-fg focus-ring"
              >
                <Wifi size={14} strokeWidth={1.75} aria-hidden />
                Network
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
