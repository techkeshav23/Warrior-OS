// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Voice
// Web Speech API input (SpeechRecognition, Chromium) + output
// (SpeechSynthesis). Push-to-talk and an opt-in "Hey Warrior"
// wake mode. The microphone only starts from a click; a global
// HUD indicator is visible whenever it is on; spoken replies can
// be muted. Unsupported browsers get a clear disabled state.
//
// The recognition session lives in a module-level controller so
// it survives the AI Assist window being minimised or closed;
// NexusLayer shuts it down when the desktop unmounts.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Ear, EarOff, LoaderCircle, Mic, MicOff, Square, Volume2, VolumeX, X } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useNexusStore } from '@/stores/useNexusStore';
import { useNexusVoiceStore } from '@/lib/nexus/voice-store';
import {
  describeRecognitionError,
  getRecognitionCtor,
  isSpeaking,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  matchWakePhrase,
  NEXUS_SPEECH_LANG,
  stopSpeaking,
  type NexusRecognition,
} from '@/lib/nexus/speech';
import { playNexusChime } from '@/lib/nexus/chime';
import { NEXUS_ACHIEVEMENTS, sendToNexus, unlockNexusAchievement } from './NexusCore';
import { cn } from '@/lib/utils';
import type { NexusVoiceState } from '@/types/nexus';

export const NEXUS_VOICE_UNSUPPORTED =
  'Voice input needs a Chromium browser (Chrome or Edge) — this browser has no Web Speech recognition.';

const WAKE_CAPTURE_MS = 8000;
const LAST_REPLY_MS = 9000;

// ─── Controller (module singleton; only touched from handlers/callbacks) ───

interface VoiceController {
  recognition: NexusRecognition | null;
  mode: 'push' | 'wake' | null;
  wakeWanted: boolean;
  awaitingUntil: number;
  startedAt: number;
  quickEnds: number;
  pushGotFinal: boolean;
  restartTimer: number | null;
  captureTimer: number | null;
  replyTimer: number | null;
}

const ctl: VoiceController = {
  recognition: null,
  mode: null,
  wakeWanted: false,
  awaitingUntil: 0,
  startedAt: 0,
  quickEnds: 0,
  pushGotFinal: false,
  restartTimer: null,
  captureTimer: null,
  replyTimer: null,
};

function patch(partial: Partial<NexusVoiceState>): void {
  useNexusVoiceStore.getState().patch(partial);
}

function clearTimer(name: 'restartTimer' | 'captureTimer' | 'replyTimer'): void {
  const id = ctl[name];
  if (id !== null) window.clearTimeout(id);
  ctl[name] = null;
}

function detach(rec: NexusRecognition): void {
  rec.onstart = null;
  rec.onresult = null;
  rec.onerror = null;
  rec.onend = null;
}

function teardownRecognition(): void {
  clearTimer('restartTimer');
  const rec = ctl.recognition;
  ctl.recognition = null;
  ctl.mode = null;
  if (rec) {
    detach(rec);
    try {
      rec.abort();
    } catch {
      /* already stopped */
    }
  }
  patch({ micActive: false, interim: '' });
}

async function handleVoiceCommand(raw: string): Promise<void> {
  const text = raw.trim();
  if (!text) return;
  unlockNexusAchievement(NEXUS_ACHIEVEMENTS.firstVoice);
  clearTimer('replyTimer');
  patch({ processing: true, lastHeard: text, lastReply: '', capturing: false, interim: '', error: null });
  try {
    const turn = await sendToNexus(text, { via: 'voice' });
    patch({ lastReply: turn?.reply ?? '' });
    ctl.replyTimer = window.setTimeout(() => {
      ctl.replyTimer = null;
      patch({ lastReply: '' });
    }, LAST_REPLY_MS);
  } finally {
    patch({ processing: false });
  }
}

