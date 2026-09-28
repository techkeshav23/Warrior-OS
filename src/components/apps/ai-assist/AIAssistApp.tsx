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
import { AnimatePresence, motion } from 'framer-motion';
import { ConversationList } from './ConversationList';
import { ChatInterface, type NexusAIStatus } from './ChatInterface';
import { fetchNexusAIStatus } from '@/lib/nexus/ai-client';

function AIAssistAppInner() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<NexusAIStatus>('checking');

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

  return (
    <div className="@container relative flex h-full overflow-hidden bg-black/30">
      {/* Docked conversation list (wide windows) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-black/25 @min-[680px]:flex">
        <ConversationList />
      </aside>

      {/* Slide-over drawer (narrow windows) */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="nexus-drawer-scrim"
            className="absolute inset-0 z-20 bg-black/55 @min-[680px]:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          />
        )}
        {drawerOpen && (
          <motion.aside
            key="nexus-drawer"
            className="absolute inset-y-0 left-0 z-30 flex w-64 max-w-[85%] flex-col border-r border-white/10 shadow-2xl @min-[680px]:hidden"
            style={{ background: 'rgba(10, 10, 18, 0.97)', backdropFilter: 'blur(20px)' }}
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <ConversationList onNavigate={() => setDrawerOpen(false)} />
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
