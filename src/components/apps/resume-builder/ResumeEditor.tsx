// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Editor
// Accordion of section cards: personal info, education, skills,
// projects (with Project Forge import), experience, achievements
// (with Warrior OS import) and layout/style. Saves on every
// keystroke. Entries are unbordered wells inside their card.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState, type CSSProperties } from 'react';
import {
  type LucideIcon,
  Anvil,
  ArrowDown,
  ArrowUp,
  Briefcase,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Info,
  Palette,
  Rocket,
  RotateCcw,
  Trophy,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, IconButton, SegmentedControl } from '@/components/ui';
import { ConfirmButton } from '@/components/apps/project-forge/ConfirmButton';
import { useProjectForgeStore } from '@/stores/useProjectForgeStore';
import { RESUME_ACCENTS, RESUME_SECTION_LABELS, useResumeStore } from '@/stores/useResumeStore';
import type { ResumeDensity, ResumeFont, ResumeSectionKey } from '@/types/resume';
import { AddButton, EntryCard, TextAreaField, TextField } from './EditorFields';
import { AchievementImportDialog, ForgeImportDialog } from './ImportDialogs';
import { hasAchievement, hasEducation, hasExperience, hasProject, hasSkillGroup } from './resume-utils';

type EditorSection = 'personal' | ResumeSectionKey | 'layout';
type DialogKind = 'forge' | 'achievements';

/** Import dialog: stays mounted while it animates out; `n` remounts it per open. */
interface DialogState {
  kind: DialogKind;
  open: boolean;
  n: number;
}

const SECTIONS: { key: EditorSection; label: string; hint: string; Icon: LucideIcon }[] = [
  { key: 'personal', label: 'Personal info', hint: 'Name, contact links and summary', Icon: User },
  { key: 'education', label: 'Education', hint: 'Degree, school, score', Icon: GraduationCap },
  { key: 'skills', label: 'Skills', hint: 'Languages, frameworks, tools', Icon: Wrench },
  { key: 'projects', label: 'Projects', hint: 'From Project Forge or by hand', Icon: Rocket },
  { key: 'experience', label: 'Experience', hint: 'Internships, jobs, open source', Icon: Briefcase },
  { key: 'achievements', label: 'Achievements', hint: 'Hackathons, ranks, certifications', Icon: Trophy },
  { key: 'layout', label: 'Layout & style', hint: 'Section order, accent, font, spacing', Icon: Palette },
];

const LABEL = 'text-xs font-medium text-fg-muted';

// ─── Sections ───

function PersonalSection() {
  const personal = useResumeStore((s) => s.resume.personal);
  const update = useResumeStore((s) => s.updatePersonal);

  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField
        className="col-span-2"
        label="Full name"
        value={personal.fullName}
        onChange={(v) => update({ fullName: v })}
        placeholder="Your full name"
        maxLength={80}
      />
      <TextField
        className="col-span-2"
        label="Headline"
        value={personal.headline}
        onChange={(v) => update({ headline: v })}
        placeholder="e.g. CSE undergrad · Full-stack developer"
        maxLength={140}
      />
      <TextField
        label="Email"
        type="email"
        value={personal.email}
        onChange={(v) => update({ email: v })}
        placeholder="name@example.com"
      />
      <TextField
        label="Phone"
        type="tel"
        value={personal.phone}
        onChange={(v) => update({ phone: v })}
        placeholder="With country code"
      />
      <TextField
        label="Location"
        value={personal.location}
        onChange={(v) => update({ location: v })}
        placeholder="City, Country"
      />
      <TextField
        label="Website"
        value={personal.website}
        onChange={(v) => update({ website: v })}
        placeholder="yourdomain.dev"
      />
      <TextField
        label="GitHub"
        value={personal.github}
        onChange={(v) => update({ github: v })}
        placeholder="Username or URL"
      />
      <TextField
        label="LinkedIn"
        value={personal.linkedin}
        onChange={(v) => update({ linkedin: v })}
        placeholder="Username or URL"
      />
      <TextAreaField
        className="col-span-2"
        label="Summary"
        rows={3}
        value={personal.summary}
        onChange={(v) => update({ summary: v })}
        placeholder="Two or three lines on who you are and what you are aiming for."
        hint="Optional. Printed under your name when filled."
      />
    </div>
  );
}