function scheduleWakeRestart(delayMs: number): void {
  clearTimer('restartTimer');
  ctl.restartTimer = window.setTimeout(() => {
    ctl.restartTimer = null;
    if (ctl.wakeWanted && !ctl.recognition) startWakeRecognition();
  }, delayMs);
}

function handleWakeFinal(transcript: string): void {
  const now = Date.now();
  if (now < ctl.awaitingUntil) {
    ctl.awaitingUntil = 0;
    clearTimer('captureTimer');
    patch({ capturing: false });
    void handleVoiceCommand(transcript);
    return;
  }
  const wake = matchWakePhrase(transcript);
  if (!wake.matched) return;
  unlockNexusAchievement(NEXUS_ACHIEVEMENTS.wakeWord);
  if (wake.command) {
    void handleVoiceCommand(wake.command);
    return;
  }
  // Bare "Hey Warrior": the next utterance within 8 s is the command.
  ctl.awaitingUntil = now + WAKE_CAPTURE_MS;
  playNexusChime('wake');
  patch({ capturing: true, interim: '' });
  clearTimer('captureTimer');
  ctl.captureTimer = window.setTimeout(() => {
    ctl.captureTimer = null;
    ctl.awaitingUntil = 0;
    patch({ capturing: false, interim: '' });
  }, WAKE_CAPTURE_MS);
}

function startWakeRecognition(): void {
  const Ctor = getRecognitionCtor();
  if (!Ctor || !ctl.wakeWanted || ctl.recognition) return;
  // Hidden tabs cannot capture; NexusLayer resumes on visibilitychange.
  if (document.visibilityState === 'hidden') return;

  const rec = new Ctor();
  rec.lang = NEXUS_SPEECH_LANG;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (event) => {
    if (isSpeaking()) return; // never react to our own TTS
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = (result[0]?.transcript ?? '').trim();
      if (!transcript) continue;
      if (result.isFinal) handleWakeFinal(transcript);
      else interim += `${transcript} `;
    }
    const heard = interim.trim();
    if (heard && (Date.now() < ctl.awaitingUntil || matchWakePhrase(heard).matched)) {
      patch({ interim: heard });
    }
  };

  rec.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
      ctl.wakeWanted = false;
      patch({ wakeEnabled: false, error: describeRecognitionError(event.error) });
      return;
    }
    patch({ error: describeRecognitionError(event.error) }); // e.g. network — onend retries
  };

  rec.onend = () => {
    if (ctl.recognition === rec) {
      ctl.recognition = null;
      ctl.mode = null;
    }
    patch({ micActive: false, capturing: false, interim: '' });
    if (!ctl.wakeWanted) {
      patch({ mode: 'off' });
      return;
    }
    // Chrome ends continuous sessions periodically — restart, but bail on a crash loop.
    ctl.quickEnds = Date.now() - ctl.startedAt < 2000 ? ctl.quickEnds + 1 : 0;
    if (ctl.quickEnds >= 5) {
      ctl.wakeWanted = false;
      patch({
        mode: 'off',
        wakeEnabled: false,
        error: 'Voice service baar baar ruk raha hai — wake mode band kar diya.',
      });
      return;
    }
    scheduleWakeRestart(ctl.quickEnds > 0 ? 1500 : 300);
  };

  ctl.recognition = rec;
  ctl.mode = 'wake';
  ctl.startedAt = Date.now();
  patch({ supported: true, mode: 'wake', micActive: true, capturing: false });
  try {
    rec.start();
  } catch {
    detach(rec);
    ctl.recognition = null;
    ctl.mode = null;
    patch({ micActive: false });
    scheduleWakeRestart(1500);
  }
}

// ─── Public controls (call from click handlers) ───

