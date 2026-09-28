// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Chat
// Chat pane: glass message bubbles, markdown replies (code blocks
// with copy), suggested-action buttons that execute through
// NexusCore, animated typing indicator, and a composer with
// push-to-talk, Enter / Ctrl+Enter to send, Shift+Enter newline.
// Transcript + in-flight state live in useNexusStore.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  Check,
  CircleCheck,
  Copy,
  CornerDownLeft,
  Mic,
  Send,
  Sparkles,
  TriangleAlert,
  Volume2,
  WandSparkles,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useNexusStore } from '@/stores/useNexusStore';
import { runNexusButton, sendToNexus } from './NexusCore';
import { NexusMarkdown } from './NexusMarkdown';
import { NexusVoiceButton, useSpeechSynthesisSupported } from './NexusVoice';
import { speakNexus } from '@/lib/nexus/speech';
import { NEXUS_LIMITS } from '@/lib/nexus/protocol';
import { cn, formatTimeShort } from '@/lib/utils';
import type { NexusActionButton, NexusMessage } from '@/types/nexus';

const EMPTY_MESSAGES: NexusMessage[] = [];

// ─── Small pieces ───

export function NexusOrb({ size = 28, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-full border border-cyan-400/30"
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(circle at 30% 30%, rgba(0,240,255,0.35), rgba(123,97,255,0.25) 60%, rgba(0,0,0,0.6))',
        boxShadow: '0 0 14px rgba(0,240,255,0.18)',
      }}
      aria-hidden
    >
      {pulse && (
        <motion.span
          className="absolute inset-0 rounded-full border border-cyan-300/50"
          animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <Bot size={Math.round(size * 0.52)} className="text-cyan-200" />
    </span>
  );
}

export function NexusTypingIndicator() {
  return (
    <div className="flex items-end gap-2" role="status" aria-label="NEXUS is typing">
      <NexusOrb pulse />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.045] px-3.5 py-3 backdrop-blur-md">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-cyan-300"
            animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
        <span className="ml-2 font-mono text-[10px] text-white/45">NEXUS soch raha hai…</span>
      </div>
    </div>
  );
}

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      },
      () => undefined
    );
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded p-0.5 text-white/40 transition-colors hover:text-cyan-300"
      aria-label="Copy message"
      title="Copy"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

const SOURCE_BADGE: Record<string, { label: string; className: string; icon: ReactNode }> = {
  local: { label: 'instant', className: 'text-emerald-300/80', icon: <Zap size={10} /> },
  ai: { label: 'gemini', className: 'text-violet-300/80', icon: <Sparkles size={10} /> },
  offline: { label: 'ai offline', className: 'text-amber-300/80', icon: <WifiOff size={10} /> },
  error: { label: 'error', className: 'text-rose-300/80', icon: <TriangleAlert size={10} /> },
};

function ActionRow({
  actions,
  onAction,
  busy,
}: {
  actions: NexusActionButton[];
  onAction: (action: NexusActionButton) => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action, idx) => (
        <button
          key={`${action.kind}-${action.label}-${idx}`}
          type="button"
          onClick={() => onAction(action)}
          disabled={busy && action.kind === 'ask'}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
            'border-cyan-400/25 bg-cyan-500/[0.08] text-cyan-200 hover:border-cyan-400/50 hover:bg-cyan-500/20',
            'disabled:cursor-not-allowed disabled:opacity-40'
          )}
          title={action.kind === 'ask' ? `Ask: ${action.prompt}` : 'Run in WARRIOR OS'}
        >
          {action.kind === 'ask' ? <CornerDownLeft size={11} /> : <WandSparkles size={11} />}
          {action.label}
        </button>
      ))}
    </div>
  );
}

interface BubbleProps {
  message: NexusMessage;
  onAction: (action: NexusActionButton) => void;
  busy: boolean;
  canSpeak: boolean;
}

