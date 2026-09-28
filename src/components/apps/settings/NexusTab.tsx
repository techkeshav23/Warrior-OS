// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Nexus AI Tab
// NEXUS status (offline brain or Gemini link), who it is talking to,
// and its preferences: OS context, proactive suggestions, voice replies.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState } from 'react';
import { Bot, BrainCircuit, HardDrive, TerminalSquare, UserRound } from 'lucide-react';
import { Card, Kbd, Skeleton, TONE_TEXT, type Tone } from '@/components/ui';
import { OWNER } from '@/config/owner';
import { getVisitorMode } from '@/lib/visitor';
import { useNexusStore } from '@/stores/useNexusStore';
import { fetchNexusAIStatus, type NexusAIStatus } from '@/lib/nexus/ai-client';
import { SettingsCard, SettingsPage, SettingsSection, SpecItem, SwitchRow } from './parts';

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

  const brain: { label: string; detail: string; tone: Tone } | null =
    link.kind === 'checking'
      ? null
      : link.kind === 'unknown'
        ? { label: 'Offline brain', detail: 'AI route unreachable; answering locally', tone: 'warning' }
        : link.status.configured
          ? { label: 'Gemini online', detail: link.status.model, tone: 'success' }
          : { label: 'Offline brain', detail: 'No GEMINI_API_KEY on the server', tone: 'accent' };

  const nexus = useNexusStore.getState;

  return (
    <SettingsPage>
      {/* Identity */}
      <Card hud>
        <div className="flex items-start gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-card border border-plasma-400/30 bg-plasma-400/10 text-plasma-400">
            <Bot size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-ui text-fg-muted">
              The companion built into {OWNER.shortName}&apos;s Warrior OS: runs commands, coaches learning over
              your own decks and notes, and guides you through every app.
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-fg-subtle">
              Summon it with <Kbd keys={['Ctrl', '.']} size="sm" /> or the <Kbd keys={['Ctrl', 'K']} size="sm" />{' '}
              command bar.
            </p>
          </div>
        </div>
      </Card>

      {/* Status */}
      <SettingsSection title="Status">
        <Card>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 @sm:grid-cols-2 @2xl:grid-cols-4">
            <SpecItem icon={BrainCircuit} label="Brain" detail={brain?.detail} reserveDetail>
              {brain ? (
                <span className={TONE_TEXT[brain.tone]}>{brain.label}</span>
              ) : (
                <Skeleton className="mt-1 h-3.5 w-24" />
              )}
            </SpecItem>
            <SpecItem
              icon={UserRound}
              label="Talking to"
              detail={
                visitor === 'guest' ? 'Visitor session' : visitor === 'owner' ? 'Owner session' : 'Session not chosen'
              }
            >
              {visitor === 'guest' ? 'Guest' : visitor === 'owner' ? OWNER.shortName : 'Warrior'}
            </SpecItem>
            <SpecItem icon={HardDrive} label="Memory" detail="Chats and preferences stay local">
              This browser
            </SpecItem>
            <SpecItem icon={TerminalSquare} label="Commands" detail="Parsed locally, no AI call">
              Instant
            </SpecItem>
          </div>
        </Card>
      </SettingsSection>

      {/* Preferences */}
      <SettingsSection title="Preferences" description="What NEXUS may see and do. Saved in this browser.">
        <SettingsCard>
          <SwitchRow
            label="Share OS context"
            description="Send open apps, streak, decks and cards due with AI requests."
            checked={contextEnabled}
            onCheckedChange={() => nexus().setContextEnabled(!contextEnabled)}
          />
          <SwitchRow
            label="Proactive suggestions"
            description="Nudges about due cards, streaks, breaks and focus."
            checked={suggestionsEnabled}
            onCheckedChange={() => nexus().setSuggestionsEnabled(!suggestionsEnabled)}
          />
          <SwitchRow
            label="Speak voice replies"
            description="Read replies to voice commands aloud."
            checked={voiceReplies}
            onCheckedChange={() => nexus().setVoiceReplies(!voiceReplies)}
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

export const NexusTab = memo(NexusTabInner);
