// ═══════════════════════════════════════════════════════════
// WARRIOR OS — About Tab
// System info and credits
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';

function AboutTabInner() {
  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">About</h3>

      <div className="text-center space-y-4">
        <div className="space-y-1">
          <p className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            WARRIOR OS
          </p>
          <p className="text-sm text-white/50">v4.0 — The Living World</p>
        </div>

        <p className="text-xs text-white/40 max-w-sm mx-auto leading-relaxed">
          An immersive OS-in-browser built for GATE exam preparation.
          Study hard. Build things. Become unstoppable.
        </p>

        <div className="space-y-2 text-xs text-left max-w-sm mx-auto">
          <InfoRow label="Framework" value="Next.js 16 + React 19" />
          <InfoRow label="State" value="Zustand + Immer" />
          <InfoRow label="Styling" value="Tailwind CSS 4" />
          <InfoRow label="Animation" value="Framer Motion" />
          <InfoRow label="Backend" value="Firebase" />
          <InfoRow label="Built by" value="Keshav Upadhyay" />
        </div>

        <p className="text-[10px] text-white/20 mt-6">
          &quot;Every warrior was once a beginner who refused to give up.&quot;
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between p-2 rounded bg-white/5">
      <span className="text-white/50">{label}</span>
      <span className="text-white/70">{value}</span>
    </div>
  );
}

export const AboutTab = memo(AboutTabInner);
