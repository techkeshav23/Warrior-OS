// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AI Assist: Conversation List
// Persisted NEXUS chats (newest first, grouped by day) with new /
// search / select / delete, plus the NEXUS nudge feed (suggestions +
// 'warrior:nexus-say' messages) whose action buttons run through
// NexusCore.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { Lightbulb, LoaderCircle, MessagesSquare, SearchX, SquarePen, Trash2, WandSparkles, X } from 'lucide-react';
import { Button, ConfirmDialog, EmptyState, IconButton, SearchField } from '@/components/ui';
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

const NUDGE_DOT: Record<NexusNudge['tone'], string> = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/** Compact relative time for list rows: "now", "5m", "3h", "2d". */
function shortAgo(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function dayBucket(updatedAt: string, now: number): string {
  const then = new Date(updatedAt);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - new Date(then).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'Previous 7 days';
  return 'Older';
}

interface ConversationListProps {
  /** Called after a chat is picked or created (closes the mobile drawer). */
  onNavigate?: () => void;
  /** Drawer mode: shows a close button in the header. */
  onClose?: () => void;
}

function ConversationListInner({ onNavigate, onClose }: ConversationListProps) {
  const conversations = useNexusStore((s) => s.conversations);
  const activeId = useNexusStore((s) => s.activeConversationId);
  const inFlight = useNexusStore((s) => s.inFlight);
  const nudges = useNexusStore((s) => s.nudges);

  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<NexusConversation | null>(null);

  // Clock for relative timestamps ("5m ago"), refreshed every minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)),
    [conversations]
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = q
      ? sorted.filter((c) => c.title.toLowerCase().includes(q) || preview(c).toLowerCase().includes(q))
      : sorted;
    const out: Array<{ label: string; items: NexusConversation[] }> = [];
    for (const conversation of visible) {
      const label = dayBucket(conversation.updatedAt, now);
      const group = out[out.length - 1];
      if (group && group.label === label) group.items.push(conversation);
      else out.push({ label, items: [conversation] });
    }
    return out;
  }, [sorted, query, now]);

  const createChat = () => {
    useNexusStore.getState().newConversation();
    onNavigate?.();
  };

  const selectChat = (id: string) => {
    useNexusStore.getState().selectConversation(id);
    onNavigate?.();
  };

  const deleteChat = () => {
    if (confirmDelete) useNexusStore.getState().deleteConversation(confirmDelete.id);
    setConfirmDelete(null);
  };

  const runNudge = (nudge: NexusNudge) => {
    if (!nudge.action) return;
    const conversationId = useNexusStore.getState().ensureConversation();
    void runNexusButton(nudge.action, conversationId);
    useNexusStore.getState().dismissNudge(nudge.id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line pl-4 pr-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-ui font-semibold text-fg">Chats</span>
          {sorted.length > 0 && <span className="font-mono text-2xs text-fg-subtle tabular">{sorted.length}</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" leadingIcon={SquarePen} onClick={createChat} title="New conversation">
            New
          </Button>
          {onClose && <IconButton icon={X} size="sm" onClick={onClose} aria-label="Close conversations" />}
        </div>
      </div>

      {sorted.length > 3 && (
        <div className="shrink-0 px-3 pt-3">
          <SearchField value={query} onValueChange={setQuery} size="sm" placeholder="Search chats" aria-label="Search chats" />
        </div>
      )}

      {/* List */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2">
        {sorted.length === 0 ? (
          <EmptyState
            size="sm"
            icon={MessagesSquare}
            title="No chats yet"
            description="Your first question to NEXUS starts one."
          />
        ) : groups.length === 0 ? (
          <EmptyState size="sm" icon={SearchX} title="No matching chats" description={`Nothing matches “${query.trim()}”.`} />
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-2 last:mb-0">
              <h3 className="hud-label px-2 pb-1.5 pt-2">{group.label}</h3>
              <ul className="flex flex-col gap-px">
                {group.items.map((conversation) => {
                  const active = conversation.id === activeId;
                  const busy = (inFlight[conversation.id] ?? 0) > 0;
                  return (
                    <li key={conversation.id} className="group/row relative">
                      <button
                        type="button"
                        onClick={() => selectChat(conversation.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'chamfer-sm focus-ring-inset relative flex w-full flex-col gap-0.5 py-2 pl-3 pr-9 text-left',
                          'transition-[background-color,box-shadow] duration-120 ease-out-quint',
                          active
                            ? 'bg-linear-to-r from-accent/[0.14] to-accent/[0.04] shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_-1px_0_color-mix(in_oklab,var(--accent)_55%,transparent)]'
                            : 'hover:bg-surface-hover active:bg-surface-active'
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 bg-accent shadow-[0_0_8px_var(--accent)] transition-opacity duration-180 [clip-path:polygon(0_0,100%_3px,100%_calc(100%-3px),0_100%)]',
                            active ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn('min-w-0 flex-1 truncate text-ui font-medium', active ? 'text-fg' : 'text-fg-muted')}
                            title={conversation.title}
                          >
                            {conversation.title}
                          </span>
                          {busy ? (
                            <LoaderCircle size={12} strokeWidth={2} className="shrink-0 animate-spin text-accent" aria-label="NEXUS is replying" />
                          ) : (
                            <span
                              className="shrink-0 font-mono text-2xs text-fg-subtle tabular group-hover/row:opacity-0"
                              title={formatAgo(now - Date.parse(conversation.updatedAt))}
                            >
                              {shortAgo(now - Date.parse(conversation.updatedAt))}
                            </span>
                          )}
                        </span>
                        <span className="truncate text-xs text-fg-subtle">{preview(conversation)}</span>
                      </button>
                      <span className="absolute right-1.5 top-1.5 opacity-0 transition-opacity duration-120 focus-within:opacity-100 group-hover/row:opacity-100">
                        <IconButton
                          icon={Trash2}
                          size="xs"
                          iconSize={13}
                          variant="ghost-danger"
                          onClick={() => setConfirmDelete(conversation)}
                          aria-label="Delete conversation"
                          tooltip="Delete"
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* Nudge feed */}
      {nudges.length > 0 && (
        <div className="scrollbar-thin max-h-[45%] shrink-0 overflow-y-auto border-t border-line bg-ink-950/30 px-2 pb-2 pt-1">
          <div className="flex h-9 items-center justify-between pl-2">
            <span className="flex items-center gap-1.5">
              <Lightbulb size={13} strokeWidth={1.75} className="text-accent" aria-hidden />
              <span className="hud-label">Nudges</span>
              <span className="font-mono text-2xs text-fg-subtle tabular">{nudges.length}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => useNexusStore.getState().clearNudges()}>
              Clear
            </Button>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {nudges.slice(0, 5).map((nudge) => (
              <li key={nudge.id} className="group/nudge flex items-start gap-2.5 px-2 py-2.5">
                <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', NUDGE_DOT[nudge.tone] ?? NUDGE_DOT.info)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fg-muted">{nudge.text}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-2xs text-fg-subtle tabular">{formatAgo(now - nudge.at)}</span>
                    {nudge.action && (
                      <button
                        type="button"
                        onClick={() => runNudge(nudge)}
                        className="chamfer-xs focus-ring inline-flex h-6 min-w-0 items-center gap-1 bg-accent/10 px-2 text-2xs font-medium text-fg shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_28%,transparent)] transition-colors duration-120 ease-out-quint hover:bg-accent/18"
                      >
                        <WandSparkles size={11} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
                        <span className="truncate">{nudge.action.label}</span>
                      </button>
                    )}
                  </div>
                </div>
                <IconButton
                  icon={X}
                  size="xs"
                  iconSize={12}
                  onClick={() => useNexusStore.getState().dismissNudge(nudge.id)}
                  aria-label="Dismiss nudge"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={deleteChat}
        tone="danger"
        title="Delete this chat?"
        description={
          confirmDelete
            ? `“${confirmDelete.title}” and its ${confirmDelete.messages.length} ${
                confirmDelete.messages.length === 1 ? 'message' : 'messages'
              } go too. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete chat"
      />
    </div>
  );
}

export const ConversationList = memo(ConversationListInner);
