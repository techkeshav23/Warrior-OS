// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Link preview card (Open Graph)
// Next.js file convention: rendered once at build time into a
// 1200×630 PNG and linked from every page's og:image; the Twitter
// summary_large_image card inherits it (see layout.tsx).
//
// Offline by design: no images or fonts are fetched. Text uses the
// Latin font bundled with next/og, so keep every string plain Latin —
// an emoji or an uncovered symbol would make it reach for a web font.
// ═══════════════════════════════════════════════════════════

import { ImageResponse } from 'next/og';
import { OWNER } from '@/config/owner';

export const alt = `Warrior OS: ${OWNER.name}'s sci-fi command center in the browser`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#050508';
const CYAN = '#00f0ff';
const VIOLET = '#7b61ff';
const GREEN = '#00e676';
const TEXT = '#e4e4ef';
const TEXT_SECONDARY = '#a0a0b8';
const MUTED = '#6a6a80';

const FEATURES = ['Real windows', 'Terminal', '3D worlds', 'Works offline'];

/** The taskbar / lock screen system mark (24×24 shield outline). */
const SHIELD_PATH =
  'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';

// The emblem on the right: a HUD ring around the shield.
const EMBLEM = 420;
const C = EMBLEM / 2;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'W';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return `${parts[0].charAt(0)}${last}`.toUpperCase();
}

function polar(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
}

