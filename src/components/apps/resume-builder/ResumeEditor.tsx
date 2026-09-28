// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Editor
// Accordion form: personal info, education, skills, projects
// (with Project Forge import), experience, achievements (with
// Warrior OS import) and layout/style. Saves on every keystroke.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  type LucideIcon,
  ArrowDown,
  ArrowUp,
  Award,
  Briefcase,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Hammer,
  Palette,
  Rocket,
  RotateCcw,
  Trophy,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmButton } from '@/components/apps/project-forge/ConfirmButton';
import { useProjectForgeStore } from '@/stores/useProjectForgeStore';
import { RESUME_ACCENTS, RESUME_SECTION_LABELS, useResumeStore } from '@/stores/useResumeStore';
import type { ResumeDensity, ResumeFont, ResumeSectionKey } from '@/types/resume';
import { AddButton, EntryCard, FIELD_LABEL, IconButton, TextAreaField, TextField } from './EditorFields';
import { AchievementImportDialog, ForgeImportDialog } from './ImportDialogs';
import { hasAchievement, hasEducation, hasExperience, hasProject, hasSkillGroup } from './resume-utils';

type EditorSection = 'personal' | ResumeSectionKey | 'layout';
type DialogKind = 'forge' | 'achievements';

const SECTIONS: { key: EditorSection; label: string; Icon: LucideIcon }[] = [
  { key: 'personal', label: 'Personal info', Icon: User },
  { key: 'education', label: 'Education', Icon: GraduationCap },
  { key: 'skills', label: 'Skills', Icon: Wrench },
  { key: 'projects', label: 'Projects', Icon: Rocket },
  { key: 'experience', label: 'Experience', Icon: Briefcase },
  { key: 'achievements', label: 'Achievements', Icon: Trophy },
  { key: 'layout', label: 'Layout & style', Icon: Palette },
];

const SECONDARY_BUTTON =
  'flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-400/35 bg-cyan-400/[0.08] py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/15';

// ─── Sections ───

