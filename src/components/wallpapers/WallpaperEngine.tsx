// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Wallpaper Engine
// Renders the active wallpaper component, passes mouse/time/audio uniforms.
// Lite mode (and browsers without hardware WebGL) get VoidMinimal —
// CSS-only and still — and a wallpaper that crashes (lost GPU, shader
// error, …) falls back to it too instead of taking the desktop down.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, Suspense, lazy, type ComponentType } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useParallax } from '@/hooks/useParallax';
import { useAudioStore } from '@/stores/useAudioStore';
import { useLiteMode } from '@/lib/lite-mode';
import { LayerBoundary } from '@/components/showcase/AppErrorBoundary';
// Bundled directly (it is tiny): the lite / fallback wallpaper must never
// wait on — or fail with — a chunk download.
import { VoidMinimal } from './VoidMinimal';

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

// Map wallpaper ID to component
const WALLPAPER_COMPONENTS: Record<string, ComponentType<WallpaperProps>> = {
  void: VoidMinimal,
  starfield: StarField,
  nebula: NebulaShader,
  aurora: AuroraShader,
  fluid: FluidSimulation,
  matrix: CyberpunkRain,
  neural: NeuralNetwork,
};

/** Wallpapers drawn with three.js — they need WebGL. */
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

/** Software rasterisers (VMs, remote desktops, blocklisted GPUs): a full-screen shader crawls there. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

let webglAvailable: boolean | null = null;

/**
 * Hardware-accelerated WebGL is available. Probed once per page load; the
 * probe context is released right away.
 */
function hasWebGL(): boolean {
  if (webglAvailable !== null) return webglAvailable;
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const gl: WebGL2RenderingContext | WebGLRenderingContext | null =
      canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) {
      webglAvailable = false;
    } else {
      // Chromium / Safari mask RENDERER as "WebKit WebGL"; the debug
      // extension has the real name there. Firefox reports it directly.
      let renderer = String(gl.getParameter(gl.RENDERER) ?? '');
      if (/webkit webgl/i.test(renderer)) {
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
      }
      webglAvailable = !SOFTWARE_RENDERER.test(renderer);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webglAvailable = false;
  }
  return webglAvailable;
}

// Fallback while loading
function WallpaperFallback() {
  return <div className="absolute inset-0 bg-[#020204]" />;
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
        <LayerBoundary
          key={wallpaperId}
          name={`Wallpaper "${wallpaperId}"`}
          fallback={stillWallpaper}
        >
          <Suspense fallback={<WallpaperFallback />}>
            <LiveWallpaper component={component} />
          </Suspense>
        </LayerBoundary>
      )}
    </div>
  );
}

export const WallpaperEngine = memo(WallpaperEngineInner);
