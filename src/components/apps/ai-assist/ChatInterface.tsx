// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AI Assist: Chat Interface
// Header (conversation title, Gemini status, OS-context toggle with
// a "what NEXUS sees" preview, voice controls, pomodoro chip, new /
// clear chat) around the NEXUS chat pane: glass bubbles, markdown +
// code blocks, typing dots, Ctrl+Enter composer, action buttons.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BellOff,
  BellRing,
  Brain,
  Eraser,
  Eye,
  Layers,
  MessageSquarePlus,
  PanelLeft,
  Sparkles,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { NEXUS_DEFAULT_CONVERSATION_TITLE, useNexusStore } from '@/stores/useNexusStore';
import { NexusChat, NexusOrb } from '@/components/nexus/NexusChat';
import { sendToNexus } from '@/components/nexus/NexusCore';
import { NexusVoiceReplyToggle, NexusWakeToggle } from '@/components/nexus/NexusVoice';
import { NexusPomodoroPill } from '@/components/nexus/NexusPomodoro';
import { buildNexusContext } from '@/lib/nexus/context';
import { NEXUS_GEMINI_MODEL } from '@/lib/nexus/protocol';
import { cn, getGreeting } from '@/lib/utils';

export type NexusAIStatus = 'checking' | 'online' | 'offline' | 'unknown';

const QUICK_PROMPTS: Array<{ label: string; prompt: string; kind: 'command' | 'ask' }> = [
  { label: 'Study mode', prompt: 'study mode', kind: 'command' },
  { label: 'DBMS quiz', prompt: 'start DBMS quiz', kind: 'command' },
  { label: 'Notes on deadlock', prompt: 'notes on deadlock', kind: 'command' },
  { label: 'Pomodoro 25', prompt: 'pomodoro 25', kind: 'command' },
  { label: 'Paging vs segmentation?', prompt: 'Explain paging vs segmentation for GATE', kind: 'ask' },
  { label: 'Plan my next 2 hours', prompt: 'Plan my next 2 hours of GATE prep based on my stats', kind: 'ask' },
  { label: 'What can you do?', prompt: 'help', kind: 'command' },
];

