// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Utilities
// Safe links, contact line, date ranges and "is this entry
// filled in" checks shared by the editor and the document
// ═══════════════════════════════════════════════════════════

import type {
  ResumeAchievementEntry,
  ResumeEducation,
  ResumeExperience,
  ResumePersonal,
  ResumeProjectEntry,
  ResumeSkillGroup,
} from '@/types/resume';

/**
 * href for user-typed links: http(s), mailto and tel pass through, bare
 * hosts get https://, any other scheme (javascript:, data:, …) is dropped.
 */
export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value)) return null;
  return `https://${value.replace(/^\/+/, '')}`;
}

/** Link text without protocol, www. or trailing slash. */
export function displayLink(url: string): string {
  return url
    .trim()
    .replace(/^(mailto:|tel:)/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

/** GitHub / LinkedIn fields accept a full URL or just the username. */
export function profileHref(kind: 'github' | 'linkedin', raw: string): string | null {
  const value = raw.trim().replace(/^@/, '');
  if (!value) return null;
  if (kind === 'linkedin' && /^in\//i.test(value)) return `https://www.linkedin.com/${value}`;
  if (/[./:]/.test(value)) return safeHref(value);
  return kind === 'github' ? `https://github.com/${value}` : `https://www.linkedin.com/in/${value}`;
}

export interface ContactItem {
  key: string;
  label: string;
  href: string | null;
}

export function contactItems(personal: ResumePersonal): ContactItem[] {
  const items: ContactItem[] = [];
  const email = personal.email.trim();
  if (email) items.push({ key: 'email', label: email, href: `mailto:${email}` });
  const phone = personal.phone.trim();
  if (phone) items.push({ key: 'phone', label: phone, href: `tel:${phone.replace(/[^\d+]/g, '')}` });
  const location = personal.location.trim();
  if (location) items.push({ key: 'location', label: location, href: null });
  const github = profileHref('github', personal.github);
  if (github) items.push({ key: 'github', label: displayLink(github), href: github });
  const linkedin = profileHref('linkedin', personal.linkedin);
  if (linkedin) items.push({ key: 'linkedin', label: displayLink(linkedin), href: linkedin });
  const website = safeHref(personal.website);
  if (website) items.push({ key: 'website', label: displayLink(website), href: website });
  return items;
}

/** "Aug 2021 – May 2025", or whichever side exists. */
export function dateRange(start: string, end: string): string {
  return [start.trim(), end.trim()].filter(Boolean).join(' – ');
}

export function hasEducation(e: ResumeEducation): boolean {
  return Boolean(e.institution.trim() || e.degree.trim());
}

export function hasExperience(e: ResumeExperience): boolean {
  return Boolean(e.role.trim() || e.company.trim());
}

export function hasProject(p: ResumeProjectEntry): boolean {
  return Boolean(p.name.trim());
}

export function hasSkillGroup(g: ResumeSkillGroup): boolean {
  return Boolean(g.items.trim());
}

export function hasAchievement(a: ResumeAchievementEntry): boolean {
  return Boolean(a.text.trim());
}
