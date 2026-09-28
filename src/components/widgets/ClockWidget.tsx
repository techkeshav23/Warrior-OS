// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Clock Widget
// Digital clock (seconds-aligned ticks) with the date and a
// time-of-day greeting. Only this widget re-renders every second.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { useNow } from './hooks';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

function greetingFor(hour: number): string {
  if (hour < 5) return 'Burning the midnight oil';
  if (hour < 12) return 'Good morning, Warrior';
  if (hour < 17) return 'Good afternoon, Warrior';
  if (hour < 21) return 'Good evening, Warrior';
  return 'Night shift, Warrior';
}

function ClockWidgetInner() {
  const now = useNow(1000);
  const date = new Date(now);

  const hours24 = date.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const meridiem = hours24 < 12 ? 'AM' : 'PM';

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-1.5" aria-live="off">
        <time
          dateTime={date.toISOString()}
          className="font-display text-3xl font-bold tabular-nums tracking-wider text-text-primary text-glow-sm"
        >
          {String(hours12).padStart(2, '0')}:{minutes}
        </time>
        <span className="font-mono text-sm tabular-nums text-accent-primary">{seconds}</span>
        <span className="font-mono text-[10px] text-text-secondary">{meridiem}</span>
      </div>
      <p className="mt-1 truncate font-mono text-[11px] text-text-secondary">
        {date.toLocaleDateString('en-IN', DATE_FORMAT)}
      </p>
      <p className="truncate text-[10px] text-text-secondary/80">{greetingFor(hours24)}</p>
    </div>
  );
}

export const ClockWidget = memo(ClockWidgetInner);
