// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useVoiceCommand
// React wrapper around lib/speech: transcript, interim text,
// listening state, errors and start/stop/toggle. Optionally hands
// every final utterance to a callback (e.g. sendToNexus or a
// dictation target). The mic always stops on unmount.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isSpeechRecognitionSupported, startListening, stopListening } from '@/lib/speech';

export interface UseVoiceCommandOptions {
  /** Called with each final transcript */
  onCommand?: (transcript: string) => void;
  /** Keep listening across utterances until stop() (default false) */
  continuous?: boolean;
  lang?: string;
}

export interface UseVoiceCommandResult {
  /** Browser has SpeechRecognition (false during SSR) */
  supported: boolean;
  isListening: boolean;
  /** Last final transcript */
  transcript: string;
  /** Live partial transcript while speaking */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  reset: () => void;
}

const noopSubscribe = () => () => {};

export function useVoiceCommand(options: UseVoiceCommandOptions = {}): UseVoiceCommandResult {
  const supported = useSyncExternalStore(noopSubscribe, isSpeechRecognitionSupported, () => false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Latest options without restarting the session when callers re-render.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const ownsMic = useRef(false);

  const stop = useCallback(() => {
    if (ownsMic.current) stopListening();
    ownsMic.current = false;
    setIsListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    setError(null);
    setInterim('');
    const { continuous, lang } = optionsRef.current;
    const started = startListening({
      continuous,
      lang,
      onStart: () => setIsListening(true),
      onInterim: (text) => setInterim(text),
      onResult: (text) => {
        setTranscript(text);
        setInterim('');
        optionsRef.current.onCommand?.(text);
      },
      onError: (message) => setError(message),
      onEnd: () => {
        ownsMic.current = false;
        setIsListening(false);
        setInterim('');
      },
    });
    ownsMic.current = started;
    if (started) setIsListening(true);
  }, []);

  const toggle = useCallback(() => {
    if (ownsMic.current) stop();
    else start();
  }, [start, stop]);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  useEffect(
    () => () => {
      if (ownsMic.current) stopListening();
      ownsMic.current = false;
    },
    []
  );

  return { supported, isListening, transcript, interim, error, start, stop, toggle, reset };
}
