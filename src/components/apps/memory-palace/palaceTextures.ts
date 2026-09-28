// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: procedural textures + materials
// Everything is generated at runtime (no asset files, works offline):
//   • label textures (signs, floating words of a room)
//   • a world-space stone/tile pattern patched into standard materials
//     so walls read as masonry and floors as tiles on any box size.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// Label textures
// ─────────────────────────────────────────────────────────────

export interface LabelTextureOptions {
  title: string;
  sub?: string;
  color: string;
  /** Plate background — 'none' draws floating text only. */
  plate?: 'dark' | 'none';
  /** Title font family (defaults to the OS display font). */
  mono?: boolean;
}

const LABEL_W = 512;

/** Draw a label to a canvas texture. Returns the texture and its aspect (w/h). */
export function createLabelTexture(opts: LabelTextureOptions): { texture: THREE.CanvasTexture; aspect: number } | null {
  if (typeof document === 'undefined') return null;
  const hasSub = Boolean(opts.sub);
  const H = hasSub ? 168 : 112;
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const family = opts.mono
    ? '"JetBrains Mono", "Fira Code", ui-monospace, monospace'
    : 'Orbitron, "Segoe UI", system-ui, sans-serif';

  if (opts.plate !== 'none') {
    ctx.fillStyle = 'rgba(6, 8, 14, 0.86)';
    roundRect(ctx, 4, 4, LABEL_W - 8, H - 8, 18);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = opts.color;
    ctx.globalAlpha = 0.85;
    roundRect(ctx, 4, 4, LABEL_W - 8, H - 8, 18);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = opts.color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = opts.plate === 'none' ? opts.color : '#ffffff';
  let size = 54;
  ctx.font = `700 ${size}px ${family}`;
  while (ctx.measureText(opts.title).width > LABEL_W - 48 && size > 18) {
    size -= 2;
    ctx.font = `700 ${size}px ${family}`;
  }
  ctx.fillText(opts.title, LABEL_W / 2, hasSub ? 62 : H / 2);

  if (hasSub && opts.sub) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = opts.color;
    let subSize = 32;
    ctx.font = `500 ${subSize}px ${family}`;
    while (ctx.measureText(opts.sub).width > LABEL_W - 48 && subSize > 14) {
      subSize -= 2;
      ctx.font = `500 ${subSize}px ${family}`;
    }
    ctx.fillText(opts.sub, LABEL_W / 2, 122);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: LABEL_W / H };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Memoised label texture that is disposed on unmount / change. */
export function useLabelTexture(opts: LabelTextureOptions): { texture: THREE.CanvasTexture; aspect: number } | null {
  const { title, sub, color, plate, mono } = opts;
  const result = useMemo(
    () => createLabelTexture({ title, sub, color, plate, mono }),
    [title, sub, color, plate, mono]
  );
  useEffect(() => () => result?.texture.dispose(), [result]);
  return result;
}

// ─────────────────────────────────────────────────────────────
// World-space surface patterns (masonry walls, tiled floors)
// ─────────────────────────────────────────────────────────────

export type SurfacePattern = 'masonry' | 'tiles' | 'panels' | 'plain';

const PATTERN_ID: Record<SurfacePattern, number> = { masonry: 0, tiles: 1, panels: 2, plain: 3 };

/**
 * A MeshStandardMaterial whose base colour is modulated by a procedural
 * world-space pattern. Works with InstancedMesh + instance colours, and
 * does not depend on UVs, so a 12 m wall and a 0.5 m pillar get the same
 * brick size.
 */
export function createPatternMaterial(
  pattern: SurfacePattern,
  params: THREE.MeshStandardMaterialParameters = {}
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.06, ...params });
  if (pattern === 'plain') return mat;
  const id = PATTERN_ID[pattern];
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPalaceWPos;\nvarying vec3 vPalaceWNormal;')
      .replace(
        '#include <worldpos_vertex>',
        [
          '#include <worldpos_vertex>',
          'vec4 palaceWP = vec4( transformed, 1.0 );',
          'vec3 palaceN = objectNormal;',
          '#ifdef USE_INSTANCING',
          '  palaceWP = instanceMatrix * palaceWP;',
          '  palaceN = mat3( instanceMatrix ) * palaceN;',
          '#endif',
          'palaceWP = modelMatrix * palaceWP;',
          'vPalaceWPos = palaceWP.xyz;',
          'vPalaceWNormal = normalize( mat3( modelMatrix ) * palaceN );',
        ].join('\n')
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        [
          '#include <common>',
          'varying vec3 vPalaceWPos;',
          'varying vec3 vPalaceWNormal;',
          'float palaceHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }',
        ].join('\n')
      )
      .replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          '{',
          '  vec3 an = abs( vPalaceWNormal );',
          '  vec2 puv = an.y > 0.5 ? vPalaceWPos.xz : ( an.x > 0.5 ? vPalaceWPos.zy : vPalaceWPos.xy );',
          `  int pid = ${id};`,
          '  float shade = 1.0;',
          '  if ( pid == 0 ) {',
          '    vec2 b = puv / vec2( 0.75, 0.36 );',
          '    b.x += step( 1.0, mod( floor( b.y ), 2.0 ) ) * 0.5;',
          '    vec2 f = fract( b );',
          '    float mortar = step( 0.035, f.x ) * step( 0.07, f.y );',
          '    float n = palaceHash( floor( b ) );',
          '    shade = mix( 0.55, 0.84 + 0.26 * n, mortar );',
          '  } else if ( pid == 1 ) {',
          '    vec2 f = fract( puv / 1.2 );',
          '    float grout = step( 0.025, f.x ) * step( 0.025, f.y ) * step( f.x, 0.975 ) * step( f.y, 0.975 );',
          '    float n = palaceHash( floor( puv / 1.2 ) );',
          '    shade = mix( 0.6, 0.86 + 0.2 * n, grout );',
          '  } else if ( pid == 2 ) {',
          '    vec2 f = fract( puv / vec2( 1.6, 1.0 ) );',
          '    float seam = step( 0.02, f.x ) * step( 0.03, f.y );',
          '    shade = mix( 0.7, 0.95 + 0.08 * palaceHash( floor( puv / vec2( 1.6, 1.0 ) ) ), seam );',
          '  }',
          '  diffuseColor.rgb *= shade;',
          '}',
        ].join('\n')
      );
  };
  mat.customProgramCacheKey = () => `palace-pattern-${id}`;
  return mat;
}
