// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Wallpaper Engine
// Renders the active wallpaper component, passes mouse/time/audio uniforms
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, Suspense, lazy, type ComponentType } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useParallax } from '@/hooks/useParallax';
import { useAudioStore } from '@/stores/useAudioStore';

// Re-export WallpaperProps for convenience
export type { WallpaperProps } from '@/types/wallpaper';
import type { WallpaperProps } from '@/types/wallpaper';

// Lazy-load heavy wallpapers (shaders, canvas)
const VoidMinimal = lazy(() =>
  import('./VoidMinimal').then((m) => ({ default: m.VoidMinimal }))
);
const StarField = lazy(() =>
  import('./StarField').then((m) => ({ default: m.StarField }))
);
const NebulaShader = lazy(() =>
  import('./NebulaShader').then((m) => ({ default: m.NebulaShader }))
);
const AuroraShader = lazy(() =>
  import('./AuroraShader').then((m) => ({ default: m.AuroraShader }))
);
const FluidSimulation = lazy(() =>
  import('./FluidSimulation').then((m) => ({ default: m.FluidSimulation }))
);
const CyberpunkRain = lazy(() =>
  import('./CyberpunkRain').then((m) => ({ default: m.CyberpunkRain }))
);
const NeuralNetwork = lazy(() =>
  import('./NeuralNetwork').then((m) => ({ default: m.NeuralNetwork }))
);

// Map wallpaper ID to lazy component
const WALLPAPER_COMPONENTS: Record<string, ComponentType<WallpaperProps>> = {
  void: VoidMinimal,
  starfield: StarField,
  nebula: NebulaShader,
  aurora: AuroraShader,
  fluid: FluidSimulation,
  matrix: CyberpunkRain,
  neural: NeuralNetwork,
};

// Fallback while loading
function WallpaperFallback() {
  return <div className="absolute inset-0 bg-[#020204]" />;
}

function WallpaperEngineInner() {
  const wallpaperId = useSettingsStore((s) => s.wallpaper);
  const parallax = useParallax(0.5);
  const bassLevel = useAudioStore((s) => s.bassLevel);
  const midsLevel = useAudioStore((s) => s.midsLevel);
  const highsLevel = useAudioStore((s) => s.highsLevel);
  const overallLevel = useAudioStore((s) => s.overallLevel);

  const props: WallpaperProps = useMemo(
    () => ({
      mouseX: parallax.x,
      mouseY: parallax.y,
      bassLevel,
      midsLevel,
      highsLevel,
      overallLevel,
    }),
    [parallax.x, parallax.y, bassLevel, midsLevel, highsLevel, overallLevel]
  );

  const Component = WALLPAPER_COMPONENTS[wallpaperId] ?? WALLPAPER_COMPONENTS['void'];

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <Suspense fallback={<WallpaperFallback />}>
        <Component {...props} />
      </Suspense>
    </div>
  );
}

export const WallpaperEngine = memo(WallpaperEngineInner);
