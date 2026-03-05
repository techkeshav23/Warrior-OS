// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Nexus AI Tab
// AI assistant configuration (placeholder for now)
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';

function NexusTabInner() {
  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">Nexus AI</h3>
      <div className="text-center space-y-3 mt-12">
        <p className="text-4xl">🤖</p>
        <p className="text-sm text-white/50">Nexus AI Configuration</p>
        <p className="text-xs text-white/30">
          The AI assistant will be configurable here in a future update.
          <br />Currently, Nexus uses default settings for all interactions.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-6 text-left">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-white/70 font-medium">Status</p>
            <p className="text-sm text-green-300">Online</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-white/70 font-medium">Model</p>
            <p className="text-sm text-white/50">Built-in</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-white/70 font-medium">Context</p>
            <p className="text-sm text-white/50">GATE Prep</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-white/70 font-medium">Memory</p>
            <p className="text-sm text-white/50">Session</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const NexusTab = memo(NexusTabInner);
