// ═══════════════════════════════════════════════════════════
// WARRIOR OS — TypewriterText Component
// Types text character by character with blinking cursor
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TypewriterTextProps {
  text: string;
  speed?: number;       // ms per character
  delay?: number;       // ms before starting
  cursor?: boolean;
  cursorChar?: string;
  className?: string;
  onComplete?: () => void;
}

export function TypewriterText({
  text,
  speed = 40,
  delay = 0,
  cursor = true,
  cursorChar = '▊',
  className,
  onComplete,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [started, setStarted] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    const delayTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(delayTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;

    let index = 0;
    setDisplayed('');
    setIsComplete(false);

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayed(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, started]);

  return (
    <span className={cn('font-mono', className)}>
      {displayed}
      {cursor && (
        <span
          className={cn(
            'ml-0.5 inline-block',
            isComplete ? 'animate-[blink-cursor_1s_step-end_infinite]' : 'opacity-100'
          )}
        >
          {cursorChar}
        </span>
      )}
    </span>
  );
}
