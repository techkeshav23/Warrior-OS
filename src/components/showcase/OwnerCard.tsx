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
      return <Github className={className} aria-hidden />;
    case 'linkedin':
      return <Linkedin className={className} aria-hidden />;
    case 'website':
      return <Globe className={className} aria-hidden />;
    case 'email':
      return <Mail className={className} aria-hidden />;
    case 'repo':
      return <CodeXml className={className} aria-hidden />;
  }
}

// ─── Avatar: initials inside a slowly spinning conic ring ───
const AVATAR_SIZES = {
  md: 'h-16 w-16 text-xl',
  lg: 'h-20 w-20 text-2xl',
} as const;

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
      className={cn('relative shrink-0 rounded-full p-[2px]', AVATAR_SIZES[size], className)}
      aria-hidden
    >
      <div
        className="absolute inset-0 rounded-full animate-spin-slow"
        style={{
          background:
            'conic-gradient(from 0deg, var(--accent-primary), var(--accent-secondary), transparent 55%, var(--accent-primary))',
        }}
      />
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-surface">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(0,240,255,0.2),transparent_65%)]" />
        <span className="relative font-display font-bold tracking-wider bg-gradient-to-br from-accent-primary to-accent-secondary bg-clip-text text-transparent">
          {getOwnerInitials(name)}
        </span>
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
        'relative overflow-hidden rounded-[var(--radius-lg)] glass-glow p-5',
        stacked ? 'text-center' : 'text-left',
        className
      )}
    >
      {/* Soft corner glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-secondary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-accent-primary/10 blur-3xl"
      />

      <div className={cn('relative flex gap-4', stacked ? 'flex-col items-center' : 'items-center')}>
        <OwnerAvatar name={owner.name} size={stacked ? 'lg' : 'md'} />
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent-primary/70">
              {eyebrow}
            </p>
          )}
          <p className="mt-0.5 font-display text-lg font-bold tracking-wide text-text-primary">
            {owner.name}
          </p>
          {handle && <p className="font-mono text-xs text-accent-primary">@{handle}</p>}
          {owner.tagline && (
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">{owner.tagline}</p>
          )}
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
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5',
                  'border border-white/10 bg-white/5 font-mono text-xs text-text-secondary',
                  'transition-colors hover:border-accent-primary/50 hover:text-accent-primary',
                  'focus-ring'
                )}
              >
                <OwnerLinkIcon id={link.id} className="h-3.5 w-3.5" />
                {link.label}
                {link.external && <ExternalLink className="h-3 w-3 opacity-50" aria-hidden />}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const OwnerCard = memo(OwnerCardInner);
