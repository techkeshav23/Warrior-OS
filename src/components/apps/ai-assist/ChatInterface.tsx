// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AI Assist: Chat Interface
// Header (NEXUS identity + brain status, conversation title, pomodoro
// chip, OS-context toggle with a "what NEXUS sees" preview, wake mode,
// overflow menu for voice / nudges / new / clear chat) around the
// NEXUS chat pane, plus the owner / guest welcome screen.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  BellRing,
  BrainCircuit,
  Ear,
  Eraser,
  Eye,
  Layers,
  LoaderCircle,
  MessageCircleQuestion,
  MoreHorizontal,
  PanelLeft,
  SquarePen,
  Terminal,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react';
import { Badge, ConfirmDialog, IconButton, Menu, Tooltip, type MenuItem } from '@/components/ui';
import { NEXUS_DEFAULT_CONVERSATION_TITLE, useNexusStore } from '@/stores/useNexusStore';
import { useNexusVoiceStore } from '@/lib/nexus/voice-store';
import { NexusChat, NexusOrb } from '@/components/nexus/NexusChat';
import { sendToNexus } from '@/components/nexus/NexusCore';
import {
  NexusWakeToggle,
  toggleWakeMode,
  useSpeechRecognitionSupported,
  useSpeechSynthesisSupported,
} from '@/components/nexus/NexusVoice';
import { NexusPomodoroPill } from '@/components/nexus/NexusPomodoro';
import { buildNexusContext } from '@/lib/nexus/context';
import { stopSpeaking } from '@/lib/nexus/speech';
import { NEXUS_GEMINI_MODEL } from '@/lib/nexus/protocol';
import { getVisitorMode } from '@/lib/visitor';
import { OWNER } from '@/config/owner';
import { EASE_OUT_QUINT } from '@/styles/tokens';
import { getGreeting } from '@/lib/utils';

export type NexusAIStatus = 'checking' | 'online' | 'offline' | 'unknown';

type QuickPrompt = { label: string; prompt: string; kind: 'command' | 'ask' };

const OWNER_PROMPTS: QuickPrompt[] = [
  { label: 'Study mode', prompt: 'study mode', kind: 'command' },
  { label: 'Review due cards', prompt: 'review due cards', kind: 'command' },
  { label: 'My decks', prompt: 'my decks', kind: 'command' },
  { label: 'Pomodoro 25', prompt: 'pomodoro 25', kind: 'command' },
  {
    label: 'What should I learn today?',
    prompt: 'What should I study today?',
    kind: 'ask',
  },
  {
    label: 'Learn anything faster',
    prompt: 'How do I learn anything faster?',
    kind: 'ask',
  },
  { label: 'What can you do?', prompt: 'help', kind: 'command' },
];

const GUEST_PROMPTS: QuickPrompt[] = [
  { label: 'Tour this OS', prompt: 'What can this OS do?', kind: 'ask' },
  { label: 'Who built this?', prompt: 'Who built this OS?', kind: 'ask' },
  { label: 'Study mode', prompt: 'study mode', kind: 'command' },
  { label: 'Quiz me', prompt: 'quiz me', kind: 'command' },
  { label: 'Tech stack', prompt: 'What is this built with?', kind: 'ask' },
  { label: 'What can you do?', prompt: 'help', kind: 'command' },
];

// ─── Brain status ───

const STATUS_BADGE: Record<NexusAIStatus, { tone: 'success' | 'warning' | 'neutral'; label: string }> = {
  online: { tone: 'success', label: 'Online' },
  offline: { tone: 'warning', label: 'Offline brain' },
  checking: { tone: 'neutral', label: 'Linking' },
  unknown: { tone: 'neutral', label: 'Status unknown' },
};

function statusDetail(status: NexusAIStatus): string {
  switch (status) {
    case 'online':
      return `Gemini linked (${NEXUS_GEMINI_MODEL})`;
    case 'offline':
      return 'No Gemini key: commands and the learning coach run locally';
    case 'checking':
      return 'Checking the AI link…';
    default:
      return 'Could not reach the AI status endpoint';
  }
}

