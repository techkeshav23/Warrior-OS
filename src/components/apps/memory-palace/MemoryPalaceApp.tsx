// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace App (window entry point)
// The 3D scene (three.js / React Three Fiber) is loaded client-side
// only via next/dynamic({ ssr: false }) so server rendering never
// touches WebGL, window or localStorage. A WebGL check shows a
// friendly fallback on machines without GPU support.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { MonitorX } from 'lucide-react';
import { AppIcon, EmptyState } from '@/components/ui';

function PalaceLoading() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ink-950"
      role="status"
      aria-label="Raising the palace"
    >
      <div className="motion-safe:animate-pulse-soft">
        <AppIcon appId="memory-palace" size={48} active />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="hud-label text-accent">Raising the palace</div>
        <div className="h-0.5 w-40 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full w-1/3 rounded-full bg-linear-to-r from-transparent via-accent to-transparent bg-[length:200%_100%] motion-safe:animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

const PalaceScene = dynamic(() => import('./PalaceScene'), { ssr: false, loading: PalaceLoading });

let webglCache: boolean | null = null;
function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement('canvas');
    webglCache = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

const noopSubscribe = () => () => {};

function MemoryPalaceAppInner() {
  // null on the server, true/false in the browser.
  const webgl = useSyncExternalStore<boolean | null>(noopSubscribe, detectWebGL, () => null);

  if (webgl === null) return <PalaceLoading />;
  if (!webgl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-ink-950 p-6">
        <EmptyState
          tone="danger"
          icon={MonitorX}
          title="WebGL unavailable"
          description="The Memory Palace needs hardware-accelerated 3D. Turn on graphics acceleration in your browser settings, then reopen the app."
        />
      </div>
    );
  }
  return <PalaceScene />;
}

export const MemoryPalaceApp = memo(MemoryPalaceAppInner);
export default MemoryPalaceApp;