function NexusMessageBubbleInner({ message, onAction, busy, canSpeak }: BubbleProps) {
  const time = formatTimeShort(new Date(message.timestamp));

  if (message.role === 'system') {
    const failed = message.source === 'error';
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={cn(
            'flex max-w-[92%] items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px]',
            failed ? 'border-rose-500/25 bg-rose-500/[0.06] text-rose-200/80' : 'border-white/10 bg-white/[0.03] text-white/65'
          )}
        >
          {failed ? <TriangleAlert size={11} className="shrink-0" /> : <CircleCheck size={11} className="shrink-0 text-emerald-300" />}
          <span className="min-w-0 break-words">{message.content}</span>
        </div>
        {message.actions && message.actions.length > 0 && (
          <ActionRow actions={message.actions} onAction={onAction} busy={busy} />
        )}
      </div>
    );
  }

  const isUser = message.role === 'user';
  const badge = !isUser && message.source ? SOURCE_BADGE[message.source] : undefined;

  return (
    <div className={cn('flex items-start gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && <NexusOrb />}
      <div className={cn('flex min-w-0 max-w-[86%] flex-col gap-1.5', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl border px-3.5 py-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-md',
            isUser
              ? 'rounded-tr-md border-cyan-400/25 bg-cyan-500/[0.12] text-cyan-50'
              : 'rounded-tl-md border-white/10 bg-white/[0.045] text-white/90',
            message.source === 'error' && 'border-rose-500/30 bg-rose-500/[0.07]',
            message.source === 'offline' && 'border-amber-500/30 bg-amber-500/[0.06]'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
          ) : (
            <NexusMarkdown text={message.content} />
          )}
        </div>

        {!isUser && message.actions && message.actions.length > 0 && (
          <ActionRow actions={message.actions} onAction={onAction} busy={busy} />
        )}

        <div className={cn('flex items-center gap-1.5 px-1 font-mono text-[10px] text-white/40', isUser && 'flex-row-reverse')}>
          <span>{time}</span>
          {isUser && message.via === 'voice' && (
            <span className="flex items-center gap-0.5 text-rose-300/70" title="Voice command">
              <Mic size={10} /> voice
            </span>
          )}
          {badge && (
            <span className={cn('flex items-center gap-0.5', badge.className)}>
              {badge.icon}
              {badge.label}
            </span>
          )}
          {!isUser && <CopyMessageButton text={message.content} />}
          {!isUser && canSpeak && (
            <button
              type="button"
              onClick={() => speakNexus(message.content, { force: true })}
              className="rounded p-0.5 text-white/40 transition-colors hover:text-cyan-300"
              aria-label="Read reply aloud"
              title="Read aloud"
            >
              <Volume2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const NexusMessageBubble = memo(NexusMessageBubbleInner);

const DEFAULT_PROMPTS = ['study mode', 'DBMS quiz', 'notes on deadlock', 'Explain paging vs segmentation'];

function DefaultEmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <NexusOrb size={44} pulse />
      <div>
        <p className="text-sm font-medium text-white/80">NEXUS online.</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/50">
          GATE, code, ya is OS ke baare mein kuch bhi pooch. Commands jaise &ldquo;study mode&rdquo; turant chalte hain.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {DEFAULT_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Chat pane ───

export interface NexusChatProps {
  /** Conversation to show; defaults to the active one */
  conversationId?: string | null;
  /** Custom content for an empty conversation (receives nothing; use sendToNexus) */
  emptyState?: ReactNode;
  className?: string;
  autoFocus?: boolean;
}

function NexusChatInner({ conversationId, emptyState, className, autoFocus = true }: NexusChatProps) {
  const activeId = useNexusStore((s) => s.activeConversationId);
  const targetId = conversationId === undefined ? activeId : conversationId;
  const messages = useNexusStore(
    (s) => s.conversations.find((c) => c.id === targetId)?.messages ?? EMPTY_MESSAGES
  );
  const busy = useNexusStore((s) => (targetId ? (s.inFlight[targetId] ?? 0) > 0 : false));
  const canSpeak = useSpeechSynthesisSupported();

  const [draft, setDraft] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);

  // Jump to the latest message when switching conversations.
  useEffect(() => {
    stickToBottomRef.current = true;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [targetId]);

  // Follow new messages unless the user scrolled up to read history.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const send = (text: string) => {
    const message = text.trim();
    if (!message) return;
    stickToBottomRef.current = true;
    void sendToNexus(message, { via: 'text', conversationId: targetId ?? undefined });
  };

  const submit = () => {
    if (!draft.trim() || busy) return;
    send(draft);
    setDraft('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    // Shift+Enter inserts a newline; Enter and Ctrl/Cmd+Enter send.
    if (e.shiftKey && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    submit();
  };

  const onAction = (action: NexusActionButton) => {
    stickToBottomRef.current = true;
    void runNexusButton(action, targetId ?? undefined);
  };

  const nearLimit = draft.length > NEXUS_LIMITS.messageChars * 0.8;

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div
        ref={scrollerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
      >
        {messages.length === 0 && !busy ? (
          (emptyState ?? <DefaultEmptyState onPick={send} />)
        ) : (
          <div key={targetId ?? 'none'} className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <NexusMessageBubble message={message} onAction={onAction} busy={busy} canSpeak={canSpeak} />
                </motion.div>
              ))}
            </AnimatePresence>
            {busy && <NexusTypingIndicator />}
          </div>
        )}
      </div>

      <div className="border-t border-white/5 p-2.5">
        <div className="flex items-end gap-1.5 rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 transition-colors focus-within:border-cyan-400/40">
          <NexusVoiceButton />
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={NEXUS_LIMITS.messageChars}
            rows={1}
            placeholder="Pucho NEXUS se… ya command do"
            aria-label="Message NEXUS"
            className="field-sizing-content max-h-36 min-h-[30px] flex-1 resize-none bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || busy}
            aria-label="Send message"
            title="Send (Enter or Ctrl+Enter)"
            className={cn(
              'shrink-0 rounded-lg p-1.5 transition-colors',
              !draft.trim() || busy ? 'cursor-not-allowed text-white/25' : 'text-cyan-300 hover:bg-cyan-500/15'
            )}
          >
            <Send size={15} />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between px-1 font-mono text-[10px] text-white/35">
          <span>Enter / Ctrl+Enter send · Shift+Enter newline</span>
          {nearLimit && (
            <span className={cn(draft.length >= NEXUS_LIMITS.messageChars && 'text-rose-300')}>
              {draft.length}/{NEXUS_LIMITS.messageChars}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const NexusChat = memo(NexusChatInner);
