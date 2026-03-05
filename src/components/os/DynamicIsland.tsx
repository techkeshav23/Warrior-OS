// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DynamicIsland Component
// macOS-style morphing pill at top of screen
// Shows contextual info (now playing, notifications, timer)
// ═══════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Bell, Clock } from 'lucide-react';
import { useAudioStore } from '@/stores/useAudioStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { cn } from '@/lib/utils';

type IslandState = 'compact' | 'expanded';

export function DynamicIsland() {
  const [state, setState] = useState<IslandState>('compact');
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const trackTitle = useAudioStore((s) => s.trackTitle);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const hasContent = isPlaying || unreadCount > 0;

  if (!hasContent) return null;

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2"
      style={{ zIndex: 'var(--z-dynamic-island)' }}
    >
      <motion.div
        layout
        onClick={() => setState(state === 'compact' ? 'expanded' : 'compact')}
        className={cn(
          'cursor-pointer overflow-hidden',
          'rounded-full bg-black/90 border border-white/10',
          'backdrop-blur-xl'
        )}
        style={{
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
        initial={false}
        animate={{
          width: state === 'compact' ? 180 : 320,
          height: state === 'compact' ? 32 : 80,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <AnimatePresence mode="wait">
          {state === 'compact' ? (
            <motion.div
              key="compact"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between h-full px-4"
            >
              {/* Left indicator */}
              {isPlaying && (
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3 h-3 text-accent-primary" />
                  <span className="text-[10px] font-mono text-text-secondary truncate max-w-[80px]">
                    {trackTitle || 'Playing'}
                  </span>
                </div>
              )}

              {/* Right indicator */}
              {unreadCount > 0 && (
                <div className="flex items-center gap-1">
                  <Bell className="w-3 h-3 text-accent-warning" />
                  <span className="text-[10px] font-mono text-accent-warning">
                    {unreadCount}
                  </span>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col justify-center h-full px-5 py-3"
            >
              {isPlaying && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-accent-primary/10 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-accent-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-mono text-text-primary">
                      {trackTitle || 'Now Playing'}
                    </p>
                    <p className="text-[10px] font-mono text-text-muted">
                      Focus Music
                    </p>
                  </div>
                </div>
              )}

              {unreadCount > 0 && (
                <div className="flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-accent-warning" />
                  <span className="text-[10px] font-mono text-text-secondary">
                    {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