function EducationSection() {
  const items = useResumeStore((s) => s.resume.education);
  const addItem = useResumeStore((s) => s.addItem);
  const updateItem = useResumeStore((s) => s.updateItem);
  const removeItem = useResumeStore((s) => s.removeItem);
  const moveItem = useResumeStore((s) => s.moveItem);

  return (
    <div className="space-y-3">
      {items.map((e, i) => (
        <EntryCard
          key={e.id}
          title={e.institution || e.degree || 'New education'}
          index={i}
          count={items.length}
          onMove={(d) => moveItem('education', e.id, d)}
          onRemove={() => removeItem('education', e.id)}
        >
          <TextField
            className="col-span-2"
            label="Institution"
            value={e.institution}
            onChange={(v) => updateItem('education', e.id, { institution: v })}
            placeholder="College or school"
          />
          <TextField
            className="col-span-2"
            label="Degree / program"
            value={e.degree}
            onChange={(v) => updateItem('education', e.id, { degree: v })}
            placeholder="e.g. B.Tech in Computer Science"
          />
          <TextField
            label="Score"
            value={e.score}
            onChange={(v) => updateItem('education', e.id, { score: v })}
            placeholder="CGPA or percentage"
          />
          <TextField
            label="Location"
            value={e.location}
            onChange={(v) => updateItem('education', e.id, { location: v })}
            placeholder="City"
          />
          <TextField
            label="Start"
            value={e.start}
            onChange={(v) => updateItem('education', e.id, { start: v })}
            placeholder="Month Year"
          />
          <TextField
            label="End"
            value={e.end}
            onChange={(v) => updateItem('education', e.id, { end: v })}
            placeholder="Month Year or Present"
          />
          <TextAreaField
            className="col-span-2"
            label="Details"
            rows={2}
            value={e.details}
            onChange={(v) => updateItem('education', e.id, { details: v })}
            placeholder="Relevant coursework, thesis, honours"
            hint="One bullet per line."
          />
        </EntryCard>
      ))}
      <AddButton onClick={() => addItem('education')}>Add education</AddButton>
    </div>
  );
}

