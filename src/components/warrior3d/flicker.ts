// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: decay flicker
// Deterministic pseudo-random flicker for emissives. damage 0 → steady;
// damage 1 → frequent brown-outs; critical (decay stage 5) → hard
// drop-outs and stutter, like shorting armor.
// ═══════════════════════════════════════════════════════════

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Emissive multiplier (0…1.15) at clock time t (seconds). */
export function flicker(t: number, damage: number, critical: boolean, seed = 0): number {
  if (damage <= 0) return 1;
  const slot = Math.floor(t * (critical ? 24 : 14) + seed * 17.3);
  const r = hash(slot);
  const chance = critical ? 0.28 : damage * 0.16;
  if (r < chance) return critical && hash(slot + 91) < 0.5 ? 0.02 : 0.25 + hash(slot + 7) * 0.3;
  const hum = 1 - damage * 0.18 * (0.5 + 0.5 * Math.sin(t * 37 + seed));
  return hum * (critical ? 0.8 : 1);
}

/** 0 / 1 glitch gate for jitter (stage ≥ 4 jolts the model now and then). */
export function glitchJolt(t: number, damage: number, critical: boolean): number {
  if (damage < 0.7) return 0;
  const slot = Math.floor(t * 9);
  const r = hash(slot + 400);
  return r < (critical ? 0.12 : 0.05) ? (hash(slot + 401) - 0.5) * 2 : 0;
}
