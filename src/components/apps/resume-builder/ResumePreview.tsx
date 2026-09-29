// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Preview
// Live A4 preview of the print layout on a quiet "desk", scaled
// to fit the pane, with approximate page-break guides, a page
// count and Fit / 100% zoom.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { Badge, SegmentedControl, Toolbar, ToolbarSpacer } from '@/components/ui';
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
/** Horizontal padding of the scroll pane (p-6 on both sides). */
const PANE_PADDING_PX = 48;

type ZoomMode = 'fit' | 'actual';

const ZOOM_OPTIONS: { value: ZoomMode; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: 'actual', label: '100%' },
];

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
      <Toolbar aria-label="Preview">
        <Eye size={16} strokeWidth={1.75} aria-hidden className="ml-1 shrink-0 text-fg-subtle" />
        <span className="ml-1 shrink-0 text-ui font-medium text-fg">Live preview</span>
        <span
          className="ml-2 hidden min-w-0 truncate text-xs text-fg-subtle @4xl:inline"
          title="Export opens the print dialog: pick Save as PDF and untick Headers and footers"
        >
          A4 · export opens the print dialog: pick Save as PDF, untick Headers and footers
        </span>
        <ToolbarSpacer />
        <Badge tone={pages > 1 ? 'warning' : 'neutral'} className="tabular">
          ≈ {pages} {pages === 1 ? 'page' : 'pages'}
        </Badge>
        <span className="w-1" aria-hidden />
        <SegmentedControl size="sm" aria-label="Zoom" value={zoom} onChange={setZoom} options={ZOOM_OPTIONS} />
      </Toolbar>

      <div
        ref={paneRef}
        className="scrollbar-thin min-h-0 flex-1 overflow-auto bg-ink-950/55 bg-[radial-gradient(var(--color-line)_1px,transparent_1px)] bg-[length:16px_16px] p-6"
      >
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