function AssistEmptyState({ aiStatus, conversationId }: { aiStatus: NexusAIStatus; conversationId: string | null }) {
  const [greeting] = useState(() => getGreeting());
  const send = (prompt: string) => {
    void sendToNexus(prompt, { via: 'text', conversationId: conversationId ?? undefined });
  };
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-5 py-6 text-center">
      <NexusOrb size={52} pulse />
      <div>
        <p className="font-display text-sm tracking-[0.2em] text-cyan-200">NEXUS</p>
        <p className="mt-1 text-sm text-white/80">{greeting}, warrior. Kya karna hai aaj?</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-white/50">
          Commands (apps, quizzes, notes, modes, pomodoro) turant chalte hain. Baaki sab Gemini se — GATE doubts, code,
          study plans.
        </p>
      </div>
      {aiStatus === 'offline' && (
        <div className="flex max-w-sm items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-left">
          <WifiOff size={14} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-[11px] leading-relaxed text-amber-100/80">
            Offline brain active — GEMINI_API_KEY set nahi hai. Saare OS commands, GATE concepts, exam strategy aur study
            advice phir bhi kaam karte hain; open-ended AI chat ke liye key add kar.
          </p>
        </div>
      )}
      <div className="grid w-full max-w-md grid-cols-1 gap-1.5 @min-[460px]:grid-cols-2">
        {QUICK_PROMPTS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => send(item.prompt)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs text-white/75 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/[0.08] hover:text-cyan-100"
          >
            {item.kind === 'command' ? (
              <Zap size={12} className="shrink-0 text-emerald-300/80" />
            ) : (
              <Sparkles size={12} className="shrink-0 text-violet-300/80" />
            )}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ChatInterfaceProps {
  aiStatus: NexusAIStatus;
  onToggleSidebar: () => void;
}

function ChatInterfaceInner({ aiStatus, onToggleSidebar }: ChatInterfaceProps) {
  const activeId = useNexusStore((s) => s.activeConversationId);
  const title = useNexusStore(
    (s) => s.conversations.find((c) => c.id === s.activeConversationId)?.title ?? NEXUS_DEFAULT_CONVERSATION_TITLE
  );
  const messageCount = useNexusStore(
    (s) => s.conversations.find((c) => c.id === s.activeConversationId)?.messages.length ?? 0
  );
  const contextEnabled = useNexusStore((s) => s.contextEnabled);
  const suggestionsEnabled = useNexusStore((s) => s.suggestionsEnabled);

  const [confirmClear, setConfirmClear] = useState(false);
  const [contextPreview, setContextPreview] = useState<string | null>(null);

  const clearChat = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
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
        .join('\n')
    );
  };

  const statusLine =
    aiStatus === 'online'
      ? `${NEXUS_GEMINI_MODEL} · online`
      : aiStatus === 'offline'
        ? 'offline brain · commands + GATE notes'
        : aiStatus === 'checking'
          ? 'checking AI link…'
          : 'AI status unknown';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-2.5 py-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-md p-1 text-white/55 transition-colors hover:bg-white/5 hover:text-white @min-[680px]:hidden"
          aria-label="Show conversations"
          title="Conversations"
        >
          <PanelLeft size={15} />
        </button>
        <NexusOrb size={24} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white/85">{title}</p>
          <p
            className={cn(
              'flex items-center gap-1 truncate font-mono text-[10px]',
              aiStatus === 'online' ? 'text-emerald-300/70' : aiStatus === 'offline' ? 'text-amber-300/80' : 'text-white/40'
            )}
          >
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                aiStatus === 'online' ? 'bg-emerald-400' : aiStatus === 'offline' ? 'bg-amber-400' : 'bg-white/30'
              )}
            />
            {statusLine}
          </p>
        </div>

        <span className="hidden @min-[520px]:inline-flex">
          <NexusPomodoroPill variant="inline" />
        </span>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => useNexusStore.getState().toggleContext()}
            aria-pressed={contextEnabled}
            className={cn(
              'flex items-center gap-1 rounded-md px-1.5 py-1 font-mono text-[10px] transition-colors',
              contextEnabled ? 'bg-violet-500/15 text-violet-200' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            )}
            title={
              contextEnabled
                ? 'OS context ON — level, streak, quiz stats, open apps, pomodoro and biometrics are attached to AI questions'
                : 'OS context OFF — AI questions are sent without any OS state'
            }
          >
            <Layers size={13} />
            <span className="hidden @min-[480px]:inline">Context</span>
            <span
              className={cn(
                'relative ml-0.5 inline-flex h-3 w-5 rounded-full transition-colors',
                contextEnabled ? 'bg-violet-400/70' : 'bg-white/15'
              )}
              aria-hidden
            >
              <span
                className={cn(
                  'absolute top-0.5 h-2 w-2 rounded-full bg-white transition-all',
                  contextEnabled ? 'left-2.5' : 'left-0.5'
                )}
              />
            </span>
          </button>
          <button
            type="button"
            onClick={showContext}
            disabled={!contextEnabled}
            className={cn(
              'rounded-md p-1 transition-colors',
              !contextEnabled && 'cursor-not-allowed text-white/20',
              contextEnabled && contextPreview !== null && 'bg-white/10 text-white',
              contextEnabled && contextPreview === null && 'text-white/50 hover:bg-white/5 hover:text-white/80'
            )}
            aria-label="Preview the OS context NEXUS sends"
            title="What NEXUS sees"
          >
            <Eye size={13} />
          </button>
          <NexusWakeToggle />
          <NexusVoiceReplyToggle />
          <button
            type="button"
            onClick={() => useNexusStore.getState().toggleSuggestions()}
            aria-pressed={suggestionsEnabled}
            className={cn(
              'rounded-md p-1 transition-colors',
              suggestionsEnabled ? 'text-amber-200/90 hover:bg-white/5' : 'text-white/40 hover:bg-white/5 hover:text-white/75'
            )}
            title={suggestionsEnabled ? 'Proactive NEXUS nudges on — click to mute' : 'Proactive nudges muted — click to enable'}
            aria-label="Toggle proactive suggestions"
          >
            {suggestionsEnabled ? <BellRing size={13} /> : <BellOff size={13} />}
          </button>
          <button
            type="button"
            onClick={() => useNexusStore.getState().newConversation()}
            className="rounded-md p-1 text-white/55 transition-colors hover:bg-white/5 hover:text-cyan-200"
            aria-label="New conversation"
            title="New chat"
          >
            <MessageSquarePlus size={14} />
          </button>
          <button
            type="button"
            onClick={clearChat}
            disabled={messageCount === 0}
            className={cn(
              'flex items-center gap-1 rounded-md p-1 font-mono text-[10px] transition-colors',
              messageCount === 0 && 'cursor-not-allowed text-white/20',
              messageCount > 0 && confirmClear && 'bg-rose-500/20 px-1.5 text-rose-200',
              messageCount > 0 && !confirmClear && 'text-white/55 hover:bg-white/5 hover:text-rose-200'
            )}
            aria-label={confirmClear ? 'Confirm clear conversation' : 'Clear conversation'}
            title={confirmClear ? 'Click again to clear this chat' : 'Clear chat'}
          >
            <Eraser size={14} />
            {confirmClear && <span>Clear?</span>}
          </button>
        </div>
      </div>

      {/* ── Context preview ── */}
      <AnimatePresence initial={false}>
        {contextPreview !== null && contextEnabled && (
          <motion.div
            key="context-preview"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-b border-white/10 bg-violet-500/[0.05]"
          >
            <div className="flex items-start gap-2 px-3 py-2">
              <Brain size={13} className="mt-0.5 shrink-0 text-violet-300" />
              <div className="min-w-0 flex-1">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-violet-200/80">
                  What NEXUS sees (sent with AI questions)
                </p>
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10.5px] leading-relaxed text-white/70">
                  {contextPreview}
                </pre>
              </div>
              <button
                type="button"
                onClick={() => setContextPreview(null)}
                className="shrink-0 rounded p-0.5 text-white/45 hover:text-white"
                aria-label="Close context preview"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages + composer ── */}
      <NexusChat
        conversationId={activeId}
        emptyState={<AssistEmptyState aiStatus={aiStatus} conversationId={activeId} />}
        className="min-h-0 flex-1"
      />
    </div>
  );
}

export const ChatInterface = memo(ChatInterfaceInner);