function SkillsSection({ onNotice }: { onNotice: (text: string) => void }) {
  const items = useResumeStore((s) => s.resume.skills);
  const addItem = useResumeStore((s) => s.addItem);
  const updateItem = useResumeStore((s) => s.updateItem);
  const removeItem = useResumeStore((s) => s.removeItem);
  const moveItem = useResumeStore((s) => s.moveItem);
  const addSkillsFromForge = useResumeStore((s) => s.addSkillsFromForge);
  const forgeProjects = useProjectForgeStore((s) => s.projects);

  const pullFromForge = () => {
    const tags = forgeProjects.filter((p) => p.stage !== 'ideas').flatMap((p) => p.techStack);
    if (tags.length === 0) {
      onNotice(
        forgeProjects.length === 0
          ? 'Project Forge has no projects yet.'
          : 'Your started Forge projects have no tech stack tags yet.'
      );
      return;
    }
    const added = addSkillsFromForge(tags);
    onNotice(
      added > 0
        ? `Added ${added} ${added === 1 ? 'technology' : 'technologies'} from Project Forge.`
        : 'Every Project Forge technology is already listed.'
    );
  };

  return (
    <div className="space-y-3">
      {items.map((g, i) => (
        <EntryCard
          key={g.id}
          title={g.label || 'Skill group'}
          index={i}
          count={items.length}
          onMove={(d) => moveItem('skills', g.id, d)}
          onRemove={() => removeItem('skills', g.id)}
        >
          <TextField
            className="col-span-2"
            label="Group"
            value={g.label}
            onChange={(v) => updateItem('skills', g.id, { label: v })}
            placeholder="e.g. Languages"
            maxLength={60}
          />
          <TextField
            className="col-span-2"
            label="Skills (comma separated)"
            value={g.items}
            onChange={(v) => updateItem('skills', g.id, { items: v })}
            placeholder="e.g. C++, Python, TypeScript"
            maxLength={400}
          />
        </EntryCard>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <AddButton onClick={() => addItem('skills')}>Add group</AddButton>
        <Button variant="secondary" leadingIcon={Anvil} onClick={pullFromForge}>
          Tech from Forge
        </Button>
      </div>
    </div>
  );
}

function ProjectsSection({ onImport }: { onImport: () => void }) {
  const items = useResumeStore((s) => s.resume.projects);
  const addItem = useResumeStore((s) => s.addItem);
  const updateItem = useResumeStore((s) => s.updateItem);
  const removeItem = useResumeStore((s) => s.removeItem);
  const moveItem = useResumeStore((s) => s.moveItem);

  return (
    <div className="space-y-3">
      <Button variant="secondary" fullWidth leadingIcon={Anvil} onClick={onImport}>
        Import from Project Forge
      </Button>
      {items.map((p, i) => (
        <EntryCard
          key={p.id}
          title={p.name || 'New project'}
          badge={p.forgeId ? 'Forge' : undefined}
          badgeTone="ember"
          badgeIcon={Anvil}
          index={i}
          count={items.length}
          onMove={(d) => moveItem('projects', p.id, d)}
          onRemove={() => removeItem('projects', p.id)}
        >
          <TextField
            className="col-span-2"
            label="Project name"
            value={p.name}
            onChange={(v) => updateItem('projects', p.id, { name: v })}
            placeholder="Project name"
            maxLength={100}
          />
          <TextField
            className="col-span-2"
            label="Tech stack"
            value={p.techStack}
            onChange={(v) => updateItem('projects', p.id, { techStack: v })}
            placeholder="e.g. React, Node.js, PostgreSQL"
            maxLength={300}
          />
          <TextField
            label="Live link"
            value={p.link}
            onChange={(v) => updateItem('projects', p.id, { link: v })}
            placeholder="Demo URL"
            maxLength={300}
          />
          <TextField
            label="Code link"
            value={p.repo}
            onChange={(v) => updateItem('projects', p.id, { repo: v })}
            placeholder="Repository URL"
            maxLength={300}
          />
          <TextField
            label="Start"
            value={p.start}
            onChange={(v) => updateItem('projects', p.id, { start: v })}
            placeholder="Month Year"
          />
          <TextField
            label="End"
            value={p.end}
            onChange={(v) => updateItem('projects', p.id, { end: v })}
            placeholder="Month Year or Present"
          />
          <TextAreaField
            className="col-span-2"
            label="Highlights"
            rows={3}
            value={p.bullets}
            onChange={(v) => updateItem('projects', p.id, { bullets: v })}
            placeholder="What you built, how, and the result. Numbers help."
            hint="One bullet per line."
          />
        </EntryCard>
      ))}
      <AddButton onClick={() => addItem('projects')}>Add project manually</AddButton>
    </div>
  );
}

function ExperienceSection() {
  const items = useResumeStore((s) => s.resume.experience);
  const addItem = useResumeStore((s) => s.addItem);
  const updateItem = useResumeStore((s) => s.updateItem);
  const removeItem = useResumeStore((s) => s.removeItem);
  const moveItem = useResumeStore((s) => s.moveItem);

  return (
    <div className="space-y-3">
      {items.map((x, i) => (
        <EntryCard
          key={x.id}
          title={x.role || x.company || 'New experience'}
          index={i}
          count={items.length}
          onMove={(d) => moveItem('experience', x.id, d)}
          onRemove={() => removeItem('experience', x.id)}
        >
          <TextField
            className="col-span-2"
            label="Role"
            value={x.role}
            onChange={(v) => updateItem('experience', x.id, { role: v })}
            placeholder="e.g. Software Engineering Intern"
          />
          <TextField
            label="Company"
            value={x.company}
            onChange={(v) => updateItem('experience', x.id, { company: v })}
            placeholder="Company or project"
          />
          <TextField
            label="Location"
            value={x.location}
            onChange={(v) => updateItem('experience', x.id, { location: v })}
            placeholder="City or Remote"
          />
          <TextField
            label="Start"
            value={x.start}
            onChange={(v) => updateItem('experience', x.id, { start: v })}
            placeholder="Month Year"
          />
          <TextField
            label="End"
            value={x.end}
            onChange={(v) => updateItem('experience', x.id, { end: v })}
            placeholder="Month Year or Present"
          />
          <TextAreaField
            className="col-span-2"
            label="What you did"
            rows={3}
            value={x.bullets}
            onChange={(v) => updateItem('experience', x.id, { bullets: v })}
            placeholder="Start each line with a strong verb and show impact."
            hint="One bullet per line."
          />
        </EntryCard>
      ))}
      <AddButton onClick={() => addItem('experience')}>Add experience</AddButton>
    </div>
  );
}

function AchievementsSection({ onImport }: { onImport: () => void }) {
  const items = useResumeStore((s) => s.resume.achievements);
  const addItem = useResumeStore((s) => s.addItem);
  const updateItem = useResumeStore((s) => s.updateItem);
  const removeItem = useResumeStore((s) => s.removeItem);
  const moveItem = useResumeStore((s) => s.moveItem);

  return (
    <div className="space-y-3">
      {items.map((a, i) => (
        <EntryCard
          key={a.id}
          title={a.text || 'New achievement'}
          badge={a.osAchievementId ? 'Warrior OS' : undefined}
          badgeTone="gold"
          badgeIcon={Trophy}
          index={i}
          count={items.length}
          onMove={(d) => moveItem('achievements', a.id, d)}
          onRemove={() => removeItem('achievements', a.id)}
        >
          <TextAreaField
            className="col-span-2"
            label="Achievement"
            rows={2}
            value={a.text}
            onChange={(v) => updateItem('achievements', a.id, { text: v })}
            placeholder="Hackathon result, contest rank, certification…"
          />
        </EntryCard>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <AddButton onClick={() => addItem('achievements')}>Add achievement</AddButton>
        <Button variant="secondary" leadingIcon={Trophy} onClick={onImport}>
          From Warrior OS
        </Button>
      </div>
    </div>
  );
}

const FONT_OPTIONS: { value: ResumeFont; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
];

const DENSITY_OPTIONS: { value: ResumeDensity; label: string }[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

function LayoutSection() {
  const order = useResumeStore((s) => s.resume.sectionOrder);
  const hidden = useResumeStore((s) => s.resume.hiddenSections);
  const style = useResumeStore((s) => s.style);
  const moveSection = useResumeStore((s) => s.moveSection);
  const setSectionHidden = useResumeStore((s) => s.setSectionHidden);
  const setStyle = useResumeStore((s) => s.setStyle);
  const resetResume = useResumeStore((s) => s.resetResume);

  return (
    <div className="space-y-5">
      <div>
        <p className={cn(LABEL, 'mb-2')}>Section order</p>
        <ul className="space-y-1">
          {order.map((key, i) => {
            const isHidden = hidden.includes(key);
            return (
              <li key={key} className="flex h-10 items-center gap-1 rounded-control bg-ink-950/45 pl-3 pr-1.5">
                <span className="tabular w-5 font-mono text-2xs text-fg-subtle">{i + 1}</span>
                <span className={cn('flex-1 text-ui', isHidden ? 'text-fg-subtle line-through decoration-fg-faint' : 'text-fg')}>
                  {RESUME_SECTION_LABELS[key]}
                </span>
                <IconButton
                  icon={isHidden ? EyeOff : Eye}
                  size="xs"
                  aria-label={isHidden ? `Show ${RESUME_SECTION_LABELS[key]}` : `Hide ${RESUME_SECTION_LABELS[key]}`}
                  title={isHidden ? `Show ${RESUME_SECTION_LABELS[key]}` : `Hide ${RESUME_SECTION_LABELS[key]}`}
                  onClick={() => setSectionHidden(key, !isHidden)}
                />
                <IconButton
                  icon={ArrowUp}
                  size="xs"
                  aria-label="Move up"
                  title="Move up"
                  disabled={i === 0}
                  onClick={() => moveSection(key, -1)}
                />
                <IconButton
                  icon={ArrowDown}
                  size="xs"
                  aria-label="Move down"
                  title="Move down"
                  disabled={i === order.length - 1}
                  onClick={() => moveSection(key, 1)}
                />
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-fg-subtle">Empty sections never print.</p>
      </div>

      <div>
        <p className={cn(LABEL, 'mb-2')}>Accent colour</p>
        <div className="flex flex-wrap gap-2.5">
          {RESUME_ACCENTS.map((accent) => {
            const active = style.accent === accent.id;
            return (
              <button
                key={accent.id}
                type="button"
                aria-pressed={active}
                aria-label={accent.label}
                title={accent.label}
                onClick={() => setStyle({ accent: accent.id })}
                // Paper ink colours (printed content), shown as swatches.
                style={{ '--swatch': accent.hex } as CSSProperties}
                className={cn(
                  'focus-ring flex size-8 items-center justify-center rounded-full bg-(--swatch) text-fg',
                  'ring-offset-2 ring-offset-ink-900 transition-[box-shadow,transform] duration-120 ease-out-quint',
                  active ? 'ring-2 ring-fg' : 'ring-1 ring-line-strong hover:ring-fg-subtle'
                )}
              >
                {active && <Check size={14} strokeWidth={2.5} aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className={cn(LABEL, 'mb-2')}>Font</p>
          <SegmentedControl
            size="sm"
            fullWidth
            aria-label="Font"
            value={style.font}
            onChange={(font) => setStyle({ font })}
            options={FONT_OPTIONS}
          />
        </div>
        <div className="min-w-0">
          <p className={cn(LABEL, 'mb-2')}>Spacing</p>
          <SegmentedControl
            size="sm"
            fullWidth
            aria-label="Spacing"
            value={style.density}
            onChange={(density) => setStyle({ density })}
            options={DENSITY_OPTIONS}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/20 bg-danger/[0.04] px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-ui font-medium text-fg">Clear resume</p>
          <p className="text-xs text-fg-subtle">Erases every section. Style settings stay.</p>
        </div>
        <ConfirmButton
          label="Clear the whole resume"
          variant="danger"
          size="md"
          icon={RotateCcw}
          onConfirm={resetResume}
          armedChildren="Click again to erase"
        >
          Clear resume
        </ConfirmButton>
      </div>
    </div>
  );
}

// ─── Editor shell ───

interface SectionBodyProps {
  section: EditorSection;
  onNotice: (text: string) => void;
  onOpenDialog: (kind: DialogKind) => void;
}

function EditorSectionBody({ section, onNotice, onOpenDialog }: SectionBodyProps) {
  switch (section) {
    case 'personal':
      return <PersonalSection />;
    case 'education':
      return <EducationSection />;
    case 'skills':
      return <SkillsSection onNotice={onNotice} />;
    case 'projects':
      return <ProjectsSection onImport={() => onOpenDialog('forge')} />;
    case 'experience':
      return <ExperienceSection />;
    case 'achievements':
      return <AchievementsSection onImport={() => onOpenDialog('achievements')} />;
    case 'layout':
      return <LayoutSection />;
  }
}

function ResumeEditorInner() {
  const [open, setOpen] = useState<EditorSection | null>('personal');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState<{ section: EditorSection; text: string } | null>(null);

  // Badges count filled-in entries (what will actually print).
  const fullName = useResumeStore((s) => s.resume.personal.fullName.trim());
  const educationCount = useResumeStore((s) => s.resume.education.filter(hasEducation).length);
  const skillsCount = useResumeStore((s) => s.resume.skills.filter(hasSkillGroup).length);
  const projectsCount = useResumeStore((s) => s.resume.projects.filter(hasProject).length);
  const experienceCount = useResumeStore((s) => s.resume.experience.filter(hasExperience).length);
  const achievementsCount = useResumeStore((s) => s.resume.achievements.filter(hasAchievement).length);
  const counts: Partial<Record<EditorSection, number>> = {
    education: educationCount,
    skills: skillsCount,
    projects: projectsCount,
    experience: experienceCount,
    achievements: achievementsCount,
  };

  const toggle = (key: EditorSection) => {
    setOpen((current) => (current === key ? null : key));
    setNotice(null);
  };

  const openDialog = (kind: DialogKind) => setDialog((d) => ({ kind, open: true, n: (d?.n ?? 0) + 1 }));
  const closeDialog = () => setDialog((d) => (d ? { ...d, open: false } : d));

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {SECTIONS.map(({ key, label, hint, Icon }) => {
          const isOpen = open === key;
          const count = counts[key];
          const summary = key === 'personal' && fullName ? fullName : hint;
          return (
            <div
              key={key}
              className={cn(
                'glass-panel rounded-card transition-[border-color] duration-180 ease-out-quint',
                isOpen && 'border-line-strong'
              )}
            >
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-expanded={isOpen}
                className="focus-ring-inset group/section flex w-full items-center gap-3 rounded-card px-3.5 py-3 text-left transition-colors duration-120 hover:bg-surface-hover"
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-control border bg-ink-800 transition-colors duration-120',
                    isOpen ? 'border-accent/30 text-accent' : 'border-line text-fg-muted group-hover/section:text-fg'
                  )}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{label}</span>
                  <span className="block truncate text-xs text-fg-subtle">{summary}</span>
                </span>
                {count !== undefined && count > 0 && (
                  <span className="tabular rounded-full bg-surface-active px-1.5 font-mono text-2xs leading-4 text-fg-muted">
                    {count}
                  </span>
                )}
                <ChevronDown
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden
                  className={cn('shrink-0 text-fg-subtle transition-transform duration-180 ease-out-quint', isOpen && 'rotate-180')}
                />
              </button>
              {isOpen && (
                <div className="animate-fade-in space-y-3 border-t border-line px-3.5 pb-4 pt-3.5">
                  {notice && notice.section === key && (
                    <div
                      role="status"
                      className="flex items-start gap-2 rounded-control bg-info/10 py-2 pl-3 pr-1.5 text-xs text-fg-muted"
                    >
                      <Info size={14} strokeWidth={1.75} aria-hidden className="mt-px shrink-0 text-info" />
                      <span className="flex-1 pt-px">{notice.text}</span>
                      <IconButton icon={X} size="xs" aria-label="Dismiss" onClick={() => setNotice(null)} className="-my-1" />
                    </div>
                  )}
                  <EditorSectionBody
                    section={key}
                    onNotice={(text) => setNotice({ section: key, text })}
                    onOpenDialog={openDialog}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dialog?.kind === 'forge' && (
        <ForgeImportDialog
          key={`forge-${dialog.n}`}
          open={dialog.open}
          onClose={closeDialog}
          onDone={(text) => setNotice({ section: 'projects', text })}
        />
      )}
      {dialog?.kind === 'achievements' && (
        <AchievementImportDialog
          key={`achievements-${dialog.n}`}
          open={dialog.open}
          onClose={closeDialog}
          onDone={(text) => setNotice({ section: 'achievements', text })}
        />
      )}
    </div>
  );
}

export const ResumeEditor = memo(ResumeEditorInner);
