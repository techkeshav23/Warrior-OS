// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Document
// Pure render of the resume in the print template. Used by the
// live preview (with hints for empty parts) and by the print copy.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { RESUME_SECTION_LABELS, splitLines, splitList } from '@/stores/useResumeStore';
import type { ResumeData, ResumeSectionKey, ResumeStyle } from '@/types/resume';
import {
  contactItems,
  dateRange,
  displayLink,
  hasAchievement,
  hasEducation,
  hasExperience,
  hasProject,
  hasSkillGroup,
  safeHref,
} from './resume-utils';

interface ResumeDocumentProps {
  resume: ResumeData;
  styleOpts: ResumeStyle;
  /** Show greyed hints for empty parts (screen preview only, never printed). */
  showHints?: boolean;
}

const SECTION_HINTS: Record<ResumeSectionKey, string> = {
  education: 'Add your degree, school and score in the editor.',
  skills: 'List languages, frameworks and tools in the editor.',
  projects: 'Add projects or import them from Project Forge.',
  experience: 'Internships, jobs, freelance or open-source work.',
  achievements: 'Hackathons, ranks, certifications, Warrior OS achievements.',
};

function Bullets({ text }: { text: string }) {
  const lines = splitLines(text);
  if (lines.length === 0) return null;
  return (
    <ul className="wr-bullets">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

interface SectionProps {
  sectionKey: ResumeSectionKey;
  resume: ResumeData;
  showHints: boolean;
}

function SectionBody({ sectionKey, resume }: Omit<SectionProps, 'showHints'>) {
  switch (sectionKey) {
    case 'education':
      return (
        <>
          {resume.education.filter(hasEducation).map((e) => (
            <div key={e.id} className="wr-entry">
              <div className="wr-row">
                <span className="wr-title">{e.institution.trim() || e.degree.trim()}</span>
                <span className="wr-meta">{dateRange(e.start, e.end)}</span>
              </div>
              {(e.degree.trim() || e.score.trim() || e.location.trim()) && (
                <div className="wr-row">
                  <span className="wr-sub">
                    {[e.institution.trim() ? e.degree.trim() : '', e.score.trim()].filter(Boolean).join(' · ')}
                  </span>
                  <span className="wr-meta">{e.location.trim()}</span>
                </div>
              )}
              <Bullets text={e.details} />
            </div>
          ))}
        </>
      );
    case 'skills':
      return (
        <div className="wr-skills">
          {resume.skills.filter(hasSkillGroup).map((g) => (
            <div key={g.id} style={{ display: 'contents' }}>
              <span className="wr-skill-label">{g.label.trim() || 'Skills'}:</span>
              <span>{splitList(g.items).join(', ')}</span>
            </div>
          ))}
        </div>
      );
    case 'projects':
      return (
        <>
          {resume.projects.filter(hasProject).map((p) => {
            const live = safeHref(p.link);
            const repo = safeHref(p.repo);
            const tech = splitList(p.techStack).join(', ');
            return (
              <div key={p.id} className="wr-entry">
                <div className="wr-row">
                  <span>
                    <span className="wr-title">{p.name.trim()}</span>
                    {tech && <span className="wr-tech"> | {tech}</span>}
                  </span>
                  <span className="wr-meta">{dateRange(p.start, p.end)}</span>
                </div>
                {(live || repo) && (
                  <div className="wr-links">
                    {live && (
                      <span>
                        Live: <a href={live}>{displayLink(live)}</a>
                      </span>
                    )}
                    {repo && (
                      <span>
                        Code: <a href={repo}>{displayLink(repo)}</a>
                      </span>
                    )}
                  </div>
                )}
                <Bullets text={p.bullets} />
              </div>
            );
          })}
        </>
      );
    case 'experience':
      return (
        <>
          {resume.experience.filter(hasExperience).map((x) => (
            <div key={x.id} className="wr-entry">
              <div className="wr-row">
                <span className="wr-title">{x.role.trim() || x.company.trim()}</span>
                <span className="wr-meta">{dateRange(x.start, x.end)}</span>
              </div>
              {((x.role.trim() && x.company.trim()) || x.location.trim()) && (
                <div className="wr-row">
                  <span className="wr-sub">{x.role.trim() ? x.company.trim() : ''}</span>
                  <span className="wr-meta">{x.location.trim()}</span>
                </div>
              )}
              <Bullets text={x.bullets} />
            </div>
          ))}
        </>
      );
    case 'achievements': {
      const lines = resume.achievements.filter(hasAchievement);
      return (
        <ul className="wr-bullets">
          {lines.map((a) => (
            <li key={a.id}>{a.text.trim()}</li>
          ))}
        </ul>
      );
    }
  }
}

function sectionHasContent(key: ResumeSectionKey, resume: ResumeData): boolean {
  switch (key) {
    case 'education':
      return resume.education.some(hasEducation);
    case 'skills':
      return resume.skills.some(hasSkillGroup);
    case 'projects':
      return resume.projects.some(hasProject);
    case 'experience':
      return resume.experience.some(hasExperience);
    case 'achievements':
      return resume.achievements.some(hasAchievement);
  }
}

function Section({ sectionKey, resume, showHints }: SectionProps) {
  const filled = sectionHasContent(sectionKey, resume);
  if (!filled && !showHints) return null;
  return (
    <section className="wr-section">
      <h2 className="wr-h2">{RESUME_SECTION_LABELS[sectionKey]}</h2>
      {filled ? (
        <SectionBody sectionKey={sectionKey} resume={resume} />
      ) : (
        <p className="wr-hint">{SECTION_HINTS[sectionKey]}</p>
      )}
    </section>
  );
}

function ResumeDocumentInner({ resume, styleOpts, showHints = false }: ResumeDocumentProps) {
  const { personal } = resume;
  const name = personal.fullName.trim();
  const headline = personal.headline.trim();
  const summary = personal.summary.trim();
  const contacts = contactItems(personal);
  const visibleSections = resume.sectionOrder.filter((key) => !resume.hiddenSections.includes(key));

  return (
    <article
      className="wr-doc"
      data-accent={styleOpts.accent}
      data-font={styleOpts.font}
      data-density={styleOpts.density}
    >
      <header className="wr-header">
        {name ? (
          <h1 className="wr-name">{name}</h1>
        ) : (
          showHints && <h1 className="wr-name wr-hint">Your Name</h1>
        )}
        {headline && <p className="wr-headline">{headline}</p>}
        {contacts.length > 0 ? (
          <p className="wr-contact">
            {contacts.map((item) => (
              <span key={item.key}>{item.href ? <a href={item.href}>{item.label}</a> : item.label}</span>
            ))}
          </p>
        ) : (
          showHints && <p className="wr-contact wr-hint">email · phone · city · GitHub · LinkedIn</p>
        )}
      </header>

      {summary && (
        <section className="wr-section">
          <h2 className="wr-h2">Summary</h2>
          <p className="wr-summary">{summary}</p>
        </section>
      )}

      {visibleSections.map((key) => (
        <Section key={key} sectionKey={key} resume={resume} showHints={showHints} />
      ))}
    </article>
  );
}

export const ResumeDocument = memo(ResumeDocumentInner);
