// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Client IP for rate limiting (API routes)
//
// The first x-forwarded-for entry is whatever the client sent, so
// keying a limit on it lets one client rotate fake IPs. Prefer the
// platform's own header (Vercel sets x-real-ip and overwrites any
// client value), then the LAST x-forwarded-for hop (appended by the
// nearest proxy), then a shared fallback bucket.
// Edge-safe: no Node APIs.
// ═══════════════════════════════════════════════════════════

const MAX_KEY_LENGTH = 64;

export function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real.slice(0, MAX_KEY_LENGTH);
  const hops = req.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  const last = hops?.[hops.length - 1];
  if (last) return last.slice(0, MAX_KEY_LENGTH);
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  return (cf || 'anonymous').slice(0, MAX_KEY_LENGTH);
}
