// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Speech (Web Speech API wrapper)
// General-purpose speech helpers for any app:
//   startListening({ onResult, onInterim, onError, onEnd, continuous })
//   stopListening()
//   speak(text)
// Chromium ships SpeechRecognition (webkit-prefixed); every other
// browser gets `supported: false` and a no-op instead of a crash.
// NEXUS voice (push-to-talk + "Hey Warrior") builds on the same
// primitives in lib/nexus/speech.ts. Only one recognition session
// can hold the mic, so starting here stops the previous session.
// ═══════════════════════════════════════════════════════════

import {
  describeRecognitionError,
  getRecognitionCtor,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  NEXUS_SPEECH_LANG,
  toSpeakableText,
  type NexusRecognition,
} from '@/lib/nexus/speech';

export { isSpeechRecognitionSupported, isSpeechSynthesisSupported };

export interface ListenOptions {
  /** Final transcript of an utterance */
  onResult: (transcript: string) => void;
  /** Partial transcript while the user is still speaking */
  onInterim?: (transcript: string) => void;
  /** Human-readable error (permission denied, no mic, ...) */
  onError?: (message: string, code: string) => void;
  /** Recognition stopped (after stopListening, silence, or an error) */
  onEnd?: () => void;
  onStart?: () => void;
  /** Keep listening across utterances until stopListening() (default false) */
  continuous?: boolean;
  /** BCP-47 language (default en-IN, which copes best with Hinglish) */
  lang?: string;
}

let active: NexusRecognition | null = null;

/**
 * Start speech recognition. Returns false when the browser has no
 * SpeechRecognition or the session could not start.
 */
export function startListening(options: ListenOptions): boolean {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    options.onError?.('Voice input needs Chrome or Edge (no Web Speech recognition here).', 'unsupported');
    return false;
  }
  stopListening();

  const recognition = new Ctor();
  recognition.lang = options.lang ?? NEXUS_SPEECH_LANG;
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => options.onStart?.();
  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0]?.transcript ?? '';
      if (result.isFinal) {
        const final = text.trim();
        if (final) options.onResult(final);
      } else {
        interim += text;
      }
    }
    if (interim.trim()) options.onInterim?.(interim.trim());
  };
  recognition.onerror = (event) => {
    if (event.error === 'aborted') return;
    options.onError?.(describeRecognitionError(event.error), event.error);
  };
  recognition.onend = () => {
    if (active === recognition) active = null;
    options.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    options.onError?.('Microphone already in use. Try again in a moment.', 'busy');
    return false;
  }
  active = recognition;
  return true;
}

/** Stop the current recognition session (no-op when idle). */
export function stopListening(): void {
  const current = active;
  active = null;
  if (!current) return;
  try {
    current.stop();
  } catch {
    try {
      current.abort();
    } catch {
      /* already stopped */
    }
  }
}

export function isListening(): boolean {
  return active !== null;
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
}

/** Speak text aloud (markdown stripped). Returns whether speech started. */
export function speak(text: string, options: SpeakOptions = {}): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  const clean = toSpeakableText(text, 800);
  if (!clean) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = options.lang ?? NEXUS_SPEECH_LANG;
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;
  const voices = synth.getVoices();
  const lang = utterance.lang.toLowerCase();
  const voice =
    voices.find((v) => v.lang.toLowerCase() === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2))) ??
    null;
  if (voice) utterance.voice = voice;
  if (options.onEnd) {
    utterance.onend = options.onEnd;
    utterance.onerror = options.onEnd;
  }
  synth.speak(utterance);
  return true;
}

/** Stop any speech in progress. */
export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
