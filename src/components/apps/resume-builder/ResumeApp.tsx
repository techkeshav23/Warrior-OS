// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Builder App
// Split view: form editor on the left, live A4 preview on the
// right (tabs on narrow windows). Export uses the browser print
// dialog ("Save as PDF"); print CSS isolates the resume from the OS.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { Anvil, Eye, PencilLine, Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppHeader, Button, IconButton, Tabs, Tooltip } from '@/components/ui';
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

const VIEWS = [
  { id: 'editor', label: 'Edit', icon: PencilLine },
  { id: 'preview', label: 'Preview', icon: Eye },
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
  const tabsId = useId();

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
    <div className="@container relative flex h-full min-h-0 flex-col text-ui text-fg">
      <style>{RESUME_TEMPLATE_CSS}</style>

      <AppHeader
        title="Resume"
        subtitle={`Saved automatically${lastExportedAt ? ` · last exported ${formatCalendarDate(lastExportedAt)}` : ' · A4, ATS-friendly'}`}
        actions={
          <>
            <div className="@3xl:hidden">
              <Tabs
                variant="pill"
                size="sm"
                aria-label="Resume panes"
                idPrefix={tabsId}
                value={view}
                onChange={(id) => setView(id as PaneView)}
                tabs={VIEWS}
              />
            </div>
            <Tooltip
              content={
                canExport
                  ? 'Opens the print dialog. Choose Save as PDF and turn off headers and footers.'
                  : 'Add your name or any section first'
              }
            >
              <Button variant="primary" leadingIcon={Printer} onClick={handleExport} disabled={!canExport}>
                Export PDF
              </Button>
            </Tooltip>
          </>
        }
      />

      {autoFillNote && (
        <div
          role="status"
          className="flex h-10 shrink-0 animate-fade-in items-center gap-2.5 border-b border-line bg-ember-500/[0.05] pl-5 pr-3 text-xs text-fg-muted"
        >
          <Anvil size={14} strokeWidth={1.75} aria-hidden className="shrink-0 text-ember-400" />
          <span className="min-w-0 flex-1 truncate">{autoFillNote}</span>
          <IconButton icon={X} size="xs" aria-label="Dismiss" onClick={() => setAutoFillNote(null)} />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <section
          aria-label="Resume editor"
          className={cn(
            'min-h-0 w-full flex-col border-line @3xl:flex @3xl:w-[46%] @3xl:max-w-[540px] @3xl:shrink-0 @3xl:border-r',
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
