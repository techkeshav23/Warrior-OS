// ═══════════════════════════════════════════════════════════
// WARRIOR OS — About Tab
// What Warrior OS is, who built it and what it's built with
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { Eye, ShieldCheck } from 'lucide-react';
import { OWNER } from '@/config/owner';
import { getVisitorMode } from '@/lib/visitor';
import { OwnerCard } from '@/components/showcase/OwnerCard';

const STACK: ReadonlyArray<readonly [label: string, value: string]> = [
  ['Framework', 'Next.js 16 + React 19'],
  ['Language', 'TypeScript'],
  ['State', 'Zustand + Immer'],
  ['Styling', 'Tailwind CSS 4'],
  ['Motion', 'Framer Motion'],
  ['3D', 'Three.js + React Three Fiber'],
  ['Audio', 'Tone.js'],
  ['Data', 'Offline-first, stored in this browser'],
];

function AboutTabInner() {
  // Settings only renders client-side, so the stored mode is read once here.
  const [mode] = useState(getVisitorMode);

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">About</h3>

      <div className="text-center space-y-3">
        <div className="space-y-1">
          <p className="text-3xl font-display font-black tracking-wider bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            WARRIOR OS
          </p>
          <p className="text-sm text-white/50">v4.0 — The Living World</p>
        </div>

        <p className="text-xs text-white/60 max-w-md mx-auto leading-relaxed">
          Warrior OS is {OWNER.shortName}&apos;s personal operating system, running entirely in
          the browser: a sci-fi command center for everyday work, a discipline machine that turns
          habits, focus and streaks into XP, and a creative playground for code, music and
          experiments. It&apos;s offline-first, so your data lives only in this browser.
        </p>

        {mode && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-mono text-white/60">
            {mode === 'guest' ? (
              <>
                <Eye className="w-3.5 h-3.5 text-cyan-300" aria-hidden />
                Guest session · your changes stay in this browser
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" aria-hidden />
                Owner session
              </>
            )}
          </span>
        )}
      </div>

      <OwnerCard className="max-w-md mx-auto" />

      <div className="space-y-2 text-xs text-left max-w-md mx-auto">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 px-1">
          Built with
        </p>
        {STACK.map(([label, value]) => (
          <InfoRow key={label} label={label} value={value} />
        ))}
      </div>

      <p className="text-[10px] text-white/20 text-center">
        &quot;Every warrior was once a beginner who refused to give up.&quot;
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 p-2 rounded bg-white/5">
      <span className="text-white/50">{label}</span>
      <span className="text-white/70 text-right">{value}</span>
    </div>
  );
}

export const AboutTab = memo(AboutTabInner);
