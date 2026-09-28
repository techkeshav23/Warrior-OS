// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Template
// Page geometry plus the CSS for the resume "paper" (screen and
// print) and the print-only isolation rules used during export
// ═══════════════════════════════════════════════════════════

import { RESUME_ACCENTS } from '@/stores/useResumeStore';

/** CSS px per millimetre at 96 dpi. */
export const MM_TO_PX = 96 / 25.4;
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const PAGE_MARGIN_X_MM = 14;
export const PAGE_MARGIN_Y_MM = 12;
/** Printable height of one A4 page with the margins above. */
export const PAGE_CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - 2 * PAGE_MARGIN_Y_MM;

/** Direct child of <body> that holds the resume while the print dialog is open. */
export const RESUME_PRINT_ROOT_ID = 'warrior-resume-print';

const ACCENT_RULES = RESUME_ACCENTS.map(
  (accent) => `.wr-doc[data-accent="${accent.id}"] { --wr-accent: ${accent.hex}; }`
).join('\n');

/**
 * Resume look. Everything is scoped under .wr-doc / .wr-paper so it
 * cannot leak into the OS, and uses pt/mm so screen and paper match.
 */
export const RESUME_TEMPLATE_CSS = `
.wr-paper {
  position: relative;
  box-sizing: border-box;
  width: ${PAGE_WIDTH_MM}mm;
  min-height: ${PAGE_HEIGHT_MM}mm;
  padding: ${PAGE_MARGIN_Y_MM}mm ${PAGE_MARGIN_X_MM}mm;
  background: #ffffff;
  border-radius: 2px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06);
}
.wr-page-break {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed rgba(220, 38, 38, 0.55);
  pointer-events: none;
}
.wr-page-break > span {
  position: absolute;
  right: 3mm;
  top: 0.8mm;
  font: 600 7pt/1 system-ui, sans-serif;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(220, 38, 38, 0.75);
}
.wr-doc {
  --wr-accent: #1f2937;
  color: #111827;
  font-family: var(--font-inter), 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.4;
  text-align: left;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  user-select: text;
}
.wr-doc[data-font="serif"] { font-family: Georgia, Cambria, 'Times New Roman', Times, serif; }
.wr-doc[data-density="compact"] { font-size: 9.3pt; line-height: 1.3; }
${ACCENT_RULES}
.wr-doc *, .wr-doc *::before, .wr-doc *::after { box-sizing: border-box; }
.wr-doc a { color: inherit; text-decoration: none; }
.wr-doc h1, .wr-doc h2, .wr-doc p, .wr-doc ul, .wr-doc li { margin: 0; padding: 0; }
.wr-doc .wr-header { text-align: center; padding-bottom: 5pt; }
.wr-doc .wr-name {
  font-size: 21pt;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--wr-accent);
}
.wr-doc .wr-headline { margin-top: 2pt; font-size: 10.5pt; color: #374151; }
.wr-doc .wr-contact {
  margin-top: 4pt;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  row-gap: 1pt;
  font-size: 9pt;
  color: #374151;
}
.wr-doc .wr-contact > span + span::before { content: '\\00B7'; margin: 0 5pt; color: #9ca3af; }
.wr-doc .wr-section { margin-top: 8pt; }
.wr-doc[data-density="compact"] .wr-section { margin-top: 6pt; }
.wr-doc .wr-h2 {
  margin-bottom: 4pt;
  padding-bottom: 1.5pt;
  border-bottom: 1pt solid var(--wr-accent);
  font-size: 10.5pt;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--wr-accent);
  break-after: avoid;
  page-break-after: avoid;
}
.wr-doc .wr-summary { color: #1f2937; }
.wr-doc .wr-entry { margin-bottom: 5pt; break-inside: avoid; page-break-inside: avoid; }
.wr-doc .wr-entry:last-child { margin-bottom: 0; }
.wr-doc .wr-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8pt; }
.wr-doc .wr-title { font-weight: 700; color: #111827; }
.wr-doc .wr-tech { font-weight: 400; font-style: italic; color: #4b5563; }
.wr-doc .wr-meta { flex-shrink: 0; font-size: 9pt; color: #4b5563; white-space: nowrap; }
.wr-doc .wr-sub { font-style: italic; color: #374151; }
.wr-doc .wr-links { font-size: 9pt; color: #4b5563; }
.wr-doc .wr-links a { color: var(--wr-accent); }
.wr-doc .wr-links > span + span::before { content: '\\00B7'; margin: 0 5pt; color: #9ca3af; }
.wr-doc .wr-bullets { margin-top: 1.5pt; padding-left: 12pt; list-style: disc outside; }
.wr-doc .wr-bullets > li { margin-top: 1pt; padding-left: 1pt; }
.wr-doc .wr-bullets > li::marker { color: #6b7280; }
.wr-doc .wr-skills { display: grid; grid-template-columns: max-content 1fr; column-gap: 8pt; row-gap: 2pt; }
.wr-doc .wr-skill-label { font-weight: 700; color: #111827; }
.wr-doc .wr-hint { color: #9ca3af; font-style: italic; font-weight: 400; }
`;

/**
 * Print isolation: only mounted (inside the print portal) while the
 * browser print dialog is open. Hides every other child of <body> so
 * nothing of the OS reaches the paper.
 */
export const RESUME_PRINT_CSS = `
#${RESUME_PRINT_ROOT_ID} { display: none; }
@media print {
  @page { size: A4; margin: ${PAGE_MARGIN_Y_MM}mm ${PAGE_MARGIN_X_MM}mm; }
  html, body {
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
    color-scheme: light !important;
  }
  body > *:not(#${RESUME_PRINT_ROOT_ID}) { display: none !important; }
  body > #${RESUME_PRINT_ROOT_ID} { display: block !important; position: static !important; }
}
`;