/** Push-to-talk: start a single utterance; a second click stops it. */
export function startPushToTalk(): void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    patch({ supported: false, error: NEXUS_VOICE_UNSUPPORTED });
    return;
  }
  if (ctl.mode === 'push' && ctl.recognition) {
    try {
      ctl.recognition.stop();
    } catch {
      teardownRecognition();
    }
    return;
  }

  stopSpeaking();
  teardownRecognition(); // pauses wake listening while push-to-talk runs

  const rec = new Ctor();
  rec.lang = NEXUS_SPEECH_LANG;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  ctl.pushGotFinal = false;

  rec.onresult = (event) => {
    let interim = '';
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? '';
      if (result.isFinal) finalText += transcript;
      else interim += transcript;
    }
    if (interim.trim()) patch({ interim: interim.trim() });
    if (finalText.trim() && !ctl.pushGotFinal) {
      ctl.pushGotFinal = true;
      try {
        rec.stop();
      } catch {
        /* already stopping */
      }
      void handleVoiceCommand(finalText);
    }
  };

  rec.onerror = (event) => {
    if (event.error === 'aborted') return;
    patch({ error: describeRecognitionError(event.error) });
  };

  rec.onend = () => {
    if (ctl.recognition === rec) {
      ctl.recognition = null;
      ctl.mode = null;
    }
    patch({ micActive: false, mode: ctl.wakeWanted ? 'wake' : 'off', interim: '' });
    if (ctl.wakeWanted) scheduleWakeRestart(400);
  };

  ctl.recognition = rec;
  ctl.mode = 'push';
  patch({ supported: true, mode: 'push', micActive: true, interim: '', error: null, capturing: false });
  try {
    rec.start();
  } catch {
    detach(rec);
    ctl.recognition = null;
    ctl.mode = null;
    patch({ micActive: false, mode: ctl.wakeWanted ? 'wake' : 'off', error: 'Mic start nahi ho paaya. Dobara try kar.' });
    if (ctl.wakeWanted) scheduleWakeRestart(400);
  }
}

/** Toggle the opt-in "Hey Warrior" wake mode (click handler only). */
export function toggleWakeMode(): void {
  if (ctl.wakeWanted) {
    disableWakeMode();
    return;
  }
  if (!getRecognitionCtor()) {
    patch({ supported: false, error: NEXUS_VOICE_UNSUPPORTED });
    return;
  }
  ctl.wakeWanted = true;
  ctl.quickEnds = 0;
  patch({ wakeEnabled: true, error: null });
  startWakeRecognition();
}

export function disableWakeMode(): void {
  ctl.wakeWanted = false;
  ctl.awaitingUntil = 0;
  clearTimer('captureTimer');
  clearTimer('restartTimer');
  if (ctl.mode === 'wake') teardownRecognition();
  patch({ wakeEnabled: false, capturing: false, mode: ctl.mode === 'push' ? 'push' : 'off' });
}

/** Resume wake listening after the tab becomes visible again. */
export function resumeWakeIfWanted(): void {
  if (ctl.wakeWanted && !ctl.recognition) startWakeRecognition();
}

/** Stop everything (mic + speech). Called when the desktop unmounts. */
export function shutdownNexusVoice(): void {
  ctl.wakeWanted = false;
  ctl.awaitingUntil = 0;
  clearTimer('captureTimer');
  clearTimer('replyTimer');
  teardownRecognition();
  stopSpeaking();
  useNexusVoiceStore.getState().reset();
}

// ─── Support detection (browser-only, hydration-safe) ───

function subscribeNever(): () => void {
  return () => {};
}

export function useSpeechRecognitionSupported(): boolean {
  return useSyncExternalStore(subscribeNever, isSpeechRecognitionSupported, () => false);
}

export function useSpeechSynthesisSupported(): boolean {
  return useSyncExternalStore(subscribeNever, isSpeechSynthesisSupported, () => false);
}

// ─── UI: push-to-talk button ───

