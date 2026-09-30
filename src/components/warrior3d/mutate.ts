// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: three.js mutation helpers
// three objects are mutable by design (uniforms, opacity, scene
// environment). Frame loops update them through these helpers so the
// intent stays explicit next to React's immutability rules.
// ═══════════════════════════════════════════════════════════

import type * as THREE from 'three';

export function setUniform(material: THREE.ShaderMaterial, name: string, value: unknown): void {
  const u = material.uniforms[name];
  if (u) u.value = value;
}

export function assign<T extends object>(target: T, patch: Partial<T>): void {
  Object.assign(target, patch);
}
