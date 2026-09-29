// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Theme Sync
// Renders nothing. Mirrors theme settings into CSS variables on <html>:
//   accentColor  → --accent-primary (→ --accent, bg-accent, ring-accent…)
//   glassOpacity → --glass-alpha    (→ the window steel, bg-surface / armor-window)
// Workspace switches go through setAccentColor, so they flow through
// here too. Decay stage 3 overrides --accent-primary with a stylesheet
// !important rule, which beats this inline value while it is active.
// Mounted once at the root of the OS tree (src/app/page.tsx).
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { glassAlphaFor, resolveAccent } from '@/styles/tokens';

export function ThemeSync() {
  const accentColor = useSettingsStore((s) => s.accentColor);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-primary', resolveAccent(accentColor));
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--glass-alpha', String(glassAlphaFor(glassOpacity)));
  }, [glassOpacity]);

  return null;
}
