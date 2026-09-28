// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Preview
// Live A4 preview of the print layout, scaled to fit the pane,
// with approximate page-break guides and a page count
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResumeStore } from '@/stores/useResumeStore';
import { ResumeDocument } from './ResumeDocument';
import {
  MM_TO_PX,
  PAGE_CONTENT_HEIGHT_MM,
  PAGE_HEIGHT_MM,
  PAGE_MARGIN_Y_MM,
  PAGE_WIDTH_MM,
} from './resume-template';

const PAGE_WIDTH_PX = PAGE_WIDTH_MM * MM_TO_PX;
const PAGE_HEIGHT_PX = PAGE_HEIGHT_MM * MM_TO_PX;
const MARGIN_Y_PX = PAGE_MARGIN_Y_MM * MM_TO_PX;
const CONTENT_HEIGHT_PX = PAGE_CONTENT_HEIGHT_MM * MM_TO_PX;
/** Horizontal padding of the scroll pane (p-4 on both sides). */
const PANE_PADDING_PX = 32;

type ZoomMode = 'fit' | 'actual';

function ResumePreviewInner() {
  const resume = useResumeStore((s) => s.resume);
  const style = useResumeStore((s) => s.style);
  const paneRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  const [docHeight, setDocHeight] = useState(0);
  const [zoom, setZoom] = useState<ZoomMode>('fit');

  useEffect(() => {
    const pane = paneRef.current;
    const doc = docRef.current;
    if (!pane || !doc || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setPaneWidth(pane.clientWidth);
      setDocHeight(doc.offsetHeight);
    });
    observer.observe(pane);
    observer.observe(doc);
    return () => observer.disconnect();
  }, []);

  const fitScale =
    paneWidth > 0 ? Math.min(1.25, Math.max(0.3, (paneWidth - PANE_PADDING_PX) / PAGE_WIDTH_PX)) : 0.6;
  const scale = zoom === 'fit' ? fitScale : 1;
  const paperHeight = Math.max(PAGE_HEIGHT_PX, docHeight + 2 * MARGIN_Y_PX);
  const pages = Math.max(1, Math.ceil((docHeight - 1) / CONTENT_HEIGHT_PX));
  const breaks = Array.from({ length: pages - 1 }, (_, i) => MARGIN_Y_PX + (i + 1) * CONTENT_HEIGHT_PX);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-3 py-1.5 text-[11px] text-white/50">
        <Eye className="h-3.5 w-3.5 shrink-0 text-cyan-300/80" />
        <span className="shrink-0 font-medium text-white/70">Live preview</span>
        <span
          className="hidden min-w-0 truncate @4xl:inline"
          title="Export opens the print dialog: pick Save as PDF and untick Headers and footers"
        >
          A4 · Export opens the print dialog: pick Save as PDF, untick Headers and footers
        </span>
        <span className="ml-auto shrink-0 tabular-nums">
          ≈ {pages} {pages === 1 ? 'page' : 'pages'}
        </span>
        <div className="flex shrink-0 rounded-md border border-white/10 p-0.5">
          {(['fit', 'actual'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={zoom === mode}
              onClick={() => setZoom(mode)}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px]',
                zoom === mode ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/50 hover:text-white/80'
              )}
            >
              {mode === 'fit' ? 'Fit' : '100%'}
            </button>
          ))}
        </div>
      </div>

      <div ref={paneRef} className="min-h-0 flex-1 overflow-auto bg-black/40 p-4">
        <div className="mx-auto" style={{ width: PAGE_WIDTH_PX * scale, height: paperHeight * scale }}>
          <div className="wr-paper" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div ref={docRef}>
              <ResumeDocument resume={resume} styleOpts={style} showHints />
            </div>
            {breaks.map((top, i) => (
              <div key={top} className="wr-page-break" style={{ top }} aria-hidden="true">
                <span>page {i + 2}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const ResumePreview = memo(ResumePreviewInner);
