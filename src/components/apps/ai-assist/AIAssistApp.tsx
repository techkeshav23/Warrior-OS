// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AI Assist App (NEXUS AI window)
// Full NEXUS chat as a windowed app: persisted conversation list
// (docked on wide windows, slide-over drawer on narrow ones),
// new/clear chat, OS-context toggle, voice controls and the chat
// interface. Checks whether the server has a Gemini key so the UI
// can honestly show "AI offline — local commands only".
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ConversationList } from './ConversationList';
import { ChatInterface, type NexusAIStatus } from './ChatInterface';
import { fetchNexusAIStatus } from '@/lib/nexus/ai-client';
import { TRANSITION } from '@/styles/tokens';

function AIAssistAppInner() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<NexusAIStatus>('checking');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    void fetchNexusAIStatus().then((status) => {
      if (cancelled) return;
      setAiStatus(status === null ? 'unknown' : status.configured ? 'online' : 'offline');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="@container relative flex h-full overflow-hidden bg-ink-900/75 text-fg lite:bg-ink-900">
      {/* Docked conversation list (wide windows) */}
      <aside
        aria-label="Conversations"
        className="hidden w-58 shrink-0 flex-col border-r border-line bg-ink-950/35 @min-[680px]:flex"
      >
        <ConversationList />
      </aside>

      {/* Slide-over drawer (narrow windows) */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="nexus-drawer-scrim"
            className="absolute inset-0 z-20 bg-ink-950/60 @min-[680px]:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION.small}
            onClick={() => setDrawerOpen(false)}
          />
        )}
        {drawerOpen && (
          <motion.aside
            key="nexus-drawer"
            aria-label="Conversations"
            className="absolute inset-y-0 left-0 z-30 flex w-64 max-w-[85%] flex-col border-r border-line-strong bg-ink-900 shadow-e3 @min-[680px]:hidden"
            initial={reduceMotion ? { opacity: 0 } : { x: '-100%' }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: '-100%' }}
            transition={TRANSITION.panel}
          >
            <ConversationList onNavigate={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} />
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatInterface aiStatus={aiStatus} onToggleSidebar={() => setDrawerOpen((open) => !open)} />
      </main>
    </div>
  );
}

export const AIAssistApp = memo(AIAssistAppInner);
