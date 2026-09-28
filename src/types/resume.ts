// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Builder Types
// Resume content sections, list entries and print styling
// ═══════════════════════════════════════════════════════════

export interface ResumePersonal {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  github: string;
  linkedin: string;
  summary: string;
}

export interface ResumeEducation {
  id: string;
  institution: string;
  degree: string;
  location: string;
  start: string;
  end: string;
  /** e.g. "CGPA 8.6 / 10" or "92.4%". */
  score: string;
  /** One line per bullet. */
  details: string;
}

export interface ResumeSkillGroup {
  id: string;
  label: string;
  /** Comma separated list. */
  items: string;
}

export interface ResumeProjectEntry {
  id: string;
  name: string;
  /** Comma separated list. */
  techStack: string;
  /** Live / demo URL. */
  link: string;
  /** Source code URL. */
  repo: string;
  start: string;
  end: string;
  /** One line per bullet. */
  bullets: string;
  /** Project Forge project this entry was imported from. */
  forgeId: string | null;
}

export interface ResumeExperience {
  id: string;
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  /** One line per bullet. */
  bullets: string;
}

export interface ResumeAchievementEntry {
  id: string;
  text: string;
  /** Warrior OS achievement this line was imported from. */
  osAchievementId: string | null;
}

/** Entry type for every list section of the resume. */
export interface ResumeItemMap {
  education: ResumeEducation;
  skills: ResumeSkillGroup;
  projects: ResumeProjectEntry;
  experience: ResumeExperience;
  achievements: ResumeAchievementEntry;
}

/** Reorderable resume sections (personal info always comes first). */
export type ResumeSectionKey = keyof ResumeItemMap;

export type ResumeLists = { [K in ResumeSectionKey]: ResumeItemMap[K][] };

export interface ResumeData extends ResumeLists {
  personal: ResumePersonal;
  sectionOrder: ResumeSectionKey[];
  hiddenSections: ResumeSectionKey[];
  updatedAt: string | null;
}

export type ResumeAccent = 'slate' | 'blue' | 'teal' | 'crimson' | 'violet';
export type ResumeFont = 'sans' | 'serif';
export type ResumeDensity = 'comfortable' | 'compact';

export interface ResumeStyle {
  accent: ResumeAccent;
  font: ResumeFont;
  density: ResumeDensity;
}
