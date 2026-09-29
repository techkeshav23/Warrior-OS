// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Chat
// Chat pane: NEXUS orb + reply bubbles with markdown (code blocks
// with copy), user bubbles on the right, suggested-action chips that
// execute through NexusCore, a thinking indicator, "jump to latest",
// and a composer with push-to-talk, Enter / Ctrl+Enter to send,
// Shift+Enter newline. Transcript + in-flight state live in
// useNexusStore.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleCheck,
  Copy,
  Cpu,
  CornerDownLeft,
  Mic,
  Sparkles,
  TriangleAlert,
  Volume2,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { IconButton, Kbd } from '@/components/ui';
import { useNexusStore } from '@/stores/useNexusStore';
import { runNexusButton, sendToNexus } from './NexusCore';
import { NexusMarkdown } from './NexusMarkdown';
import { NexusVoiceButton, useSpeechSynthesisSupported } from './NexusVoice';
import { speakNexus } from '@/lib/nexus/speech';
import { NEXUS_LIMITS } from '@/lib/nexus/protocol';
import { EASE_OUT_QUINT } from '@/styles/tokens';
import { cn, formatTimeShort } from '@/lib/utils';
import type { NexusActionButton, NexusMessage } from '@/types/nexus';

const EMPTY_MESSAGES: NexusMessage[] = [];

// ─── Identity ───

export interface NexusOrbProps {
  size?: number;
  /** Live: NEXUS is thinking or listening (a plasma arc circles the core). */
  pulse?: boolean;
  /** Hero variant: adds the concentric HUD rings (empty states). */
  rings?: boolean;
  className?: string;
}

/**
 * NEXUS's face: a plasma core in an ink shell. Static at rest; while
 * NEXUS works (`pulse`) a thin arc orbits the core. Always Plasma,
 * independent of the user's accent: this is NEXUS's own identity.
 */
export function NexusOrb({ size = 28, pulse = false, rings = false, className }: NexusOrbProps) {
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {rings && (
        <>
          <span className="absolute -inset-[22%] rounded-full border border-plasma-400/15" />
          <span className="absolute -inset-[48%] rounded-full border border-dashed border-plasma-400/10" />
        </>
      )}
      <span className="absolute inset-0 rounded-full bg-ink-900 shadow-[0_0_18px_-4px_var(--color-plasma-400)] ring-1 ring-inset ring-plasma-400/35" />
      <span className="absolute inset-[20%] rounded-full bg-radial-[at_35%_30%] from-plasma-300 via-plasma-500 to-plasma-600/20" />
      <span className="absolute left-[34%] top-[28%] size-[16%] rounded-full bg-fg/70 blur-[1px]" />
      {pulse && (
        <svg
          viewBox="0 0 36 36"
          className="absolute inset-0 size-full motion-safe:animate-spin motion-safe:[animation-duration:1.6s]"
        >
          <circle
            cx="18"
            cy="18"
            r="16.75"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="22 84"
            className="stroke-plasma-300"
          />
        </svg>
      )}
    </span>
  );
}

// ─── Typing indicator ───

export function NexusTypingIndicator() {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-start gap-3" role="status" aria-label="NEXUS is typing">
      <NexusOrb pulse />
      <div className="chamfer-md [--cut-tl:0px] bg-linear-to-br from-steel-750/95 via-steel-800/95 to-steel-850/95 shadow-[inset_2px_0_0_var(--color-plasma-400),inset_3px_0_10px_-6px_var(--color-plasma-400),inset_0_1px_0_rgb(255_255_255/0.07),inset_0_-1px_0_rgb(0_0_0/0.55)] flex h-10 items-center gap-2.5 px-3.5">
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rotate-45 bg-plasma-300"
              animate={reduce ? { opacity: 0.8 } : { opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
              transition={reduce ? undefined : { duration: 1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
            />
          ))}
        </span>
        <span className="text-xs text-fg-subtle">Thinking…</span>
      </div>
    </div>
  );
}

// ─── Message pieces ───

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
    <IconButton
      icon={copied ? <Check size={13} strokeWidth={2} className="text-success" aria-hidden /> : Copy}
      iconSize={13}
      size="xs"
      onClick={copy}
      aria-label="Copy message"
      tooltip={copied ? 'Copied' : 'Copy'}
    />
  );
}