function NexusVoiceButtonInner({ className }: { className?: string }) {
  const supported = useSpeechRecognitionSupported();
  const mode = useNexusVoiceStore((s) => s.mode);
  const micActive = useNexusVoiceStore((s) => s.micActive);
  const listening = mode === 'push' && micActive;

  if (!supported) {
    return (
      <span className={cn('inline-flex shrink-0', className)} title={NEXUS_VOICE_UNSUPPORTED}>
        <IconButton icon={MicOff} size="sm" disabled aria-label="Voice input unavailable in this browser" />
      </span>
    );
  }

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {listening && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-control ring-1 ring-danger/60"
          animate={{ opacity: [0.9, 0.2, 0.9], scale: [1, 1.14, 1] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <IconButton
        icon={Mic}
        size="sm"
        onClick={startPushToTalk}
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : 'Push to talk'}
        tooltip={listening ? 'Listening… click to stop' : 'Push to talk'}
        variant={listening ? 'danger' : 'ghost'}
      />
    </span>
  );
}

export const NexusVoiceButton = memo(NexusVoiceButtonInner);

// ─── UI: wake mode toggle ───

function NexusWakeToggleInner({ className }: { className?: string }) {
  const supported = useSpeechRecognitionSupported();
  const wakeEnabled = useNexusVoiceStore((s) => s.wakeEnabled);

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <IconButton
        icon={wakeEnabled ? Ear : EarOff}
        size="sm"
        onClick={toggleWakeMode}
        disabled={!supported}
        active={wakeEnabled}
        aria-label='"Hey Warrior" wake mode'
        tooltip={
          !supported
            ? 'Wake mode needs Chrome or Edge'
            : wakeEnabled
              ? 'Wake mode on: listening for "Hey Warrior"'
              : 'Turn on "Hey Warrior" wake mode'
        }
      />
      {wakeEnabled && (
        <span aria-hidden className="pointer-events-none absolute right-1 top-1 flex size-1.5">
          <span className="absolute inset-0 rounded-full bg-danger opacity-60 motion-safe:animate-ping" />
          <span className="relative size-1.5 rounded-full bg-danger" />
        </span>
      )}
    </span>
  );
}

export const NexusWakeToggle = memo(NexusWakeToggleInner);

// ─── UI: spoken-replies mute toggle ───

function NexusVoiceReplyToggleInner({ className }: { className?: string }) {
  const supported = useSpeechSynthesisSupported();
  const voiceReplies = useNexusStore((s) => s.voiceReplies);

  const toggle = () => {
    const next = !useNexusStore.getState().voiceReplies;
    useNexusStore.getState().setVoiceReplies(next);
    if (!next) stopSpeaking();
  };

  const on = voiceReplies && supported;
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      <IconButton
        icon={on ? Volume2 : VolumeX}
        size="sm"
        onClick={toggle}
        disabled={!supported}
        active={on}
        aria-label="Spoken replies"
        tooltip={
          !supported ? 'Speech output is not available in this browser' : on ? 'Spoken replies on' : 'Spoken replies muted'
        }
      />
    </span>
  );
}

export const NexusVoiceReplyToggle = memo(NexusVoiceReplyToggleInner);

