// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Store
// Resume content, section layout and print style (persisted),
// plus the Project Forge → resume entry mapping
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { generateId } from '@/lib/utils';
import type { ForgeProject } from '@/types/project-forge';
import type {
  ResumeAccent,
  ResumeData,
  ResumeDensity,
  ResumeFont,
  ResumeItemMap,
  ResumePersonal,
  ResumeProjectEntry,
  ResumeSectionKey,
  ResumeStyle,
} from '@/types/resume';
import { pickLiveLink, pickRepoLink } from '@/stores/useProjectForgeStore';

// ─── Constants ───

export const RESUME_SECTION_KEYS: readonly ResumeSectionKey[] = [
  'education',
  'skills',
  'projects',
  'experience',
  'achievements',
];

export const RESUME_SECTION_LABELS: Record<ResumeSectionKey, string> = {
  education: 'Education',
  skills: 'Technical Skills',
  projects: 'Projects',
  experience: 'Experience',
  achievements: 'Achievements',
};

export const RESUME_ACCENTS: { id: ResumeAccent; label: string; hex: string }[] = [
  { id: 'slate', label: 'Graphite', hex: '#1f2937' },
  { id: 'blue', label: 'Cobalt', hex: '#1d4ed8' },
  { id: 'teal', label: 'Teal', hex: '#0f766e' },
  { id: 'crimson', label: 'Crimson', hex: '#b91c1c' },
  { id: 'violet', label: 'Violet', hex: '#6d28d9' },
];

export const RESUME_FIRST_EXPORT_ACHIEVEMENT = 'resume-first-export';

const DEFAULT_STYLE: ResumeStyle = { accent: 'slate', font: 'sans', density: 'comfortable' };

const EMPTY_PERSONAL: ResumePersonal = {
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  github: '',
  linkedin: '',
  summary: '',
};

const BLANK_ITEM: { [K in ResumeSectionKey]: (id: string) => ResumeItemMap[K] } = {
  education: (id) => ({ id, institution: '', degree: '', location: '', start: '', end: '', score: '', details: '' }),
  skills: (id) => ({ id, label: '', items: '' }),
  projects: (id) => ({
    id,
    name: '',
    techStack: '',
    link: '',
    repo: '',
    start: '',
    end: '',
    bullets: '',
    forgeId: null,
  }),
  experience: (id) => ({ id, role: '', company: '', location: '', start: '', end: '', bullets: '' }),
  achievements: (id) => ({ id, text: '', osAchievementId: null }),
};

export function createEmptyResume(): ResumeData {
  return {
    personal: { ...EMPTY_PERSONAL },
    education: [],
    // Common group labels to start from; empty groups never print.
    skills: [
      { id: 'skills-languages', label: 'Languages', items: '' },
      { id: 'skills-frameworks', label: 'Frameworks & Libraries', items: '' },
      { id: 'skills-tools', label: 'Tools & Platforms', items: '' },
    ],
    projects: [],
    experience: [],
    achievements: [],
    sectionOrder: [...RESUME_SECTION_KEYS],
    hiddenSections: [],
    updatedAt: null,
  };
}

// ─── Helpers ───

function nowISO(): string {
  return new Date().toISOString();
}

function isSectionKey(value: unknown): value is ResumeSectionKey {
  return typeof value === 'string' && (RESUME_SECTION_KEYS as readonly string[]).includes(value);
}

/** Comma / newline separated list → trimmed items. */
export function splitList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** One bullet per line; leading "-", "*", "•" or "1." markers are dropped. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•▪◦]+|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
}

function monthYear(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Maps a Project Forge project onto a resume project entry. */
export function forgeProjectToEntry(project: ForgeProject): Omit<ResumeProjectEntry, 'id'> {
  const live = pickLiveLink(project.links);
  const repo = pickRepoLink(project.links);
  return {
    name: project.name,
    techStack: project.techStack.join(', '),
    link: live?.url ?? '',
    repo: repo?.url ?? '',
    start: monthYear(project.createdAt),
    end: project.stage === 'shipped' ? monthYear(project.shippedAt ?? project.updatedAt) : 'Present',
    bullets: splitLines(project.description).join('\n'),
    forgeId: project.id,
  };
}

type Identified = { id: string };

/** Any list section viewed through its common `id` field (works on immer drafts). */
function listOf(resume: ResumeData, section: ResumeSectionKey): Identified[] {
  return resume[section];
}

function normalizeList<K extends ResumeSectionKey>(key: K, raw: unknown): ResumeItemMap[K][] {
  if (!Array.isArray(raw)) return [];
  const out: ResumeItemMap[K][] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    let id = typeof record.id === 'string' && record.id ? record.id : generateId('rx');
    if (seen.has(id)) id = generateId('rx');
    seen.add(id);
    // Keep only known fields, each with the blank entry's type.
    const merged: Record<string, unknown> = {};
    for (const [field, fallback] of Object.entries(BLANK_ITEM[key](id))) {
      const value = record[field];
      // Nullable fields (forgeId, osAchievementId) accept string | null.
      const valid =
        fallback === null ? value === null || typeof value === 'string' : typeof value === typeof fallback;
      merged[field] = valid ? value : fallback;
    }
    merged.id = id;
    out.push(merged as unknown as ResumeItemMap[K]);
  }
  return out;
}

