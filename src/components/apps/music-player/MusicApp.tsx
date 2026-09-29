// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Music Player App (WarBeats) · FORGED ARMOR
// Two tabs under one header:
//   Procedural — the OS composes for you (Tone.js engine, 4 moods)
//   Library    — your own audio files, stored on this device
// Both stay mounted so switching tabs never cuts the music.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Library, Sparkles } from 'lucide-react';
import { AppHeader, AppIcon, Badge, Tabs } from '@/components/ui';
import { useMusicGenStore } from '@/stores/useMusicGenStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { MOOD_LABELS } from '@/lib/procedural-music/engine';
import { TRANSITION } from '@/styles/tokens';
import { ProceduralMusicPlayer } from '@/components/music/ProceduralMusicPlayer';
import { LocalLibrary } from './LocalLibrary';

type MusicTab = 'procedural' | 'library';

const TABS = [
  { id: 'procedural', label: 'Procedural', icon: Sparkles },
  { id: 'library', label: 'Library', icon: Library },
];

/** Live status for the header: what is making sound right now. */
function useHeaderStatus(): { text: string; badge: React.ReactNode } {
  const status = useMusicGenStore((s) => s.status);
  const mood = useMusicGenStore((s) => s.currentMood);
  const isGenerating = useMusicGenStore((s) => s.isGenerating);
  const fileTitle = useAudioStore((s) => s.trackTitle);
  const filePlaying = useAudioStore((s) => s.isPlaying);

  if (isGenerating && status === 'playing') {
    return {
      text: `Composing · ${MOOD_LABELS[mood]}`,
      badge: (
        <Badge tone="success" dot pulse>
          Live
        </Badge>
      ),
    };
  }
  if (isGenerating && status === 'starting') {
    return { text: `Warming up · ${MOOD_LABELS[mood]}`, badge: <Badge tone="warning" dot>Starting</Badge> };
  }
  if (status === 'error') return { text: 'Engine error', badge: <Badge tone="danger" dot>Error</Badge> };
  if (filePlaying && fileTitle && !fileTitle.startsWith('Procedural')) {
    return {
      text: `Playing · ${fileTitle}`,
      badge: (
        <Badge tone="success" dot pulse>
          Live
        </Badge>
      ),
    };
  }
  return { text: `Idle · ${MOOD_LABELS[mood]}`, badge: null };
}

function MusicAppInner() {
  const [tab, setTab] = useState<MusicTab>('procedural');
  const reduceMotion = useReducedMotion();
  const header = useHeaderStatus();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-ink-950/25 text-ui text-fg">
      <AppHeader
        leading={<AppIcon appId="music-player" size={28} active />}
        title="WarBeats"
        subtitle={<span title={header.text}>{header.text}</span>}
        actions={header.badge}
        tabs={
          <Tabs
            aria-label="Music"
            idPrefix="warbeats"
            value={tab}
            onChange={(id) => setTab(id === 'library' ? 'library' : 'procedural')}
            tabs={TABS}
            size="sm"
          />
        }
      />

      <div className="relative min-h-0 flex-1">
        {TABS.map(({ id }) => {
          const active = tab === id;
          return (
            <motion.div
              key={id}
              id={`warbeats-panel-${id}`}
              role="tabpanel"
              aria-labelledby={`warbeats-tab-${id}`}
              aria-hidden={!active}
              className="absolute inset-0"
              initial={false}
              animate={
                active
                  ? { opacity: 1, x: 0, visibility: 'visible' }
                  : { opacity: 0, x: reduceMotion ? 0 : -6, transitionEnd: { visibility: 'hidden' } }
              }
              transition={TRANSITION.small}
              style={{ pointerEvents: active ? 'auto' : 'none' }}
            >
              {id === 'procedural' ? <ProceduralMusicPlayer /> : <LocalLibrary />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export const MusicApp = memo(MusicAppInner);
