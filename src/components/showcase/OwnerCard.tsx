// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner Card
// Reusable creator card, forged as an ID plate / dog tag: a punched tag
// strip, the initials avatar seated in a sunk socket, the stamped name,
// handle, tagline and the owner's links as steel plates (empty links are skipped).
//
//   <OwnerCard />                                  // About tab, panels
//   <OwnerCard layout="stacked" eyebrow="Built by" /> // hero screens
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { CodeXml, ExternalLink, Github, Globe, Linkedin, Mail } from 'lucide-react';
import { OWNER, type OwnerProfile } from '@/config/owner';
import { cn } from '@/lib/utils';
import { BEVEL_RAISED, BEVEL_SUNK, SLOT_FILL, STEEL_PLATE } from '@/components/ui/armor';

export type OwnerLinkId = 'github' | 'linkedin' | 'website' | 'email' | 'repo';

export interface OwnerLink {
  id: OwnerLinkId;
  label: string;
  href: string;
  /** Opens in a new tab (everything except mailto:). */
  external: boolean;
}

/** "Keshav Upadhyay" → "KU", "Keshav" → "K". */
export function getOwnerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'W';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return `${first}${last}`.toUpperCase();
}

/** The owner's non-empty links, in display order. */
export function getOwnerLinks(owner: OwnerProfile = OWNER): OwnerLink[] {
  const links: OwnerLink[] = [];
  const add = (id: OwnerLinkId, label: string, value: string, toHref = (v: string) => v) => {
    const trimmed = value.trim();
    if (trimmed) links.push({ id, label, href: toHref(trimmed), external: id !== 'email' });
  };
  add('github', 'GitHub', owner.github);
  add('linkedin', 'LinkedIn', owner.linkedin);
  add('website', 'Website', owner.website);
  add('email', 'Email', owner.email, (v) => `mailto:${v}`);
  add('repo', 'Source code', owner.repo);
  return links;
}

function OwnerLinkIcon({ id, className }: { id: OwnerLinkId; className?: string }) {
  switch (id) {
    case 'github':
      return <Github className={className} strokeWidth={1.75} aria-hidden />;
    case 'linkedin':
      return <Linkedin className={className} strokeWidth={1.75} aria-hidden />;
    case 'website':
      return <Globe className={className} strokeWidth={1.75} aria-hidden />;
    case 'email':
      return <Mail className={className} strokeWidth={1.75} aria-hidden />;
    case 'repo':
      return <CodeXml className={className} strokeWidth={1.75} aria-hidden />;
  }
}

// ─── Avatar: initials on an ink medallion inside a slowly turning ring ───
// Plasma → ember conic hairline (the forge palette); the ring rests
// under reduced motion and lite mode (animate-spin-slow).
const AVATAR_SIZES = {
  sm: 'size-11 text-sm',
  md: 'size-14 text-lg',
  lg: 'size-18 text-2xl',
} as const;

const AVATAR_RING =
  'conic-gradient(from 210deg, var(--color-plasma-400), color-mix(in oklab, var(--color-plasma-400) 0%, transparent) 38%, color-mix(in oklab, var(--color-ember-400) 0%, transparent) 62%, var(--color-ember-400) 88%, var(--color-plasma-400))';

export function OwnerAvatar({
  name = OWNER.name,
  size = 'md',
  className,
}: {
  name?: string;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <div
      className={cn('relative shrink-0 rounded-full p-[1.5px]', AVATAR_SIZES[size], className)}
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full opacity-80 animate-spin-slow" style={{ background: AVATAR_RING }} />
      <div
        className={cn(
          'relative flex size-full items-center justify-center overflow-hidden rounded-full',
          'bg-linear-to-b from-ink-600 to-ink-850 inset-shadow-[0_1px_0_rgb(255_255_255/0.08)]'
        )}
      >
        <span className="font-display font-semibold tracking-[0.06em] text-fg">{getOwnerInitials(name)}</span>
      </div>
    </div>
  );
}

// ─── Card ───
export interface OwnerCardProps {
  /** Defaults to the configured OWNER. */
  owner?: OwnerProfile;
  /** 'horizontal': avatar beside the text. 'stacked': centered column. */
  layout?: 'horizontal' | 'stacked';
  /** Small label above the name; null hides it. */
  eyebrow?: string | null;
  /** Show the link chips (empty links are always skipped). */
  showLinks?: boolean;
  className?: string;
}

