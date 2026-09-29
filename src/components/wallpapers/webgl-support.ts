// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Hardware WebGL probe (wallpapers)
// Shared by WallpaperEngine (WebGL wallpapers fall back to Forge Night)
// and wallpapers that carry their own 2D fallback (Molten Core).
// ═══════════════════════════════════════════════════════════

/** Software rasterisers (VMs, remote desktops, blocklisted GPUs): a full-screen shader crawls there. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

let webglAvailable: boolean | null = null;

/**
 * Hardware-accelerated WebGL is available. Probed once per page load; the
 * probe context is released right away.
 */
export function hasWebGL(): boolean {
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