function normalizeResume(raw: unknown): ResumeData {
  const empty = createEmptyResume();
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as Record<string, unknown>;

  const personal: ResumePersonal = { ...EMPTY_PERSONAL };
  if (r.personal && typeof r.personal === 'object') {
    const p = r.personal as Record<string, unknown>;
    for (const key of Object.keys(EMPTY_PERSONAL) as (keyof ResumePersonal)[]) {
      if (typeof p[key] === 'string') personal[key] = p[key] as string;
    }
  }

  const order: ResumeSectionKey[] = [];
  if (Array.isArray(r.sectionOrder)) {
    for (const key of r.sectionOrder) if (isSectionKey(key) && !order.includes(key)) order.push(key);
  }
  for (const key of RESUME_SECTION_KEYS) if (!order.includes(key)) order.push(key);

  const hidden = Array.isArray(r.hiddenSections)
    ? r.hiddenSections.filter(isSectionKey).filter((k, i, all) => all.indexOf(k) === i)
    : [];

  return {
    personal,
    education: normalizeList('education', r.education),
    skills: Array.isArray(r.skills) ? normalizeList('skills', r.skills) : empty.skills,
    projects: normalizeList('projects', r.projects),
    experience: normalizeList('experience', r.experience),
    achievements: normalizeList('achievements', r.achievements),
    sectionOrder: order,
    hiddenSections: hidden,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
  };
}

function normalizeStyle(raw: unknown): ResumeStyle {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STYLE };
  const s = raw as Record<string, unknown>;
  const accent = RESUME_ACCENTS.some((a) => a.id === s.accent) ? (s.accent as ResumeAccent) : DEFAULT_STYLE.accent;
  const font: ResumeFont = s.font === 'serif' ? 'serif' : 'sans';
  const density: ResumeDensity = s.density === 'compact' ? 'compact' : 'comfortable';
  return { accent, font, density };
}

// ─── Store ───

interface ResumeState {
  resume: ResumeData;
  style: ResumeStyle;
  exportCount: number;
  lastExportedAt: string | null;

  updatePersonal: (patch: Partial<ResumePersonal>) => void;
  /** Appends a blank entry and returns its id. */
  addItem: (section: ResumeSectionKey) => string;
  updateItem: <K extends ResumeSectionKey>(
    section: K,
    id: string,
    patch: Partial<Omit<ResumeItemMap[K], 'id'>>
  ) => void;
  removeItem: (section: ResumeSectionKey, id: string) => void;
  moveItem: (section: ResumeSectionKey, id: string, delta: -1 | 1) => void;
  moveSection: (key: ResumeSectionKey, delta: -1 | 1) => void;
  setSectionHidden: (key: ResumeSectionKey, hidden: boolean) => void;
  setStyle: (patch: Partial<ResumeStyle>) => void;
  /** Adds new Forge projects; for ones already imported only empty fields are filled. */
  importForgeProjects: (projects: ForgeProject[]) => { added: number; updated: number };
  /** Adds technologies missing from every skill group to a "Technologies" group. */
  addSkillsFromForge: (tags: string[]) => number;
  importAchievements: (items: { id: string; title: string; description: string }[]) => number;
  markExported: () => void;
  resetResume: () => void;
}

