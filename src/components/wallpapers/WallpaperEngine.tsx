// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Wallpaper Engine
// Renders the active wallpaper component, passes mouse/time/audio uniforms.
// Lite mode (and browsers without hardware WebGL) get VoidMinimal —
// CSS-only and still — and a wallpaper that crashes (lost GPU, shader
// error, …) falls back to it too instead of taking the desktop down.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, Suspense, lazy, type ComponentType, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useParallax } from '@/hooks/useParallax';
import { useAudioStore } from '@/stores/useAudioStore';
import { useLiteMode } from '@/lib/lite-mode';
import { LayerBoundary } from '@/components/showcase/AppErrorBoundary';
// Bundled directly (it is tiny): the lite / fallback wallpaper must never
// wait on — or fail with — a chunk download.
import { VoidMinimal } from './VoidMinimal';
import { hasWebGL } from './webgl-support';

// Re-export WallpaperProps for convenience
export type { WallpaperProps } from '@/types/wallpaper';
import type { WallpaperProps } from '@/types/wallpaper';

// Lazy-load heavy wallpapers (shaders, canvas)
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
// FORGED ARMOR set
const EmberStorm = lazy(() =>
  import('./EmberStorm').then((m) => ({ default: m.EmberStorm }))
);
const MoltenCore = lazy(() =>
  import('./MoltenCore').then((m) => ({ default: m.MoltenCore }))
);
const BattlefieldDusk = lazy(() =>
  import('./BattlefieldDusk').then((m) => ({ default: m.BattlefieldDusk }))
);
const SteelRain = lazy(() =>
  import('./SteelRain').then((m) => ({ default: m.SteelRain }))
);

// Map wallpaper ID to component
const WALLPAPER_COMPONENTS: Record<string, ComponentType<WallpaperProps>> = {
  void: VoidMinimal,
  embers: EmberStorm,
  molten: MoltenCore,
  dusk: BattlefieldDusk,
  steelrain: SteelRain,
  starfield: StarField,
  nebula: NebulaShader,
  aurora: AuroraShader,
  fluid: FluidSimulation,
  matrix: CyberpunkRain,
  neural: NeuralNetwork,
};

/**
 * Wallpapers drawn with three.js — they need WebGL. (Molten Core is a
 * shader too, but it carries its own 2D fallback, so it is not listed.)
 */
const WEBGL_WALLPAPERS = new Set(['nebula', 'aurora', 'fluid']);

/** Neutral uniforms for the still wallpaper: no parallax, no audio. */
const STILL_PROPS: WallpaperProps = {
  mouseX: 0,
  mouseY: 0,
  bassLevel: 0,
  midsLevel: 0,
  highsLevel: 0,
  overallLevel: 0,
};

/**
 * Wallpaper switches crossfade: the new layer fades in on top (0.5 s)
 * while the old one stays mounted underneath and fades out (0.4 s), then
 * unmounts. On first load the wallpaper rises out of the ink, which also
 * hides a shader's first blank frames. Reduced motion: an instant swap.
 */
const FADE_IN = { duration: 0.5, ease: [0.16, 1, 0.3, 1] } as const;
const FADE_OUT = { duration: 0.4, delay: 0.1, ease: [0.4, 0, 1, 1] } as const;
const INSTANT = { duration: 0 } as const;

function WallpaperLayer({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: reduceMotion ? 1 : 0, zIndex: 1 }}
      animate={{ opacity: 1, zIndex: 1, transition: reduceMotion ? INSTANT : FADE_IN }}
      exit={{ opacity: 0, zIndex: 0, transition: reduceMotion ? INSTANT : FADE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** The chosen wallpaper, fed live parallax + audio uniforms. */
function LiveWallpaper({ component: Component }: { component: ComponentType<WallpaperProps> }) {
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

  return <Component {...props} />;
}

function WallpaperEngineInner() {
  const wallpaperId = useSettingsStore((s) => s.wallpaper);
  const lite = useLiteMode();

  const component = WALLPAPER_COMPONENTS[wallpaperId] ?? VoidMinimal;
  // Still wallpaper: nothing animated per frame, no parallax or audio
  // re-renders. Lite mode, or a WebGL wallpaper without hardware WebGL.
  const still = lite || (WEBGL_WALLPAPERS.has(wallpaperId) && !hasWebGL());
  const stillWallpaper = <VoidMinimal {...STILL_PROPS} />;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {still ? (
        stillWallpaper
      ) : (
        <AnimatePresence>
          <WallpaperLayer key={wallpaperId}>
            <LayerBoundary name={`Wallpaper "${wallpaperId}"`} fallback={stillWallpaper}>
              {/* Transparent while the chunk loads: the old layer stays visible. */}
              <Suspense fallback={null}>
                <LiveWallpaper component={component} />
              </Suspense>
            </LayerBoundary>
          </WallpaperLayer>
        </AnimatePresence>
      )}
    </div>
  );
}

export const WallpaperEngine = memo(WallpaperEngineInner);
