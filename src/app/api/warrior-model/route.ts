// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior model probe
//
//   GET /api/warrior-model → { exists: true | false | null, draco?, bytes?, updatedAt?, extras? }
//
// extras: separate animation files next to it (warrior-<action>.glb,
// e.g. warrior-punch.glb), sharing the main model's rig.
//
// Tells the 3D avatar whether public/models/warrior.glb is present
// without a 404 request in the browser console. null = the server can't
// see its public folder (some serverless hosts); the client then falls
// back to a HEAD request on the file itself.
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  const publicDir = path.join(process.cwd(), 'public');
  try {
    await stat(publicDir);
  } catch {
    return NextResponse.json({ exists: null }, { headers });
  }
  // Draco decoder files are optional (copy three/examples/jsm/libs/draco/gltf to public/draco).
  const draco = await stat(path.join(publicDir, 'draco', 'draco_decoder.wasm')).then(
    (d) => d.isFile(),
    () => false
  );
  const modelsDir = path.join(publicDir, 'models');
  try {
    const s = await stat(path.join(modelsDir, 'warrior.glb'));
    const extras = await listAnimationFiles(modelsDir);
    return NextResponse.json(
      { exists: s.isFile() && s.size > 0, draco, bytes: s.size, updatedAt: s.mtime.toISOString(), extras },
      { headers }
    );
  } catch {
    return NextResponse.json({ exists: false, draco }, { headers });
  }
}

/** Non-empty warrior-<name>.glb files in public/models (sorted). */
async function listAnimationFiles(dir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const files = names.filter((n) => /^warrior-[a-z0-9_-]+\.glb$/i.test(n)).sort();
  const sizes = await Promise.all(
    files.map((n) =>
      stat(path.join(dir, n)).then(
        (s) => s.isFile() && s.size > 0,
        () => false
      )
    )
  );
  return files.filter((_, i) => sizes[i]).slice(0, 24);
}
