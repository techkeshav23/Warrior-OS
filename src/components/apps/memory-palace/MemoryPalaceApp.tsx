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
import { Landmark, MonitorX } from 'lucide-react';

function PalaceLoading() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#04040a]">
      <Landmark className="h-10 w-10 animate-pulse text-accent-primary" />
      <div className="font-display text-xs tracking-[0.3em] text-accent-primary/80">RAISING THE PALACE…</div>
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
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#04040a] p-6 text-center">
        <MonitorX className="h-10 w-10 text-accent-danger" />
        <div className="font-display text-sm font-bold text-white">WebGL unavailable</div>
        <div className="max-w-sm text-xs text-white/50">
          The Memory Palace needs hardware-accelerated 3D. Enable graphics acceleration in your browser settings, then reopen the app.
        </div>
      </div>
    );
  }
  return <PalaceScene />;
}

export const MemoryPalaceApp = memo(MemoryPalaceAppInner);
export default MemoryPalaceApp;
