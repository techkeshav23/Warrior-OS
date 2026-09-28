// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AI Assist: Conversation List
// Persisted NEXUS chats (newest first) with new / select / delete,
// plus the NEXUS nudge feed (suggestions + 'warrior:nexus-say'
// messages) whose action buttons run through NexusCore.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { Lightbulb, LoaderCircle, MessageSquare, MessageSquarePlus, Trash2, WandSparkles, X } from 'lucide-react';
import { useNexusStore } from '@/stores/useNexusStore';
import { runNexusButton } from '@/components/nexus/NexusCore';
import { formatAgo } from '@/lib/nexus/context';
import { cn } from '@/lib/utils';
import type { NexusConversation, NexusNudge } from '@/types/nexus';

function preview(conversation: NexusConversation): string {
  const last = [...conversation.messages].reverse().find((m) => m.role !== 'system');
  if (!last) return 'No messages yet';
  const text = last.content
    .replace(/```[\s\S]*?(```|$)/g, ' [code] ')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${last.role === 'user' ? 'You: ' : ''}${text}`;
}

const NUDGE_TONE: Record<NexusNudge['tone'], string> = {
  info: 'border-cyan-400/20',
  success: 'border-emerald-400/25',
  warning: 'border-amber-400/25',
  danger: 'border-rose-400/30',
};

interface ConversationListProps {
  /** Called after a chat is picked or created (closes the mobile drawer). */
  onNavigate?: () => void;
}

function ConversationListInner({ onNavigate }: ConversationListProps) {
  const conversations = useNexusStore((s) => s.conversations);
  const activeId = useNexusStore((s) => s.activeConversationId);
  const inFlight = useNexusStore((s) => s.inFlight);
  const nudges = useNexusStore((s) => s.nudges);

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)),
    [conversations]
  );

  // Clock for relative timestamps ("5m ago"), refreshed every minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const createChat = () => {
    useNexusStore.getState().newConversation();
    onNavigate?.();
  };

  const selectChat = (id: string) => {
    useNexusStore.getState().selectConversation(id);
    onNavigate?.();
  };

  const requestDelete = (id: string) => {
    if (confirmDeleteId === id) {
      useNexusStore.getState().deleteConversation(id);
      setConfirmDeleteId(null);
      return;
    }
    setConfirmDeleteId(id);
    window.setTimeout(() => setConfirmDeleteId((current) => (current === id ? null : current)), 3000);
  };

  const runNudge = (nudge: NexusNudge) => {
    if (!nudge.action) return;
    const conversationId = useNexusStore.getState().ensureConversation();
    void runNexusButton(nudge.action, conversationId);
    useNexusStore.getState().dismissNudge(nudge.id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">Chats</span>
        <button
          type="button"
          onClick={createChat}
          className="flex items-center gap-1 rounded-md border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200 transition-colors hover:bg-cyan-500/20"
          title="New conversation"
        >
          <MessageSquarePlus size={12} />
          New
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {sorted.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs leading-relaxed text-white/45">
            No chats yet. Pehla sawaal poochte hi yahan save ho jaayega.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sorted.map((conversation) => {
              const active = conversation.id === activeId;
              const busy = (inFlight[conversation.id] ?? 0) > 0;
              const confirming = confirmDeleteId === conversation.id;
              return (
                <li key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => selectChat(conversation.id)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 pr-8 text-left transition-colors',
                      active
                        ? 'border-cyan-500/40 bg-cyan-500/15'
                        : 'border-transparent hover:border-white/10 hover:bg-white/5'
                    )}
                  >
                    {busy ? (
                      <LoaderCircle size={13} className="mt-0.5 shrink-0 animate-spin text-cyan-300" />
                    ) : (
                      <MessageSquare size={13} className={cn('mt-0.5 shrink-0', active ? 'text-cyan-300' : 'text-white/40')} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-xs font-medium', active ? 'text-cyan-100' : 'text-white/80')}>
                        {conversation.title}
                      </span>
                      <span className="block truncate text-[11px] text-white/45">{preview(conversation)}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-white/35">
                        {formatAgo(now - Date.parse(conversation.updatedAt))} · {conversation.messages.length} msg
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDelete(conversation.id)}
                    className={cn(
                      'absolute right-1.5 top-2 rounded p-1 transition-all',
                      confirming
                        ? 'bg-rose-500/20 text-rose-300 opacity-100'
                        : 'text-white/40 opacity-0 hover:text-rose-300 focus-visible:opacity-100 group-hover:opacity-100'
                    )}
                    aria-label={confirming ? 'Confirm delete conversation' : 'Delete conversation'}
                    title={confirming ? 'Click again to delete' : 'Delete conversation'}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {nudges.length > 0 && (
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-white/10 p-2">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
              <Lightbulb size={11} className="text-amber-300/80" />
              Nudges
            </span>
            <button
              type="button"
              onClick={() => useNexusStore.getState().clearNudges()}
              className="font-mono text-[10px] text-white/40 hover:text-white/70"
            >
              clear
            </button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {nudges.slice(0, 5).map((nudge) => (
              <li
                key={nudge.id}
                className={cn('rounded-lg border bg-white/[0.03] px-2 py-1.5', NUDGE_TONE[nudge.tone] ?? NUDGE_TONE.info)}
              >
                <div className="flex items-start gap-1.5">
                  <p className="min-w-0 flex-1 text-[11px] leading-snug text-white/75">{nudge.text}</p>
                  <button
                    type="button"
                    onClick={() => useNexusStore.getState().dismissNudge(nudge.id)}
                    className="shrink-0 rounded p-0.5 text-white/35 hover:text-white/70"
                    aria-label="Dismiss nudge"
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-white/35">{formatAgo(now - nudge.at)}</span>
                  {nudge.action && (
                    <button
                      type="button"
                      onClick={() => runNudge(nudge)}
                      className="flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200 hover:bg-cyan-500/20"
                    >
                      <WandSparkles size={10} />
                      {nudge.action.label}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export const ConversationList = memo(ConversationListInner);
