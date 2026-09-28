// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Music Player App (WarBeats)
// Two tabs:
//   Procedural — the OS composes for you (Tone.js engine, 4 moods)
//   My Library — your own audio files, stored on this device
// Both stay mounted so switching tabs never cuts the music.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProceduralMusicPlayer } from '@/components/music/ProceduralMusicPlayer';
import { LocalLibrary } from './LocalLibrary';

type MusicTab = 'procedural' | 'library';

const TABS: { id: MusicTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'procedural', label: 'Procedural', icon: Sparkles },
  { id: 'library', label: 'My Library', icon: Library },
];

function MusicAppInner() {
  const [tab, setTab] = useState<MusicTab>('procedural');

  return (
    <div className="flex h-full flex-col overflow-hidden bg-black/30 text-text-primary">
      <div className="flex shrink-0 border-b border-white/10 bg-black/20" role="tablist" aria-label="Music">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'relative flex items-center gap-1.5 px-4 py-2 text-xs transition-colors',
              tab === id ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
            {tab === id && (
              <motion.span
                layoutId="music-tab-underline"
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent-primary"
              />
            )}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        {TABS.map(({ id }) => (
          <motion.div
            key={id}
            role="tabpanel"
            className="absolute inset-0"
            initial={false}
            animate={
              tab === id
                ? { opacity: 1, x: 0, visibility: 'visible' }
                : { opacity: 0, x: -10, transitionEnd: { visibility: 'hidden' } }
            }
            transition={{ duration: 0.15 }}
            style={{ pointerEvents: tab === id ? 'auto' : 'none' }}
          >
            {id === 'procedural' ? <ProceduralMusicPlayer /> : <LocalLibrary />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export const MusicApp = memo(MusicAppInner);
