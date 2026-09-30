// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Speech Helpers
// Web Speech API feature detection, speech output (the owner's cloud
// voice when the server has one, else SpeechSynthesis),
// wake-phrase matching and markdown → speakable text.
// Every browser access happens inside functions (SSR-safe).
// ═══════════════════════════════════════════════════════════

import { cloudVoiceReady, isCloudSpeaking, speakCloud, stopCloudSpeech } from '@/lib/jarvis/voice';
import { useNexusStore } from '@/stores/useNexusStore';
import { useNexusVoiceStore } from './voice-store';

// ─── Minimal SpeechRecognition typings (not in lib.dom) ───

export interface NexusRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface NexusRecognitionErrorEvent {
  error: string;
  message?: string;
}

export interface NexusRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: NexusRecognitionEvent) => void) | null;
  onerror: ((event: NexusRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export type NexusRecognitionCtor = new () => NexusRecognition;

/** SpeechRecognition constructor (Chromium: webkit-prefixed), or null. */
export function getRecognitionCtor(): NexusRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: NexusRecognitionCtor;
    webkitSpeechRecognition?: NexusRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
  );
}

/** Recognition language: Indian English copes best with Hinglish commands. */
export const NEXUS_SPEECH_LANG = 'en-IN';

/** Human-readable message for a SpeechRecognition error code. */
export function describeRecognitionError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission denied. Allow mic access in the browser to use voice.';
    case 'audio-capture':
      return 'No microphone found.';
    case 'network':
      return 'Speech service unreachable (Chrome voice needs internet).';
    case 'no-speech':
      return 'Kuch suna nahi. Mic dabake phir bol.';
    case 'language-not-supported':
      return 'Speech language not supported in this browser.';
    default:
      return `Voice error: ${code}`;
  }
}

// ─── Wake phrase ───

const WAKE_WORD = '(?:warriors?|worriers?|warior|warrier|nexus)';
/** "hey/ok/hi warrior" anywhere in the utterance. */
const WAKE_GREETING_RE = new RegExp(`\\b(?:hey|hi|hello|ok|okay|hay)[\\s,]+${WAKE_WORD}\\b[\\s,.!:;-]*`, 'i');
/** Chrome often hears "hey" as "a" or drops it — accept only at the start of an utterance. */
const WAKE_START_RE = new RegExp(`^\\s*(?:a\\s+)?${WAKE_WORD}\\b[\\s,.!:;-]*`, 'i');

export interface WakeMatch {
  matched: boolean;
  /** Text spoken after the wake phrase ('' when only the phrase was said). */
  command: string;
}

export function matchWakePhrase(transcript: string): WakeMatch {
  const match = WAKE_GREETING_RE.exec(transcript) ?? WAKE_START_RE.exec(transcript);
  if (!match) return { matched: false, command: '' };
  const command = transcript.slice(match.index + match[0].length).trim();
  return { matched: true, command };
}

// ─── Text → speech ───

/** Strip markdown/code/URLs so TTS reads a clean sentence or three. */
export function toSpeakableText(markdown: string, maxChars = 450): string {
  let text = markdown
    .replace(/```[\s\S]*?(```|$)/g, ' Code block chat mein dekh. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/(\*\*|__|~~)/g, '')
    .replace(/(^|\s)[*_](\S[^*_]*\S|\S)[*_](?=\s|[.,!?;:]|$)/g, '$1$2')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > maxChars) {
    const cut = text.slice(0, maxChars);
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    text = lastStop > maxChars * 0.5 ? cut.slice(0, lastStop + 1) : `${cut.trim()}…`;
  }
  return text;
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const byLang = (prefix: string) => voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  return byLang('en-in') ?? byLang('en-gb') ?? byLang('en-us') ?? byLang('en') ?? null;
}

/**
 * Speak a NEXUS reply. Respects the "voice replies" preference unless
 * `force` is set (an explicit replay click). Returns whether speech started.
 */
export function speakNexus(text: string, options: { force?: boolean } = {}): boolean {
  if (!options.force && !useNexusStore.getState().voiceReplies) return false;
  const clean = toSpeakableText(text);
  if (!clean) return false;

  // Owner with a server voice: natural speech, browser voice as fallback.
  if (cloudVoiceReady()) {
    stopSpeaking();
    const setSpeaking = (speaking: boolean) => useNexusVoiceStore.getState().patch({ speaking });
    setSpeaking(true);
    void speakCloud(clean, () => setSpeaking(false)).then((started) => {
      if (!started && !speakBrowser(clean)) setSpeaking(false);
    });
    return true;
  }
  return speakBrowser(clean);
}

/** The browser's built-in voice (SpeechSynthesis). */
function speakBrowser(clean: string): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = NEXUS_SPEECH_LANG;
  utterance.rate = 1.03;
  utterance.pitch = 0.92;
  const voice = pickVoice(synth.getVoices());
  if (voice) utterance.voice = voice;

  const setSpeaking = (speaking: boolean) => useNexusVoiceStore.getState().patch({ speaking });
  utterance.onstart = () => setSpeaking(true);
  utterance.onend = () => setSpeaking(false);
  utterance.onerror = () => setSpeaking(false);
  synth.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  stopCloudSpeech();
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
  useNexusVoiceStore.getState().patch({ speaking: false });
}

export function isSpeaking(): boolean {
  return isCloudSpeaking() || (isSpeechSynthesisSupported() && window.speechSynthesis.speaking);
}