function arcPath(r: number, from: number, to: number): string {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** Tick marks every 5°, longer every 30°. */
function ticksPath(r: number): string {
  let d = '';
  for (let deg = 0; deg < 360; deg += 5) {
    const len = deg % 30 === 0 ? 12 : 5;
    const [x1, y1] = polar(r, deg);
    const [x2, y2] = polar(r - len, deg);
    d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}

function hexPath(r: number): string {
  const points = Array.from({ length: 6 }, (_, i) => polar(r, i * 60));
  return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
}

function gridLayer() {
  return (
    <svg
      width={1200}
      height={630}
      viewBox="0 0 1200 630"
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="rgba(0,240,255,0.09)" strokeWidth="1" />
        </pattern>
        <radialGradient id="grid-fade" cx="0.62" cy="0.45" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="grid-mask">
          <rect width="1200" height="630" fill="url(#grid-fade)" />
        </mask>
      </defs>
      <rect width="1200" height="630" fill="url(#grid)" mask="url(#grid-mask)" />
    </svg>
  );
}

function emblem() {
  const shieldScale = 7.2;
  const shieldOffset = C - 12 * shieldScale;
  return (
    <svg
      width={EMBLEM}
      height={EMBLEM}
      viewBox={`0 0 ${EMBLEM} ${EMBLEM}`}
      style={{ position: 'absolute', right: 58, top: 112 }}
    >
      <defs>
        <radialGradient id="core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={CYAN} stopOpacity="0.22" />
          <stop offset="1" stopColor={CYAN} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={CYAN} />
          <stop offset="1" stopColor={VIOLET} />
        </linearGradient>
      </defs>
      <circle cx={C} cy={C} r={C - 4} fill="url(#core)" />
      <circle cx={C} cy={C} r={C - 4} fill="none" stroke="rgba(0,240,255,0.16)" strokeWidth="1" />
      <path d={ticksPath(C - 14)} stroke="rgba(0,240,255,0.45)" strokeWidth="2" />
      <path d={arcPath(C - 40, -62, 28)} fill="none" stroke={CYAN} strokeWidth="4" strokeLinecap="round" />
      <path d={arcPath(C - 40, 118, 208)} fill="none" stroke={CYAN} strokeWidth="4" strokeLinecap="round" />
      <path d={arcPath(C - 56, 40, 104)} fill="none" stroke={VIOLET} strokeWidth="3" strokeLinecap="round" />
      <path d={arcPath(C - 56, 220, 284)} fill="none" stroke={VIOLET} strokeWidth="3" strokeLinecap="round" />
      <circle cx={C} cy={C} r={C - 74} fill="none" stroke="rgba(123,97,255,0.4)" strokeWidth="2" strokeDasharray="2 9" />
      <path d={hexPath(C - 92)} fill="rgba(0,240,255,0.05)" stroke="rgba(0,240,255,0.55)" strokeWidth="2" />
      <path
        d={SHIELD_PATH}
        transform={`translate(${shieldOffset} ${shieldOffset}) scale(${shieldScale})`}
        fill="rgba(0,240,255,0.10)"
        stroke="url(#shield)"
        strokeWidth={2 / shieldScale + 0.12}
        strokeLinejoin="round"
      />
      <path
        d={`M${C} 2V26M${C} ${EMBLEM - 26}V${EMBLEM - 2}M2 ${C}H26M${EMBLEM - 26} ${C}H${EMBLEM - 2}`}
        stroke={CYAN}
        strokeWidth="2"
      />
    </svg>
  );
}

/** L-shaped HUD bracket in one corner of the frame. */
function bracket(corner: 'tl' | 'tr' | 'bl' | 'br') {
  const edge = `3px solid ${CYAN}`;
  const top = corner === 'tl' || corner === 'tr';
  const left = corner === 'tl' || corner === 'bl';
  return (
    <div
      style={{
        position: 'absolute',
        width: 44,
        height: 44,
        display: 'flex',
        ...(top ? { top: 24, borderTop: edge } : { bottom: 24, borderBottom: edge }),
        ...(left ? { left: 24, borderLeft: edge } : { right: 24, borderRight: edge }),
      }}
    />
  );
}

export default function OpengraphImage() {
  const initials = initialsOf(OWNER.name);
  const handleLine = OWNER.tagline ? `@${OWNER.handle} · ${OWNER.tagline}` : `@${OWNER.handle}`;
  const source = OWNER.repo.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: BG,
          color: TEXT,
        }}
      >
        {/* Glows */}
        <div
          style={{
            position: 'absolute',
            left: -260,
            top: -300,
            width: 900,
            height: 900,
            display: 'flex',
            backgroundImage: 'radial-gradient(circle, rgba(0,240,255,0.16) 0%, rgba(0,240,255,0) 62%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: -240,
            top: -120,
            width: 1000,
            height: 1000,
            display: 'flex',
            backgroundImage: 'radial-gradient(circle, rgba(123,97,255,0.22) 0%, rgba(123,97,255,0) 58%)',
          }}
        />

        {gridLayer()}
        {emblem()}

        {/* Frame */}
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 24,
            right: 24,
            bottom: 24,
            display: 'flex',
            border: '1px solid rgba(0,240,255,0.16)',
          }}
        />
        {bracket('tl')}
        {bracket('tr')}
        {bracket('bl')}
        {bracket('br')}

        {/* Status (top right) */}
        <div
          style={{
            position: 'absolute',
            right: 72,
            top: 54,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 18px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(5,5,8,0.6)',
            fontSize: 16,
            letterSpacing: 4,
            color: TEXT_SECONDARY,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              display: 'flex',
              background: GREEN,
              boxShadow: `0 0 12px ${GREEN}`,
            }}
          />
          SYSTEM ONLINE
        </div>

        {/* Source (bottom right) */}
        {source && (
          <div
            style={{
              position: 'absolute',
              right: 72,
              bottom: 60,
              display: 'flex',
              fontSize: 18,
              letterSpacing: 1,
              color: MUTED,
            }}
          >
            {source}
          </div>
        )}

        {/* Content column */}
        <div
          style={{
            position: 'absolute',
            left: 76,
            top: 58,
            bottom: 58,
            width: 700,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <svg width={30} height={30} viewBox="0 0 24 24">
              <path d={SHIELD_PATH} fill="none" stroke={CYAN} strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <div style={{ display: 'flex', fontSize: 18, letterSpacing: 6, color: TEXT }}>
              {`${OWNER.shortName.toUpperCase()}'S SYSTEM`}
            </div>
            <div style={{ display: 'flex', width: 1, height: 18, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ display: 'flex', fontSize: 18, letterSpacing: 2, color: MUTED }}>v4.0</div>
          </div>

          {/* Title block */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 20, letterSpacing: 7, color: CYAN }}>
              PERSONAL OS / PORTFOLIO
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 4,
                fontSize: 96,
                lineHeight: 1.1,
                letterSpacing: 4,
                whiteSpace: 'nowrap',
                color: '#f4f6ff',
                textShadow: '0 0 34px rgba(0,240,255,0.55)',
              }}
            >
              WARRIOR OS
            </div>
            <div style={{ display: 'flex', marginTop: 10, fontSize: 32, color: TEXT_SECONDARY }}>
              A sci-fi command center in your browser
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              {FEATURES.map((feature) => (
                <div
                  key={feature}
                  style={{
                    display: 'flex',
                    padding: '7px 16px',
                    borderRadius: 999,
                    border: '1px solid rgba(0,240,255,0.3)',
                    background: 'rgba(0,240,255,0.07)',
                    fontSize: 18,
                    color: '#bff9ff',
                  }}
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Owner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div
              style={{
                display: 'flex',
                width: 84,
                height: 84,
                padding: 3,
                borderRadius: 999,
                backgroundImage: `linear-gradient(135deg, ${CYAN}, ${VIOLET})`,
                boxShadow: '0 0 28px rgba(0,240,255,0.35)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 999,
                  background: '#0b0b16',
                  fontSize: 32,
                  letterSpacing: 2,
                  color: CYAN,
                }}
              >
                {initials}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', fontSize: 30, letterSpacing: 5, color: TEXT }}>
                {OWNER.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', fontSize: 20, color: MUTED }}>{handleLine}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