function PersonalSection() {
  const personal = useResumeStore((s) => s.resume.personal);
  const update = useResumeStore((s) => s.updatePersonal);

  return (
    <div className="grid grid-cols-2 gap-2">
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
    <div className="space-y-2">
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
    <div className="space-y-2">
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
        <button type="button" onClick={pullFromForge} className={SECONDARY_BUTTON}>
          <Hammer className="h-3.5 w-3.5" /> Tech from Forge
        </button>
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
    <div className="space-y-2">
      <button type="button" onClick={onImport} className={SECONDARY_BUTTON}>
        <Hammer className="h-3.5 w-3.5" /> Import from Project Forge
      </button>
      {items.map((p, i) => (
        <EntryCard
          key={p.id}
          title={p.name || 'New project'}
          badge={p.forgeId ? 'Forge' : undefined}
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
    <div className="space-y-2">
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
    <div className="space-y-2">
      {items.map((a, i) => (
        <EntryCard
          key={a.id}
          title={a.text || 'New achievement'}
          badge={a.osAchievementId ? 'Warrior OS' : undefined}
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
        <button type="button" onClick={onImport} className={SECONDARY_BUTTON}>
          <Award className="h-3.5 w-3.5" /> From Warrior OS
        </button>
      </div>
    </div>
  );
}

const FONT_OPTIONS: { id: ResumeFont; label: string }[] = [
  { id: 'sans', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
];

const DENSITY_OPTIONS: { id: ResumeDensity; label: string }[] = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
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
    <div className="space-y-4">
      <div>
        <p className={cn(FIELD_LABEL, 'mb-1.5')}>Section order</p>
        <ul className="space-y-1">
          {order.map((key, i) => {
            const isHidden = hidden.includes(key);
            return (
              <li
                key={key}
                className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] py-1 pl-2.5 pr-1"
              >
                <span className={cn('flex-1 text-xs', isHidden ? 'text-white/35 line-through' : 'text-white/80')}>
                  {RESUME_SECTION_LABELS[key]}
                </span>
                <IconButton
                  label={isHidden ? `Show ${RESUME_SECTION_LABELS[key]}` : `Hide ${RESUME_SECTION_LABELS[key]}`}
                  onClick={() => setSectionHidden(key, !isHidden)}
                >
                  {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </IconButton>
                <IconButton label="Move up" disabled={i === 0} onClick={() => moveSection(key, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Move down" disabled={i === order.length - 1} onClick={() => moveSection(key, 1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconButton>
              </li>
            );
          })}
        </ul>
        <p className="mt-1 text-[10px] text-white/35">Empty sections never print.</p>
      </div>

      <div>
        <p className={cn(FIELD_LABEL, 'mb-1.5')}>Accent colour</p>
        <div className="flex flex-wrap gap-2">
          {RESUME_ACCENTS.map((accent) => (
            <button
              key={accent.id}
              type="button"
              aria-pressed={style.accent === accent.id}
              aria-label={accent.label}
              title={accent.label}
              onClick={() => setStyle({ accent: accent.id })}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                style.accent === accent.id ? 'border-white' : 'border-white/15'
              )}
              style={{ backgroundColor: accent.hex }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={cn(FIELD_LABEL, 'mb-1.5')}>Font</p>
          <div className="flex rounded-md border border-white/10 p-0.5">
            {FONT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={style.font === option.id}
                onClick={() => setStyle({ font: option.id })}
                className={cn(
                  'flex-1 rounded px-2 py-1 text-xs',
                  style.font === option.id ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/55 hover:text-white/85'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={cn(FIELD_LABEL, 'mb-1.5')}>Spacing</p>
          <div className="flex rounded-md border border-white/10 p-0.5">
            {DENSITY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={style.density === option.id}
                onClick={() => setStyle({ density: option.id })}
                className={cn(
                  'flex-1 rounded px-2 py-1 text-xs',
                  style.density === option.id ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/55 hover:text-white/85'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ConfirmButton
        label="Clear the whole resume"
        onConfirm={resetResume}
        armedChildren={
          <>
            <RotateCcw className="h-3.5 w-3.5" /> Click again to erase every section
          </>
        }
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-xs text-red-300/80 hover:bg-red-500/15"
        armedClassName="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-400/60 bg-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-100"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Clear resume
      </ConfirmButton>
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
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [notice, setNotice] = useState<{ section: EditorSection; text: string } | null>(null);

  // Badges count filled-in entries (what will actually print).
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

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {SECTIONS.map(({ key, label, Icon }) => {
          const isOpen = open === key;
          const count = counts[key];
          return (
            <div
              key={key}
              className={cn(
                'rounded-xl border transition-colors',
                isOpen ? 'border-cyan-400/25 bg-white/[0.03]' : 'border-white/10 bg-white/[0.015]'
              )}
            >
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <Icon className={cn('h-4 w-4', isOpen ? 'text-cyan-300' : 'text-white/45')} />
                <span className={cn('flex-1 text-sm font-semibold', isOpen ? 'text-white' : 'text-white/75')}>
                  {label}
                </span>
                {count !== undefined && count > 0 && (
                  <span className="rounded-full bg-white/[0.07] px-1.5 text-[10px] tabular-nums text-white/55">
                    {count}
                  </span>
                )}
                <ChevronDown
                  className={cn('h-4 w-4 text-white/40 transition-transform', isOpen && 'rotate-180')}
                />
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-white/5 p-3">
                  {notice && notice.section === key && (
                    <div
                      role="status"
                      className="flex items-start gap-2 rounded-md border border-cyan-400/25 bg-cyan-400/[0.07] px-2.5 py-1.5 text-[11px] text-cyan-100"
                    >
                      <span className="flex-1">{notice.text}</span>
                      <button
                        type="button"
                        onClick={() => setNotice(null)}
                        aria-label="Dismiss"
                        className="text-cyan-100/60 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <EditorSectionBody
                    section={key}
                    onNotice={(text) => setNotice({ section: key, text })}
                    onOpenDialog={setDialog}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {dialog === 'forge' && (
          <ForgeImportDialog
            key="forge"
            onClose={() => setDialog(null)}
            onDone={(text) => setNotice({ section: 'projects', text })}
          />
        )}
        {dialog === 'achievements' && (
          <AchievementImportDialog
            key="achievements"
            onClose={() => setDialog(null)}
            onDone={(text) => setNotice({ section: 'achievements', text })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export const ResumeEditor = memo(ResumeEditorInner);