type SourceMeta = { label: string; icon: ReactNode; className: string };

const SOURCE_META: Record<string, SourceMeta> = {
  local: {
    label: 'Instant',
    icon: <Zap size={11} strokeWidth={2} aria-hidden />,
    className: 'text-fg-subtle [&_svg]:text-accent',
  },
  ai: {
    label: 'Gemini',
    icon: <Sparkles size={11} strokeWidth={2} aria-hidden />,
    className: 'text-fg-subtle [&_svg]:text-plasma-300',
  },
  offline: {
    label: 'Offline brain',
    icon: <Cpu size={11} strokeWidth={2} aria-hidden />,
    className: 'text-fg-subtle',
  },
  error: {
    label: 'Error',
    icon: <TriangleAlert size={11} strokeWidth={2} aria-hidden />,
    className: 'text-danger',
  },
};

function ActionRow({
  actions,
  onAction,
  busy,
  center = false,
}: {
  actions: NexusActionButton[];
  onAction: (action: NexusActionButton) => void;
  busy: boolean;
  center?: boolean;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', center && 'justify-center')}>
      {actions.map((action, idx) => {
        const ask = action.kind === 'ask';
        return (
          <button
            key={`${action.kind}-${action.label}-${idx}`}
            type="button"
            onClick={() => onAction(action)}
            disabled={busy && ask}
            className={cn(
              'chamfer-xs focus-ring group/chip inline-flex h-7 max-w-full items-center gap-1.5 px-2.5 text-xs font-medium',
              'transition-[background-color,filter,color] duration-120 ease-out-quint',
              'disabled:pointer-events-none disabled:opacity-45',
              ask
                ? 'armor-plate text-fg-muted hover:brightness-120 hover:text-fg'
                : 'bg-accent/10 text-fg shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_30%,transparent),inset_0_-2px_0_var(--accent)] hover:bg-accent/18 active:bg-accent/24'
            )}
            title={ask ? `Ask: ${action.prompt}` : 'Run in Warrior OS'}
          >
            {ask ? (
              <CornerDownLeft size={13} strokeWidth={1.75} className="shrink-0 text-fg-subtle group-hover/chip:text-fg-muted" aria-hidden />
            ) : (
              <WandSparkles size={13} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
            )}
            <span className="truncate">{action.label}</span>
          </button>
        );
      })}
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
      <div className="flex flex-col items-center gap-2 py-1">
        <div
          className={cn(
            'chamfer-sm flex max-w-[92%] items-center gap-2 px-3 py-1 text-xs',
            failed
              ? 'bg-danger/8 text-danger shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-danger)_30%,transparent)]'
              : 'bg-steel-850/80 text-fg-muted shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_-1px_0_rgb(0_0_0/0.5)]'
          )}
        >
          {failed ? (
            <TriangleAlert size={13} strokeWidth={1.75} className="shrink-0" aria-hidden />
          ) : (
            <CircleCheck size={13} strokeWidth={1.75} className="shrink-0 text-success" aria-hidden />
          )}
          <span className="min-w-0 select-text break-words">{message.content}</span>
          <time className="shrink-0 font-mono text-2xs text-fg-subtle tabular">{time}</time>
        </div>
        {message.actions && message.actions.length > 0 && (
          <ActionRow actions={message.actions} onAction={onAction} busy={busy} center />
        )}
      </div>
    );
  }

  const isUser = message.role === 'user';
  const source = !isUser && message.source ? SOURCE_META[message.source] : undefined;
  const failed = message.source === 'error';

  if (isUser) {
    return (
      <div className="flex justify-end pl-10">
        <div className="flex min-w-0 max-w-[min(86%,560px)] flex-col items-end gap-1">
          <div className="chamfer-md [--cut-tr:0px] bg-linear-to-bl from-ember-500/[0.16] via-ember-600/[0.09] to-steel-800/90 shadow-[inset_-2px_0_0_var(--color-ember-400),inset_-3px_0_10px_-6px_var(--color-ember-500),inset_0_1px_0_rgb(255_220_190/0.08),inset_0_-1px_0_rgb(0_0_0/0.5)] px-3.5 py-2 text-fg">
            <p className="select-text whitespace-pre-wrap break-words text-sm">{message.content}</p>
          </div>
          <div className="flex h-5 items-center gap-2 px-1 text-2xs text-fg-subtle">
            {message.via === 'voice' && (
              <span className="flex items-center gap-1" title="Voice command">
                <Mic size={11} strokeWidth={2} className="text-accent" aria-hidden />
                Voice
              </span>
            )}
            <time className="font-mono tabular">{time}</time>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group/msg flex items-start gap-3 pr-6">
      <NexusOrb className="mt-0.5" />
      <div className="flex min-w-0 max-w-[min(100%,680px)] flex-col items-start gap-2">
        <div
          className={cn(
            'max-w-full px-3.5 py-2.5 text-fg',
            failed ? 'chamfer-md [--cut-tl:0px] bg-danger/8 shadow-[inset_2px_0_0_var(--color-danger),inset_0_0_0_1px_color-mix(in_oklab,var(--color-danger)_25%,transparent)]' : 'chamfer-md [--cut-tl:0px] bg-linear-to-br from-steel-750/95 via-steel-800/95 to-steel-850/95 shadow-[inset_2px_0_0_var(--color-plasma-400),inset_3px_0_10px_-6px_var(--color-plasma-400),inset_0_1px_0_rgb(255_255_255/0.07),inset_0_-1px_0_rgb(0_0_0/0.55)]'
          )}
        >
          <NexusMarkdown text={message.content} />
        </div>

        {message.actions && message.actions.length > 0 && (
          <ActionRow actions={message.actions} onAction={onAction} busy={busy} />
        )}

        <div className="-mt-0.5 flex h-6 items-center gap-2 pl-1 text-2xs">
          <time className="font-mono text-fg-subtle tabular">{time}</time>
          {source && (
            <span className={cn('flex items-center gap-1 font-medium', source.className)}>
              {source.icon}
              {source.label}
            </span>
          )}
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-120 ease-out-quint focus-within:opacity-100 group-hover/msg:opacity-100">
            <CopyMessageButton text={message.content} />
            {canSpeak && (
              <IconButton
                icon={Volume2}
                iconSize={13}
                size="xs"
                onClick={() => speakNexus(message.content, { force: true })}
                aria-label="Read reply aloud"
                tooltip="Read aloud"
              />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

const NexusMessageBubble = memo(NexusMessageBubbleInner);

// ─── Default empty state (NexusChat used outside AI Assist) ───

const DEFAULT_PROMPTS = ['study mode', 'review due cards', 'my decks', 'What can this OS do?'];

function DefaultEmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <NexusOrb size={48} rings />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-fg">NEXUS is online</p>
        <p className="max-w-xs text-ui text-fg-muted">
          Ask about this OS, your decks, habits or code. Commands like &ldquo;study mode&rdquo; run instantly.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {DEFAULT_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="armor-plate chamfer-xs focus-ring h-7 px-2.5 text-xs font-medium text-fg-muted transition-[filter,color] duration-120 ease-out-quint hover:brightness-120 hover:text-fg"
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
  /** Composer placeholder */
  placeholder?: string;
}

function NexusChatInner({
  conversationId,
  emptyState,
  className,
  autoFocus = true,
  placeholder = 'Ask NEXUS anything, or give a command…',
}: NexusChatProps) {
  const activeId = useNexusStore((s) => s.activeConversationId);
  const targetId = conversationId === undefined ? activeId : conversationId;
  const messages = useNexusStore(
    (s) => s.conversations.find((c) => c.id === targetId)?.messages ?? EMPTY_MESSAGES
  );
  const busy = useNexusStore((s) => (targetId ? (s.inFlight[targetId] ?? 0) > 0 : false));
  const canSpeak = useSpeechSynthesisSupported();
  const reduceMotion = useReducedMotion();

  const [draft, setDraft] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = (smooth = false) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (smooth && !reduceMotion) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
  };

  const hasContent = messages.length > 0 || busy;

  // Jump to the latest message when switching conversations; an empty
  // conversation (welcome screen) starts at the top.
  useEffect(() => {
    stickToBottomRef.current = true;
    const el = scrollerRef.current;
    if (el) el.scrollTop = hasContent ? el.scrollHeight : 0;
  }, [targetId, hasContent]);

  // Follow new messages unless the user scrolled up to read history.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el && hasContent && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy, hasContent]);

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
  const atLimit = draft.length >= NEXUS_LIMITS.messageChars;
  const empty = !hasContent;
  const canSend = draft.trim().length > 0 && !busy;

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            stickToBottomRef.current = bottom;
            setAtBottom(bottom);
          }}
          role={empty ? undefined : 'log'}
          aria-label={empty ? undefined : 'Conversation with NEXUS'}
          className="scrollbar-thin h-full overflow-y-auto px-4 py-5"
        >
          {empty ? (
            (emptyState ?? <DefaultEmptyState onPick={send} />)
          ) : (
            <div key={targetId ?? 'none'} className="mx-auto flex w-full max-w-3xl flex-col gap-5">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: EASE_OUT_QUINT }}
                  >
                    <NexusMessageBubble message={message} onAction={onAction} busy={busy} canSpeak={canSpeak} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {busy && <NexusTypingIndicator />}
            </div>
          )}
        </div>

        {/* Jump to latest (only while reading history) */}
        <AnimatePresence>
          {!atBottom && !empty && (
            <motion.button
              key="nexus-jump"
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: EASE_OUT_QUINT }}
              onClick={() => {
                stickToBottomRef.current = true;
                scrollToBottom(true);
              }}
              className="focus-ring armor-popover chamfer-sm absolute bottom-3 left-1/2 flex h-7 -translate-x-1/2 items-center gap-1.5 px-3 text-xs font-medium text-fg-muted transition-colors duration-120 hover:text-fg"
            >
              <ArrowDown size={13} strokeWidth={2} aria-hidden />
              Latest
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Composer ── */}
      <div className="shrink-0 border-t border-line bg-ink-950/25 px-3 pb-2 pt-3">
        <div className="mx-auto w-full max-w-3xl">
          <div
            className={cn(
              // Sunk slot: the composer is cut into the plate; focus heats its lower edge.
              'chamfer-sm flex items-end gap-1 bg-linear-to-b from-steel-950 to-steel-900 p-1.5',
              'transition-[box-shadow] duration-120 ease-out-quint',
              atLimit
                ? 'shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_2px_6px_rgb(0_0_0/0.45),inset_0_-1px_0_rgb(255_255_255/0.07),inset_0_0_0_1px_color-mix(in_oklab,var(--color-danger)_55%,transparent),inset_0_-2px_0_var(--color-danger)]'
                : 'shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_2px_6px_rgb(0_0_0/0.45),inset_0_-1px_0_rgb(255_255_255/0.07)] hover:shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_2px_6px_rgb(0_0_0/0.45),inset_0_-1px_0_rgb(255_255_255/0.07),inset_0_0_0_1px_var(--color-line-strong)] focus-within:shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_2px_6px_rgb(0_0_0/0.45),inset_0_-1px_0_rgb(255_255_255/0.07),inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_45%,transparent),inset_0_-2px_0_var(--accent),inset_0_-14px_16px_-12px_color-mix(in_oklab,var(--accent)_45%,transparent)]'
            )}
          >
            <NexusVoiceButton />
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={NEXUS_LIMITS.messageChars}
              rows={1}
              placeholder={placeholder}
              aria-label="Message NEXUS"
              className="scrollbar-thin field-sizing-content max-h-40 min-h-7 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
            />
            <IconButton
              icon={ArrowUp}
              variant={canSend ? 'primary' : 'secondary'}
              size="sm"
              iconSize={16}
              onClick={submit}
              disabled={!canSend}
              loading={busy}
              aria-label="Send message"
              tooltip="Send"
              shortcut="Enter"
            />
          </div>
          <div className="mt-1.5 flex h-4 items-center justify-between gap-3 px-1 text-2xs text-fg-subtle">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <Kbd size="sm">Enter</Kbd>
              <span>send</span>
              <span className="text-fg-faint" aria-hidden>
                ·
              </span>
              <Kbd size="sm" keys={['Shift', 'Enter']} />
              <span>new line</span>
            </span>
            {nearLimit && (
              <span className={cn('shrink-0 font-mono tabular', atLimit && 'text-danger')}>
                {draft.length}/{NEXUS_LIMITS.messageChars}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const NexusChat = memo(NexusChatInner);