function OwnerCardInner({
  owner = OWNER,
  layout = 'horizontal',
  eyebrow = 'Creator',
  showLinks = true,
  className,
}: OwnerCardProps) {
  const stacked = layout === 'stacked';
  const handle = owner.handle.trim().replace(/^@/, '');
  const links = showLinks ? getOwnerLinks(owner) : [];
  const serial = `WR-${getOwnerInitials(owner.name)}-01`;

  return (
    <section
      aria-label={`Creator: ${owner.name}`}
      data-owner-card=""
      className={cn(
        'armor-panel chamfer-tl-br [--cut:14px] rivets [--rivet-inset:7px] relative isolate overflow-hidden',
        stacked ? 'text-center' : 'text-left',
        className
      )}
    >
      {/* Faint heat wash from the plate's stamped edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-ember-500/[0.07] via-transparent to-transparent to-50%"
      />

      {/* Tag strip: punched hole, engraved eyebrow, serial */}
      {eyebrow && (
        <div
          className={cn(
            'flex items-center gap-2.5 px-5 pt-3.5 pb-2.5 shadow-[inset_0_-1px_0_rgb(0_0_0/0.55),inset_0_-2px_0_rgb(255_255_255/0.045)]',
            stacked && 'justify-center'
          )}
        >
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full bg-ink-950 shadow-[inset_0_1px_2px_rgb(0_0_0/0.9),0_1px_0_rgb(255_255_255/0.08)]"
          />
          <p className="engraved font-display text-2xs font-semibold uppercase tracking-[0.2em] text-ember-400/90">
            {eyebrow}
          </p>
          {!stacked && (
            <>
              <span
                aria-hidden
                className="h-px min-w-4 flex-1 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.12)_0_1px,transparent_1px_8px)]"
              />
              <span aria-hidden className="engraved min-w-0 truncate font-mono text-2xs tracking-[0.2em] text-fg-faint">
                ID · {serial}
              </span>
            </>
          )}
        </div>
      )}

      <div className={cn('px-5 pb-5', eyebrow ? 'pt-4' : 'pt-5')}>
        <div className={cn('relative flex gap-4', stacked ? 'flex-col items-center' : 'items-center')}>
          {/* Avatar seated in a sunk socket */}
          <span
            className={cn(
              'flex shrink-0 items-center justify-center p-1.5 chamfer [--cut:8px]',
              SLOT_FILL,
              BEVEL_SUNK
            )}
          >
            <OwnerAvatar name={owner.name} size={stacked ? 'lg' : 'md'} />
          </span>
          <div className="min-w-0">
            <p
              className="engraved truncate font-display text-lg leading-6 font-bold uppercase tracking-[0.08em] text-fg"
              title={owner.name}
            >
              {owner.name}
            </p>
            {handle && <p className="font-mono text-xs tracking-[0.04em] text-accent">@{handle}</p>}
            {owner.tagline && <p className="mt-1 text-ui text-fg-muted">{owner.tagline}</p>}
          </div>
        </div>

        {links.length > 0 && (
          <ul className={cn('relative mt-4 flex flex-wrap gap-2', stacked && 'justify-center')}>
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  aria-label={link.external ? `${link.label} (opens in a new tab)` : link.label}
                  className={cn(
                    'group/link inline-flex h-7 items-center gap-1.5 px-2.5 chamfer-sm',
                    STEEL_PLATE.replace(' text-fg', ''),
                    BEVEL_RAISED,
                    'text-xs font-medium text-fg-muted transition-[color,filter] duration-120 ease-out-quint',
                    'hover:text-fg hover:brightness-125 active:brightness-95',
                    'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:ember-edge'
                  )}
                >
                  <OwnerLinkIcon id={link.id} className="size-3.5 transition-colors duration-120 group-hover/link:text-ember-400" />
                  {link.label}
                  {link.external && <ExternalLink className="size-3 text-fg-subtle" aria-hidden />}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export const OwnerCard = memo(OwnerCardInner);
