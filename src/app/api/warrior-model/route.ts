// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior model probe
//
//   GET /api/warrior-model → { exists: true | false | null, draco?, bytes?, updatedAt? }
//
// Tells the 3D avatar whether public/models/warrior.glb is present
// without a 404 request in the browser console. null = the server can't
// see its public folder (some serverless hosts); the client then falls
// back to a HEAD request on the file itself.
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { stat } from 'node:fs/promises';
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
  try {
    const s = await stat(path.join(publicDir, 'models', 'warrior.glb'));
    return NextResponse.json({ exists: s.isFile() && s.size > 0, draco, bytes: s.size, updatedAt: s.mtime.toISOString() }, { headers });
  } catch {
    return NextResponse.json({ exists: false, draco }, { headers });
  }
}
