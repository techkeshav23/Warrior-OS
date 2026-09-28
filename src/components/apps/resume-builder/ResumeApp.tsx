// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Builder App
// Split view: form editor on the left, live A4 preview on the
// right (tabs on narrow windows). Export uses the browser print
// dialog ("Save as PDF"); print CSS isolates the resume from the OS.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Eye, FileText, Hammer, PencilLine, Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCalendarDate } from '@/components/apps/project-forge/forge-utils';
import { RESUME_FIRST_EXPORT_ACHIEVEMENT, useResumeStore } from '@/stores/useResumeStore';
import { useProjectForgeStore } from '@/stores/useProjectForgeStore';
import { useXPStore } from '@/stores/useXPStore';
import type { ResumeData } from '@/types/resume';
import { ResumeEditor } from './ResumeEditor';
import { ResumePreview } from './ResumePreview';
import { ResumePrintPortal } from './ResumePrintPortal';
import { RESUME_TEMPLATE_CSS } from './resume-template';
import { hasAchievement, hasEducation, hasExperience, hasProject, hasSkillGroup } from './resume-utils';

type PaneView = 'editor' | 'preview';

const VIEWS: { id: PaneView; label: string; Icon: typeof Eye }[] = [
  { id: 'editor', label: 'Edit', Icon: PencilLine },
  { id: 'preview', label: 'Preview', Icon: Eye },
];

/** A resume counts as real once it has a name or any filled section. */
function hasContent(resume: ResumeData): boolean {
  return (
    Boolean(resume.personal.fullName.trim()) ||
    resume.education.some(hasEducation) ||
    resume.skills.some(hasSkillGroup) ||
    resume.projects.some(hasProject) ||
    resume.experience.some(hasExperience) ||
    resume.achievements.some(hasAchievement)
  );
}

/** Resolves once a persisted zustand store has loaded from localStorage. */
function whenHydrated(store: {
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
}): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = store.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

function ResumeAppInner() {
  const [view, setView] = useState<PaneView>('editor');
  const [printing, setPrinting] = useState(false);
  const [autoFillNote, setAutoFillNote] = useState<string | null>(null);
  const forgeProjects = useProjectForgeStore((s) => s.projects);

  // One-time auto-fill of the Projects section from Project Forge, once both
  // stores are loaded. Re-runs when Forge changes until something is imported.
  useEffect(() => {
    let cancelled = false;
    Promise.all([whenHydrated(useResumeStore), whenHydrated(useProjectForgeStore)]).then(() => {
      if (cancelled) return;
      const added = useResumeStore.getState().autoFillFromForge(useProjectForgeStore.getState().projects);
      if (added > 0) {
        setAutoFillNote(`Filled Projects with ${added} ${added === 1 ? 'project' : 'projects'} from Project Forge.`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [forgeProjects]);
  const fullName = useResumeStore((s) => s.resume.personal.fullName);
  const canExport = useResumeStore((s) => hasContent(s.resume));
  const lastExportedAt = useResumeStore((s) => s.lastExportedAt);
  const markExported = useResumeStore((s) => s.markExported);

  const handleExport = () => {
    if (typeof window === 'undefined' || !canExport) return;
    // Mount the print copy synchronously so it exists when the dialog snapshots the page.
    flushSync(() => setPrinting(true));
    const previousTitle = document.title;
    const name = fullName.trim();
    // Chrome and Edge use the document title as the default PDF file name.
    document.title = name ? `${name} - Resume` : 'Resume';
    const finish = () => {
      window.removeEventListener('afterprint', finish);
      document.title = previousTitle;
      setPrinting(false);
    };
    window.addEventListener('afterprint', finish);
    markExported();
    useXPStore.getState().unlockAchievement(RESUME_FIRST_EXPORT_ACHIEVEMENT);
    window.print();
  };

  return (
    <div className="@container relative flex h-full flex-col bg-black/30 text-white">
      <style>{RESUME_TEMPLATE_CSS}</style>

      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-3 py-2">
        <div className="mr-1 flex items-center gap-2">
          <FileText className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-bold tracking-wider text-cyan-300">RESUME BUILDER</h2>
        </div>

        <div
          role="tablist"
          aria-label="Resume panes"
          className="flex rounded-lg border border-white/10 bg-black/30 p-0.5 @3xl:hidden"
        >
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
                view === id ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/55 hover:text-white/85'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <span className="hidden text-[11px] text-white/40 @2xl:inline">
          Saved automatically
          {lastExportedAt && ` · last exported ${formatCalendarDate(lastExportedAt)}`}
        </span>

        <button
          type="button"
          onClick={handleExport}
          disabled={!canExport}
          title={
            canExport
              ? 'Opens the print dialog. Choose Save as PDF and turn off headers and footers.'
              : 'Add your name or any section first'
          }
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1 text-xs font-semibold text-black transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cyan-400"
        >
          <Printer className="h-3.5 w-3.5" /> Export PDF
        </button>
      </header>

      {autoFillNote && (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-1.5 text-[11px] text-cyan-100"
        >
          <Hammer className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
          <span className="min-w-0 flex-1 truncate">{autoFillNote}</span>
          <button
            type="button"
            onClick={() => setAutoFillNote(null)}
            aria-label="Dismiss"
            className="flex h-5 w-5 items-center justify-center rounded text-cyan-200/70 hover:bg-cyan-400/20 hover:text-cyan-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <section
          aria-label="Resume editor"
          className={cn(
            'min-h-0 w-full flex-col border-white/10 @3xl:flex @3xl:w-[44%] @3xl:max-w-[520px] @3xl:shrink-0 @3xl:border-r',
            view === 'editor' ? 'flex' : 'hidden'
          )}
        >
          <ResumeEditor />
        </section>
        <section
          aria-label="Resume preview"
          className={cn('min-h-0 min-w-0 flex-1 flex-col @3xl:flex', view === 'preview' ? 'flex' : 'hidden')}
        >
          <ResumePreview />
        </section>
      </div>

      {printing && <ResumePrintPortal />}
    </div>
  );
}

export const ResumeApp = memo(ResumeAppInner);
