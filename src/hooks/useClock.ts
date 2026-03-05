// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useClock Hook
// Returns live time, date, and day — updates every second
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';

interface ClockData {
  time: string;       // HH:MM:SS
  timeShort: string;  // HH:MM AM/PM
  date: string;       // Full date string
  day: string;        // Day name
  hours: number;
  minutes: number;
  seconds: number;
}

export function useClock(): ClockData {
  const [clock, setClock] = useState<ClockData>(getClockData());

  useEffect(() => {
    const interval = setInterval(() => {
      setClock(getClockData());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return clock;
}

function getClockData(): ClockData {
  const now = new Date();
  return {
    time: now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
    timeShort: now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    date: now.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    day: now.toLocaleDateString('en-IN', { weekday: 'long' }),
    hours: now.getHours(),
    minutes: now.getMinutes(),
    seconds: now.getSeconds(),
  };
}