function BrainStatusBadge({ status }: { status: NexusAIStatus }) {
  const badge = STATUS_BADGE[status];
  return (
    <Tooltip content={statusDetail(status)} side="bottom">
      <Badge
        tone={badge.tone}
        size="sm"
        dot={status !== 'checking'}
        pulse={status === 'online'}
        icon={
          status === 'checking' ? (
            <LoaderCircle size={10} strokeWidth={2} className="animate-spin" aria-hidden />
          ) : undefined
        }
        tabIndex={0}
        className="focus-ring cursor-default"
      >
        {badge.label}
      </Badge>
    </Tooltip>
  );
}

// ─── Welcome screen ───

function PromptButton({ item, onPick }: { item: QuickPrompt; onPick: (prompt: string) => void }) {
  const command = item.kind === 'command';
  return (
    <button
      type="button"
      onClick={() => onPick(item.prompt)}
      className="focus-ring group/prompt flex h-10 min-w-0 items-center gap-2.5 rounded-control border border-line bg-surface-2 pl-2.5 pr-2 text-left text-ui text-fg-muted transition-[background-color,border-color,color] duration-120 ease-out-quint hover:border-line-strong hover:bg-surface-hover hover:text-fg active:bg-surface-active"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-ink-800 text-fg-subtle ring-1 ring-inset ring-line transition-colors duration-120 group-hover/prompt:text-accent">
        {command ? (
          <Terminal size={13} strokeWidth={1.75} aria-hidden />
        ) : (
          <MessageCircleQuestion size={13} strokeWidth={1.75} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate" title={item.label}>
        {item.label}
      </span>
      <ArrowUpRight
        size={14}
        strokeWidth={1.75}
        className="shrink-0 text-fg-faint opacity-0 transition-opacity duration-120 group-hover/prompt:opacity-100 group-focus-visible/prompt:opacity-100"
        aria-hidden
      />
    </button>
  );
}

function AssistEmptyState({ aiStatus, conversationId }: { aiStatus: NexusAIStatus; conversationId: string | null }) {
  const [greeting] = useState(() => getGreeting());
  // AI Assist renders client-side only, so the stored visitor mode is read once here.
  const [visitor] = useState(getVisitorMode);
  const guest = visitor === 'guest';
  const prompts = guest ? GUEST_PROMPTS : OWNER_PROMPTS;
  const asks = prompts.filter((p) => p.kind === 'ask');
  const commands = prompts.filter((p) => p.kind === 'command');
  const send = (prompt: string) => {
    void sendToNexus(prompt, {
      via: 'text',
      conversationId: conversationId ?? undefined,
    });
  };

  const groups = guest
    ? [
        { label: 'Ask NEXUS', items: asks },
        { label: 'Run a command', items: commands },
      ]
    : [
        { label: 'Run a command', items: commands },
        { label: 'Ask NEXUS', items: asks },
      ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto my-auto flex w-full max-w-xl flex-col items-center gap-6 py-2 text-center">
        <div className="flex flex-col items-center gap-4 pt-3">
          <NexusOrb size={52} rings />
          <div className="flex flex-col items-center gap-1.5">
            <p className="font-display text-sm font-semibold tracking-[0.32em] text-plasma-300">NEXUS</p>
            <p className="text-base font-semibold text-fg">
              {guest
                ? `${greeting}. Welcome to ${OWNER.shortName}'s Warrior OS.`
                : `${greeting}, ${visitor === 'owner' ? OWNER.shortName : 'warrior'}. Kya karna hai aaj?`}
            </p>
            <p className="max-w-md text-ui text-fg-muted">
              {guest
                ? 'I run this OS from plain language and know every app in it. Ask for a tour, or try a command.'
                : 'Commands (apps, decks, notes, modes, pomodoro) run instantly. Everything else goes to Gemini when it is configured: concepts, code, plans.'}
            </p>
          </div>
        </div>

        {aiStatus === 'offline' && (
          <div className="flex w-full items-start gap-3 rounded-card border border-warning/25 bg-warning/6 px-3.5 py-3 text-left">
            <WifiOff size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0">
              <p className="text-ui font-medium text-fg">Offline brain active</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                No GEMINI_API_KEY on the server. OS commands, the learning coach over your decks and notes, and the
                guide to every app still work; open-ended chat needs the key.
              </p>
            </div>
          </div>
        )}

        <div className="flex w-full flex-col gap-4 text-left">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <section key={group.label} className="flex flex-col gap-2">
                <h3 className="hud-label px-0.5">{group.label}</h3>
                <div className="grid grid-cols-1 gap-1.5 @min-[420px]:grid-cols-2">
                  {group.items.map((item) => (
                    <PromptButton key={item.label} item={item} onPick={send} />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat interface ───

interface ChatInterfaceProps {
  aiStatus: NexusAIStatus;
  onToggleSidebar: () => void;
}

function ChatInterfaceInner({ aiStatus, onToggleSidebar }: ChatInterfaceProps) {
  const activeId = useNexusStore((s) => s.activeConversationId);
  const title = useNexusStore(
    (s) => s.conversations.find((c) => c.id === s.activeConversationId)?.title ?? NEXUS_DEFAULT_CONVERSATION_TITLE,
  );
  const messageCount = useNexusStore(
    (s) => s.conversations.find((c) => c.id === s.activeConversationId)?.messages.length ?? 0,
  );
  const busy = useNexusStore((s) => (s.activeConversationId ? (s.inFlight[s.activeConversationId] ?? 0) > 0 : false));
  const contextEnabled = useNexusStore((s) => s.contextEnabled);
  const suggestionsEnabled = useNexusStore((s) => s.suggestionsEnabled);
  const voiceReplies = useNexusStore((s) => s.voiceReplies);
  const wakeEnabled = useNexusVoiceStore((s) => s.wakeEnabled);
  const recognitionSupported = useSpeechRecognitionSupported();
  const synthesisSupported = useSpeechSynthesisSupported();

  // Owners get NEXUS's Hinglish voice in the composer; visitors get English.
  const [visitor] = useState(getVisitorMode);
  const [confirmClear, setConfirmClear] = useState(false);
  const [contextPreview, setContextPreview] = useState<string | null>(null);

  const clearChat = () => {
    useNexusStore.getState().clearConversation();
    setConfirmClear(false);
  };

  const showContext = () => {
    if (contextPreview !== null) {
      setContextPreview(null);
      return;
    }
    const ctx = buildNexusContext({ detailed: true });
    setContextPreview(
      [
        `time ${ctx.localTime ?? ''} (${ctx.timeOfDay}) · workspace ${ctx.currentWorkspace} · level ${ctx.userLevel} · streak ${ctx.currentStreak}d`,
        ctx.summary ?? '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  };

  const toggleVoiceReplies = () => {
    const next = !useNexusStore.getState().voiceReplies;
    useNexusStore.getState().setVoiceReplies(next);
    if (!next) stopSpeaking();
  };

  const menuItems: MenuItem[] = [
    { id: 'h-chat', heading: true, label: 'Conversation' },
    {
      id: 'new',
      label: 'New chat',
      icon: SquarePen,
      onSelect: () => useNexusStore.getState().newConversation(),
    },
    {
      id: 'clear',
      label: 'Clear messages',
      icon: Eraser,
      danger: true,
      disabled: messageCount === 0,
      onSelect: () => setConfirmClear(true),
    },
    { id: 'd1', divider: true },
    { id: 'h-nexus', heading: true, label: 'NEXUS' },
    {
      id: 'context',
      label: 'Attach OS context',
      description: 'Level, streak, open apps and quiz stats',
      icon: Layers,
      checked: contextEnabled,
      onSelect: () => useNexusStore.getState().toggleContext(),
    },
    {
      id: 'preview',
      label: contextPreview !== null ? 'Hide what NEXUS sees' : 'What NEXUS sees',
      icon: Eye,
      disabled: !contextEnabled,
      onSelect: showContext,
    },
    {
      id: 'nudges',
      label: 'Proactive nudges',
      description: suggestionsEnabled ? 'On: NEXUS may suggest things' : 'Muted',
      icon: BellRing,
      checked: suggestionsEnabled,
      onSelect: () => useNexusStore.getState().toggleSuggestions(),
    },
    { id: 'd2', divider: true },
    { id: 'h-voice', heading: true, label: 'Voice' },
    {
      id: 'wake',
      label: 'Hey Warrior wake mode',
      description: recognitionSupported ? 'Uses the microphone while on' : 'Needs Chrome or Edge',
      icon: Ear,
      checked: wakeEnabled,
      disabled: !recognitionSupported,
      onSelect: toggleWakeMode,
    },
    {
      id: 'speak',
      label: 'Spoken replies',
      description: synthesisSupported ? 'Read replies to voice commands aloud' : 'Not available in this browser',
      icon: Volume2,
      checked: voiceReplies && synthesisSupported,
      disabled: !synthesisSupported,
      onSelect: toggleVoiceReplies,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line pl-3 pr-2">
        <span className="-ml-1 @min-[680px]:hidden">
          <IconButton
            icon={PanelLeft}
            size="sm"
            onClick={onToggleSidebar}
            aria-label="Show conversations"
            tooltip="Conversations"
          />
        </span>
        <NexusOrb size={30} pulse={busy} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-ui font-semibold tracking-[0.06em] text-fg">NEXUS</span>
            <BrainStatusBadge status={aiStatus} />
          </div>
          <p className="truncate text-xs text-fg-subtle" title={title}>
            {title}
            {messageCount > 0 && (
              <span className="font-mono tabular">
                {' '}
                · {messageCount} {messageCount === 1 ? 'message' : 'messages'}
              </span>
            )}
          </p>
        </div>

        <span className="hidden @min-[520px]:inline-flex">
          <NexusPomodoroPill variant="inline" />
        </span>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            icon={Layers}
            size="sm"
            active={contextEnabled}
            onClick={() => useNexusStore.getState().toggleContext()}
            aria-label="Attach OS context"
            tooltip={contextEnabled ? 'OS context on' : 'OS context off'}
          />
          <span className="hidden @min-[400px]:inline-flex">
            <NexusWakeToggle />
          </span>
          <Menu
            align="end"
            width={264}
            aria-label="NEXUS options"
            items={menuItems}
            trigger={<IconButton icon={MoreHorizontal} size="sm" aria-label="More options" />}
          />
          <span className="@min-[680px]:hidden">
            <IconButton
              icon={SquarePen}
              size="sm"
              onClick={() => useNexusStore.getState().newConversation()}
              aria-label="New conversation"
              tooltip="New chat"
            />
          </span>
        </div>
      </header>

      {/* ── Context preview ── */}
      <AnimatePresence initial={false}>
        {contextPreview !== null && contextEnabled && (
          <motion.div
            key="context-preview"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT_QUINT }}
            className="shrink-0 overflow-hidden border-b border-line bg-ink-950/40"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-control bg-accent/10 text-accent ring-1 ring-inset ring-accent/25">
                <BrainCircuit size={15} strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="hud-label text-fg-muted">What NEXUS sees</p>
                <p className="mt-0.5 text-xs text-fg-subtle">Sent with AI questions while OS context is on.</p>
                <pre className="scrollbar-thin mt-2 max-h-40 select-text overflow-y-auto whitespace-pre-wrap break-words rounded-control border border-line bg-ink-850 px-3 py-2 font-mono text-xs leading-5 text-fg-muted">
                  {contextPreview}
                </pre>
              </div>
              <IconButton
                icon={X}
                size="xs"
                onClick={() => setContextPreview(null)}
                aria-label="Close context preview"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages + composer ── */}
      <NexusChat
        conversationId={activeId}
        emptyState={<AssistEmptyState aiStatus={aiStatus} conversationId={activeId} />}
        placeholder={visitor === 'owner' ? 'Pucho NEXUS se… ya command do' : undefined}
        className="min-h-0 flex-1"
      />

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearChat}
        tone="danger"
        title="Clear this conversation?"
        description={`Its ${messageCount} ${messageCount === 1 ? 'message goes' : 'messages go'}. This can't be undone.`}
        confirmLabel="Clear messages"
      />
    </div>
  );
}

export const ChatInterface = memo(ChatInterfaceInner);
