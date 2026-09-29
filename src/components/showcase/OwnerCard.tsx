// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner Card
// Reusable creator card: animated initials avatar, name, handle,
// tagline and the owner's links (empty links are skipped).
//
//   <OwnerCard />                                  // About tab, panels
//   <OwnerCard layout="stacked" eyebrow="Built by" /> // hero screens
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { CodeXml, ExternalLink, Github, Globe, Linkedin, Mail } from 'lucide-react';
import { OWNER, type OwnerProfile } from '@/config/owner';
import { cn } from '@/lib/utils';

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

  return (
    <section
      aria-label={`Creator: ${owner.name}`}
      data-owner-card=""
      className={cn(
        'relative overflow-hidden rounded-card glass-panel p-5',
        stacked ? 'text-center' : 'text-left',
        className
      )}
    >
      <div className={cn('relative flex gap-4', stacked ? 'flex-col items-center' : 'items-center')}>
        <OwnerAvatar name={owner.name} size={stacked ? 'lg' : 'md'} />
        <div className="min-w-0">
          {eyebrow && <p className="hud-label">{eyebrow}</p>}
          <p className="mt-1 truncate text-base font-semibold text-fg" title={owner.name}>
            {owner.name}
          </p>
          {handle && <p className="font-mono text-xs text-accent">@{handle}</p>}
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
                  'inline-flex h-7 items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-2.5',
                  'text-xs font-medium text-fg-muted transition-colors duration-120 ease-out-quint',
                  'hover:border-fg-faint hover:bg-surface-hover hover:text-fg active:bg-surface-active focus-ring'
                )}
              >
                <OwnerLinkIcon id={link.id} className="size-3.5" />
                {link.label}
                {link.external && <ExternalLink className="size-3 text-fg-subtle" aria-hidden />}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const OwnerCard = memo(OwnerCardInner);