export const useResumeStore = create<ResumeState>()(
  persist(
    immer((set) => ({
      resume: createEmptyResume(),
      style: { ...DEFAULT_STYLE },
      exportCount: 0,
      lastExportedAt: null,

      updatePersonal: (patch) =>
        set((s) => {
          Object.assign(s.resume.personal, patch);
          s.resume.updatedAt = nowISO();
        }),

      addItem: (section) => {
        const id = generateId('rs');
        const item = BLANK_ITEM[section](id);
        set((s) => {
          listOf(s.resume, section).push(item);
          s.resume.updatedAt = nowISO();
        });
        return id;
      },

      updateItem: (section, id, patch) =>
        set((s) => {
          const item = listOf(s.resume, section).find((x) => x.id === id);
          if (!item) return;
          Object.assign(item, patch, { id });
          s.resume.updatedAt = nowISO();
        }),

      removeItem: (section, id) =>
        set((s) => {
          const list = listOf(s.resume, section);
          const index = list.findIndex((x) => x.id === id);
          if (index === -1) return;
          list.splice(index, 1);
          s.resume.updatedAt = nowISO();
        }),

      moveItem: (section, id, delta) =>
        set((s) => {
          const list = listOf(s.resume, section);
          const from = list.findIndex((x) => x.id === id);
          const to = from + delta;
          if (from === -1 || to < 0 || to >= list.length) return;
          const [item] = list.splice(from, 1);
          list.splice(to, 0, item);
          s.resume.updatedAt = nowISO();
        }),

      moveSection: (key, delta) =>
        set((s) => {
          const order = s.resume.sectionOrder;
          const from = order.indexOf(key);
          const to = from + delta;
          if (from === -1 || to < 0 || to >= order.length) return;
          order.splice(from, 1);
          order.splice(to, 0, key);
          s.resume.updatedAt = nowISO();
        }),

      setSectionHidden: (key, hidden) =>
        set((s) => {
          const list = s.resume.hiddenSections.filter((k) => k !== key);
          if (hidden) list.push(key);
          s.resume.hiddenSections = list;
          s.resume.updatedAt = nowISO();
        }),

      setStyle: (patch) =>
        set((s) => {
          s.style = normalizeStyle({ ...s.style, ...patch });
        }),

      importForgeProjects: (projects) => {
        let added = 0;
        let updated = 0;
        set((s) => {
          for (const project of projects) {
            const mapped = forgeProjectToEntry(project);
            const existing = s.resume.projects.find((e) => e.forgeId === project.id);
            if (existing) {
              // Never overwrite text the user already wrote on the resume.
              if (!existing.name.trim()) existing.name = mapped.name;
              if (!existing.techStack.trim()) existing.techStack = mapped.techStack;
              if (!existing.link.trim()) existing.link = mapped.link;
              if (!existing.repo.trim()) existing.repo = mapped.repo;
              if (!existing.start.trim()) existing.start = mapped.start;
              if (!existing.end.trim()) existing.end = mapped.end;
              if (!existing.bullets.trim()) existing.bullets = mapped.bullets;
              updated += 1;
            } else {
              s.resume.projects.push({ id: generateId('rp'), ...mapped });
              added += 1;
            }
          }
          if (added + updated > 0) s.resume.updatedAt = nowISO();
        });
        return { added, updated };
      },

      addSkillsFromForge: (tags) => {
        let added = 0;
        set((s) => {
          const known = new Set(s.resume.skills.flatMap((g) => splitList(g.items).map((t) => t.toLowerCase())));
          const fresh: string[] = [];
          for (const tag of tags) {
            const clean = tag.trim();
            const key = clean.toLowerCase();
            if (!clean || known.has(key)) continue;
            known.add(key);
            fresh.push(clean);
          }
          if (fresh.length === 0) return;
          const joined = fresh.join(', ');
          const group = s.resume.skills.find((g) => /^(tech|technologies|tech stack)$/i.test(g.label.trim()));
          if (group) {
            const current = group.items.trim().replace(/,\s*$/, '');
            group.items = current ? `${current}, ${joined}` : joined;
          } else {
            s.resume.skills.push({ id: generateId('rk'), label: 'Technologies', items: joined });
          }
          added = fresh.length;
          s.resume.updatedAt = nowISO();
        });
        return added;
      },

      importAchievements: (items) => {
        let added = 0;
        set((s) => {
          const present = new Set(
            s.resume.achievements.map((a) => a.osAchievementId).filter((x): x is string => x !== null)
          );
          for (const item of items) {
            if (present.has(item.id)) continue;
            present.add(item.id);
            const text = item.description ? `${item.title} — ${item.description}` : item.title;
            s.resume.achievements.push({ id: generateId('ra'), text, osAchievementId: item.id });
            added += 1;
          }
          if (added > 0) s.resume.updatedAt = nowISO();
        });
        return added;
      },

      markExported: () =>
        set((s) => {
          s.exportCount += 1;
          s.lastExportedAt = nowISO();
        }),

      resetResume: () =>
        set((s) => {
          s.resume = createEmptyResume();
        }),
    })),
    {
      name: 'warrior-os-resume',
      partialize: (state) => ({
        resume: state.resume,
        style: state.style,
        exportCount: state.exportCount,
        lastExportedAt: state.lastExportedAt,
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        const p = persisted as Record<string, unknown>;
        return {
          ...current,
          resume: normalizeResume(p.resume),
          style: normalizeStyle(p.style),
          exportCount: typeof p.exportCount === 'number' && p.exportCount >= 0 ? p.exportCount : 0,
          lastExportedAt: typeof p.lastExportedAt === 'string' ? p.lastExportedAt : null,
        };
      },
    }
  )
);
