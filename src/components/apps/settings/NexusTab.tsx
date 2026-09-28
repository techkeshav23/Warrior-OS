// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Nexus AI Tab
// NEXUS status (offline brain or Gemini link), who it is talking to,
// and its preferences: OS context, proactive suggestions, voice replies.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { OWNER } from '@/config/owner';
import { getVisitorMode } from '@/lib/visitor';
import { useNexusStore } from '@/stores/useNexusStore';
import { fetchNexusAIStatus, type NexusAIStatus } from '@/lib/nexus/ai-client';

type LinkState = { kind: 'checking' } | { kind: 'unknown' } | { kind: 'ready'; status: NexusAIStatus };

function NexusTabInner() {
  const contextEnabled = useNexusStore((s) => s.contextEnabled);
  const suggestionsEnabled = useNexusStore((s) => s.suggestionsEnabled);
  const voiceReplies = useNexusStore((s) => s.voiceReplies);
  // Settings only renders client-side, so the stored mode is read once here.
  const [visitor] = useState(getVisitorMode);
  const [link, setLink] = useState<LinkState>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;
    void fetchNexusAIStatus().then((status) => {
      if (!cancelled) setLink(status ? { kind: 'ready', status } : { kind: 'unknown' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const brain =
    link.kind === 'checking'
      ? { label: 'Checking…', detail: 'Asking the server', tone: 'text-white/50' }
      : link.kind === 'unknown'
        ? { label: 'Offline brain', detail: 'AI route unreachable; answering locally', tone: 'text-amber-300' }
        : link.status.configured
          ? { label: 'Gemini online', detail: link.status.model, tone: 'text-green-300' }
          : { label: 'Offline brain', detail: 'No GEMINI_API_KEY on the server', tone: 'text-cyan-300' };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-white">Nexus AI</h3>
        <p className="text-xs text-white/50">
          The companion built into {OWNER.shortName}&apos;s Warrior OS: runs commands, coaches learning over your own
          decks and notes, and guides you through every app. Summon it with Ctrl+. or the Ctrl+K command bar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InfoCard title="Brain" value={brain.label} detail={brain.detail} tone={brain.tone} />
        <InfoCard
          title="Talking to"
          value={visitor === 'guest' ? 'Guest' : visitor === 'owner' ? OWNER.shortName : 'Warrior'}
          detail={visitor === 'guest' ? 'Visitor session' : visitor === 'owner' ? 'Owner session' : 'Session not chosen'}
        />
        <InfoCard title="Memory" value="This browser" detail="Chats and preferences stay local" />
        <InfoCard title="Commands" value="Instant" detail="Parsed locally, no AI call" />
      </div>

      <section className="space-y-3">
        <label className="text-xs text-white/60 font-semibold">Preferences</label>
        <ToggleRow
          label="Share OS context"
          hint="Send open apps, streak, decks and cards due with AI requests"
          enabled={contextEnabled}
          onToggle={() => useNexusStore.getState().setContextEnabled(!contextEnabled)}
        />
        <ToggleRow
          label="Proactive suggestions"
          hint="Nudges about due cards, streaks, breaks and focus"
          enabled={suggestionsEnabled}
          onToggle={() => useNexusStore.getState().setSuggestionsEnabled(!suggestionsEnabled)}
        />
        <ToggleRow
          label="Speak voice replies"
          hint="Read replies to voice commands aloud"
          enabled={voiceReplies}
          onToggle={() => useNexusStore.getState().setVoiceReplies(!voiceReplies)}
        />
      </section>
    </div>
  );
}

function InfoCard({ title, value, detail, tone }: { title: string; value: string; detail: string; tone?: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
      <p className="text-xs text-white/70 font-medium">{title}</p>
      <p className={cn('text-sm', tone ?? 'text-white/80')}>{value}</p>
      <p className="text-[11px] text-white/40 truncate" title={detail}>
        {detail}
      </p>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  enabled,
  onToggle,
}: {
  label: string;
  hint?: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-sm text-white/70">{label}</span>
        {hint && <p className="text-[11px] text-white/40">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          'w-10 h-5 shrink-0 rounded-full transition-all relative',
          enabled ? 'bg-cyan-500' : 'bg-white/20'
        )}
      >
        <div
          className={cn(
            'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all',
            enabled ? 'left-5.5' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

export const NexusTab = memo(NexusTabInner);
