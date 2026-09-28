// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Print Portal
// Mounted only while the browser print dialog is open: renders a
// clean copy of the resume as a direct child of <body> together
// with print CSS that hides the rest of the OS.
// ═══════════════════════════════════════════════════════════

'use client';

import { createPortal } from 'react-dom';
import { useResumeStore } from '@/stores/useResumeStore';
import { ResumeDocument } from './ResumeDocument';
import { RESUME_PRINT_CSS, RESUME_PRINT_ROOT_ID, RESUME_TEMPLATE_CSS } from './resume-template';

export function ResumePrintPortal() {
  const resume = useResumeStore((s) => s.resume);
  const style = useResumeStore((s) => s.style);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div id={RESUME_PRINT_ROOT_ID}>
      <style>{`${RESUME_TEMPLATE_CSS}\n${RESUME_PRINT_CSS}`}</style>
      <ResumeDocument resume={resume} styleOpts={style} />
    </div>,
    document.body
  );
}
