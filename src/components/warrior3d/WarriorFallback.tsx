// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: static fallback plate
// Lite mode, no WebGL, or a render error: a CSS/SVG silhouette of the
// warrior on its ring platform, tinted by tier — zero GPU cost.
// ═══════════════════════════════════════════════════════════

import { cn } from '@/lib/utils';
import type { WarriorProgress, WarriorVariant } from './types';
import { tierInfo } from './progress';

interface WarriorFallbackProps {
  progress: WarriorProgress;
  variant: WarriorVariant;
  className?: string;
  /** Short status line (e.g. "Loading…", "Lite mode"). */
  note?: string;
}

// Armored silhouette in a guard stance (viewBox 0 0 200 300).
const SILHOUETTE =
  'M100 19 L112 25 L117 41 L113 55 L107 60 L107 65 L126 67 L143 71 L153 83 L151 97 L145 102 L148 128 L152 150 L154 168 L158 174 L157 189 L146 192 L141 178 L139 152 L135 128 L132 106 L128 120 L121 141 L125 153 L127 165 L131 200 L135 236 L139 257 L148 266 L147 271 L124 271 L121 258 L116 236 L108 200 L100 182 L92 200 L84 236 L79 258 L76 271 L53 271 L52 266 L61 257 L65 236 L69 200 L73 165 L75 153 L79 141 L72 120 L68 106 L65 128 L61 152 L59 178 L54 192 L43 189 L42 174 L46 168 L48 150 L52 128 L55 102 L49 97 L47 83 L57 71 L74 67 L93 65 L93 60 L87 55 L83 41 L88 25 Z';

export function WarriorFallback({ progress, variant, className, note }: WarriorFallbackProps) {
  const info = tierInfo(progress.tier);
  const trim = info.trim;
  const compact = variant === 'card';
  // Only the hall shows its own caption; hero / card sit under the page's own overlays.
  return (
    <div
      className={cn('relative isolate flex h-full w-full items-end justify-center overflow-hidden', className)}
      style={{
        background: `radial-gradient(ellipse 60% 55% at 50% 62%, rgb(16 70 84 / 0.55), transparent 70%), linear-gradient(180deg, #03171d 0%, #020b0e 100%)`,
      }}
      role="img"
      aria-label={`Warrior avatar — ${info.name} tier, level ${progress.level}`}
    >
      {/* Faint grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgb(47 214 245 / 0.12) 1px, transparent 1px), linear-gradient(90deg, rgb(47 214 245 / 0.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at 50% 80%, black 10%, transparent 65%)',
        }}
      />
      <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet" className={cn('absolute inset-x-0 bottom-[4%] mx-auto h-[88%] w-full', compact && 'bottom-[2%] h-[92%]')} aria-hidden>
        <defs>
          <linearGradient id="wf-armor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2a323b" />
            <stop offset="0.5" stopColor="#12161b" />
            <stop offset="1" stopColor="#07090b" />
          </linearGradient>
          <radialGradient id="wf-ring" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.6" stopColor="#2fd6f5" stopOpacity="0" />
            <stop offset="0.92" stopColor="#2fd6f5" stopOpacity="0.55" />
            <stop offset="1" stopColor="#2fd6f5" stopOpacity="0" />
          </radialGradient>
          <filter id="wf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        {/* Platform rings */}
        <ellipse cx="100" cy="268" rx="92" ry="18" fill="url(#wf-ring)" />
        <ellipse cx="100" cy="268" rx="70" ry="13" fill="none" stroke="#2fd6f5" strokeOpacity="0.6" strokeWidth="1.2" strokeDasharray="10 5" />
        <ellipse cx="100" cy="268" rx="50" ry="9" fill="none" stroke="#2fd6f5" strokeOpacity="0.8" strokeWidth="1.5" />
        {/* Rim glow + body */}
        <path d={SILHOUETTE} fill="none" stroke={trim} strokeOpacity="0.55" strokeWidth="3" filter="url(#wf-glow)" />
        <path d={SILHOUETTE} fill="url(#wf-armor)" stroke="#5d6773" strokeOpacity="0.5" strokeWidth="0.8" />
        {/* Seams */}
        <path d="M76 84 L94 108 M124 84 L106 108 M84 130 L116 130 M86 142 L114 142 M146 130 L150 160 M54 130 L50 160 M118 205 L124 240 M82 205 L76 240" stroke={trim} strokeWidth="1.2" strokeOpacity="0.9" fill="none" />
        {/* Visor */}
        <path d="M89 42 L100 46 L111 42" stroke="#7ce7fb" strokeWidth="2.4" fill="none" filter="url(#wf-glow)" />
        <path d="M89 42 L100 46 L111 42" stroke="#e8fbff" strokeWidth="1.2" fill="none" />
        {/* Arc reactor */}
        <circle cx="100" cy="96" r="7" fill="#2fd6f5" opacity="0.5" filter="url(#wf-glow)" />
        <circle cx="100" cy="96" r="3.4" fill="#e8fbff" />
        <circle cx="100" cy="96" r="5.4" fill="none" stroke="#2fd6f5" strokeWidth="1.2" />
      </svg>
      {variant === 'hall' && (
        <div className="absolute bottom-3 left-3 flex flex-col gap-0.5 font-mono text-2xs uppercase tracking-[0.18em] text-fg-subtle">
          <span style={{ color: trim }}>{info.name} · Lv {progress.level}</span>
          {note && <span>{note}</span>}
        </div>
      )}
    </div>
  );
}