// ─── UI: global listening indicator (HUD) ───

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function NexusVoiceIndicatorInner() {
  const mode = useNexusVoiceStore((s) => s.mode);
  const micActive = useNexusVoiceStore((s) => s.micActive);
  const wakeEnabled = useNexusVoiceStore((s) => s.wakeEnabled);
  const capturing = useNexusVoiceStore((s) => s.capturing);
  const processing = useNexusVoiceStore((s) => s.processing);
  const speaking = useNexusVoiceStore((s) => s.speaking);
  const interim = useNexusVoiceStore((s) => s.interim);
  const lastHeard = useNexusVoiceStore((s) => s.lastHeard);
  const lastReply = useNexusVoiceStore((s) => s.lastReply);
  const error = useNexusVoiceStore((s) => s.error);
  const reduce = useReducedMotion();

  const visible = micActive || wakeEnabled || capturing || processing || speaking || !!error || !!lastReply;

  let tone: 'danger' | 'live' | 'armed' | 'busy' | 'info' = 'info';
  let label: string;
  let detail = '';
  if (error) {
    tone = 'danger';
    label = error;
  } else if (processing) {
    tone = 'busy';
    label = 'NEXUS is thinking…';
    detail = lastHeard ? `“${truncate(lastHeard, 60)}”` : '';
  } else if (speaking) {
    tone = 'busy';
    label = 'NEXUS is speaking';
    detail = lastReply ? truncate(lastReply, 80) : '';
  } else if (capturing) {
    tone = 'live';
    label = 'Listening for your command';
    detail = interim ? `“${truncate(interim, 60)}”` : '';
  } else if (mode === 'push' && micActive) {
    tone = 'live';
    label = 'Listening…';
    detail = interim ? `“${truncate(interim, 60)}”` : '';
  } else if (lastReply) {
    tone = 'info';
    label = `NEXUS: ${truncate(lastReply, 90)}`;
  } else if (wakeEnabled) {
    tone = 'armed';
    label = 'Wake mode · say “Hey Warrior”';
  } else {
    label = '';
  }

  return (
    <AnimatePresence>
      {visible && label && (
        <motion.div
          key="nexus-voice-hud"
          role="status"
          aria-live="polite"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'glass-popover pointer-events-auto flex min-h-10 max-w-[min(420px,calc(100vw_-_24px))] items-center gap-2.5 rounded-full py-1 pl-3 pr-1',
            tone === 'danger' && 'border-danger/40',
            tone === 'live' && 'border-danger/35',
            tone === 'armed' && 'border-accent/30'
          )}
        >
          {/* Mic state dot — always shown while the microphone is capturing */}
          <span className="relative flex size-2.5 shrink-0 items-center justify-center" aria-hidden>
            {micActive && (
              <span
                className={cn(
                  'absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping',
                  tone === 'armed' ? 'bg-accent' : 'bg-danger'
                )}
              />
            )}
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                !micActive && (tone === 'danger' ? 'bg-danger' : 'bg-fg-subtle'),
                micActive && tone === 'armed' && 'bg-accent',
                micActive && tone !== 'armed' && 'bg-danger'
              )}
            />
          </span>

          {processing && <LoaderCircle size={14} strokeWidth={2} className="shrink-0 animate-spin text-accent" aria-hidden />}
          {!processing && speaking && <Volume2 size={14} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />}
          {!processing && !speaking && (mode === 'push' || capturing) && micActive && (
            <Mic size={14} strokeWidth={1.75} className="shrink-0 text-danger" aria-hidden />
          )}

          <div className="min-w-0 flex-1 py-0.5">
            <p className={cn('truncate text-xs font-medium', tone === 'danger' ? 'text-danger' : 'text-fg')}>{label}</p>
            {detail && <p className="truncate text-2xs text-fg-subtle">{detail}</p>}
          </div>

          <span className="flex shrink-0 items-center">
            {speaking && <IconButton icon={Square} iconSize={12} size="xs" onClick={stopSpeaking} aria-label="Stop speaking" tooltip />}
            {micActive && mode === 'push' && (
              <IconButton icon={MicOff} iconSize={13} size="xs" onClick={startPushToTalk} aria-label="Stop listening" tooltip />
            )}
            {wakeEnabled && (
              <IconButton
                icon={EarOff}
                iconSize={13}
                size="xs"
                onClick={disableWakeMode}
                aria-label="Turn off wake mode"
                tooltip="Turn off Hey Warrior wake mode"
              />
            )}
            {(error || (!!lastReply && !processing && !speaking)) && (
              <IconButton
                icon={X}
                iconSize={13}
                size="xs"
                onClick={() => patch({ error: null, lastReply: '' })}
                aria-label="Dismiss"
                tooltip
              />
            )}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const NexusVoiceIndicator = memo(NexusVoiceIndicatorInner);
