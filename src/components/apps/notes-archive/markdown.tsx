// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Notes markdown
// A small, safe markdown renderer (React elements, never raw HTML) for
// the preview, plus the colour-only source highlighter that sits under
// the editor's transparent textarea. Supported: # headings, paragraphs,
// > quotes, - / 1. lists, - [ ] tasks, ``` code ```, ---, **bold**,
// *italic*, ~~strike~~, `code`, [links](https://…), bare URLs and
// [[Wiki Links]] (optionally [[Title|label]]).
// ═══════════════════════════════════════════════════════════

'use client';

import { Fragment, type ReactNode } from 'react';
import { Square, SquareCheckBig } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Block parsing ───────────────────────────────────────

interface ListItem {
  text: string;
  /** null = plain item, else the task's checked state */
  task: boolean | null;
  depth: number;
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'hr' };

const FENCE_RE = /^\s*```\s*([\w+#.-]*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE_RE = /^\s*>/;
// indent · marker · gap · optional task box · text (groups keep every character)
const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(\[([ xX])\]\s+)?(.*)$/;

function isBlockStart(line: string): boolean {
  return FENCE_RE.test(line) || HEADING_RE.test(line) || HR_RE.test(line) || QUOTE_RE.test(line) || LIST_RE.test(line);
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(FENCE_RE);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (or end of note)
      blocks.push({ kind: 'code', lang: fence[1] ?? '', code: body.join('\n') });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (HR_RE.test(line)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }
    if (QUOTE_RE.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ kind: 'quote', lines: quote });
      continue;
    }
    const first = line.match(LIST_RE);
    if (first) {
      const ordered = /\d/.test(first[2]);
      const items: ListItem[] = [];
      while (i < lines.length) {
        const m = lines[i].match(LIST_RE);
        if (!m || /\d/.test(m[2]) !== ordered || HR_RE.test(lines[i])) break;
        items.push({
          text: m[6],
          task: m[4] ? m[5].toLowerCase() === 'x' : null,
          depth: Math.min(3, Math.floor(m[1].replace(/\t/g, '  ').length / 2)),
        });
        i++;
      }
      blocks.push({ kind: 'list', ordered, start: ordered ? parseInt(first[2], 10) || 1 : 1, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++]);
    blocks.push({ kind: 'paragraph', lines: para });
  }
  return blocks;
}

// ─── Inline rendering ────────────────────────────────────

interface RenderContext {
  onNavigate?: (title: string) => void;
  knownTitles?: ReadonlySet<string>;
}

// code · wiki · bold · strike · italic · [label](url) · bare url
const INLINE_RE =
  /`([^`\n]+)`|\[\[([^\]\n]+?)\]\]|\*\*(.+?)\*\*|~~(.+?)~~|\*(?!\s)([^*\n]+?)\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g;

function renderInline(text: string, ctx: RenderContext, key = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}-${n++}`;
    if (m[1] != null) {
      out.push(
        <code key={k} className="chamfer-xs bg-steel-950 px-1.5 py-px font-mono text-[0.86em] text-fg shadow-[inset_0_1px_0_rgb(0_0_0/0.6)]">
          {m[1]}
        </code>
      );
    } else if (m[2] != null) {
      const [rawTitle, alias] = m[2].split('|');
      const title = rawTitle.trim();
      const label = (alias ?? rawTitle).trim() || title;
      const known = ctx.knownTitles?.has(title.toLowerCase()) ?? true;
      out.push(
        <button
          key={k}
          type="button"
          data-wikilink={title}
          title={known ? `Open “${title}”` : `Create “${title}”`}
          onClick={() => ctx.onNavigate?.(title)}
          className={cn(
            'focus-ring inline px-0.5 text-left font-medium underline underline-offset-[3px]',
            'transition-colors duration-120 ease-out-quint',
            known
              ? 'text-accent decoration-accent/40 hover:bg-accent/10 hover:decoration-accent'
              : 'text-fg-muted decoration-fg-faint decoration-dashed hover:bg-surface-hover hover:text-fg'
          )}
        >
          {label}
        </button>
      );
    } else if (m[3] != null) {
      out.push(
        <strong key={k} className="font-semibold text-fg">
          {renderInline(m[3], ctx, k)}
        </strong>
      );
    } else if (m[4] != null) {
      out.push(
        <del key={k} className="text-fg-subtle decoration-fg-subtle">
          {renderInline(m[4], ctx, k)}
        </del>
      );
    } else if (m[5] != null) {
      out.push(
        <em key={k} className="italic text-fg">
          {renderInline(m[5], ctx, k)}
        </em>
      );
    } else {
      const href = m[7] ?? m[8];
      out.push(
        <a
          key={k}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring text-accent underline decoration-accent/40 underline-offset-[3px] transition-colors duration-120 hover:decoration-accent"
        >
          {m[6] ?? href}
        </a>
      );
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Lines of a paragraph/quote keep their manual line breaks. */
function renderLines(lines: string[], ctx: RenderContext, key: string): ReactNode[] {
  return lines.map((line, i) => (
    <Fragment key={`${key}-l${i}`}>
      {i > 0 && <br />}
      {renderInline(line, ctx, `${key}-l${i}`)}
    </Fragment>
  ));
}

// ─── Preview ─────────────────────────────────────────────

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-8 mb-3 text-xl font-semibold text-fg',
  2: 'mt-7 mb-2.5 text-lg font-semibold text-fg',
  3: 'mt-6 mb-2 text-base font-semibold text-fg',
  4: 'mt-5 mb-1.5 text-sm font-semibold text-fg',
  5: 'mt-5 mb-1.5 text-sm font-semibold text-fg-muted',
  6: 'mt-5 mb-1.5 text-sm font-semibold text-fg-muted',
};

export interface MarkdownPreviewProps {
  source: string;
  onNavigate?: (title: string) => void;
  /** Lower-cased titles of notes that exist (unknown wiki-links render as "create"). */
  knownTitles?: ReadonlySet<string>;
  /** Skip a leading H1 that repeats this title (it's already shown above). */
  hideLeadingTitle?: string;
  className?: string;
}

/** Rendered markdown with the Notes prose typography. */
export function MarkdownPreview({ source, onNavigate, knownTitles, hideLeadingTitle, className }: MarkdownPreviewProps) {
  const ctx: RenderContext = { onNavigate, knownTitles };
  let blocks = parseBlocks(source);
  const head = blocks[0];
  if (
    hideLeadingTitle &&
    head?.kind === 'heading' &&
    head.level === 1 &&
    head.text.trim().toLowerCase() === hideLeadingTitle.trim().toLowerCase()
  ) {
    blocks = blocks.slice(1);
  }

  return (
    <div className={cn('select-text text-sm leading-6 text-fg-muted [&>*:first-child]:mt-0', className)}>
      {blocks.map((block, bi) => {
        const key = `b${bi}`;
        switch (block.kind) {
          case 'heading': {
            const Tag = `h${Math.min(block.level, 6)}` as 'h1';
            return (
              <Tag key={key} className={cn('tracking-tight', HEADING_CLASS[block.level] ?? HEADING_CLASS[4])}>
                {renderInline(block.text, ctx, key)}
              </Tag>
            );
          }
          case 'paragraph':
            return (
              <p key={key} className="my-3">
                {renderLines(block.lines, ctx, key)}
              </p>
            );
          case 'quote':
            return (
              <blockquote
                key={key}
                className="chamfer-sm my-4 border-l-2 border-accent/55 bg-surface-2 py-2 pl-4 pr-3 text-fg-muted [--cut-bl:0px] [--cut-tl:0px]"
              >
                {renderLines(block.lines, ctx, key)}
              </blockquote>
            );
          case 'hr':
            return <hr key={key} className="my-6 h-px border-0 bg-line" />;
          case 'code':
            return (
              <div key={key} className="chamfer-md my-4 overflow-hidden bg-linear-to-b from-steel-950 to-ink-850 shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_2px_6px_rgb(0_0_0/0.4),inset_0_-1px_0_rgb(255_255_255/0.06)]">
                {block.lang && (
                  <div className="hud-label border-b border-line px-3 py-1.5">{block.lang}</div>
                )}
                <pre className="scrollbar-thin overflow-x-auto px-4 py-3 font-mono text-xs leading-5 text-fg">
                  <code>{block.code}</code>
                </pre>
              </div>
            );
          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul';
            return (
              <ListTag key={key} className="my-3 flex flex-col gap-1.5">
                {block.items.map((item, ii) => (
                  <li
                    key={`${key}-${ii}`}
                    className="flex min-w-0 gap-2.5"
                    style={item.depth ? { paddingLeft: item.depth * 20 } : undefined}
                  >
                    {item.task !== null ? (
                      <span className={cn('mt-[3px] flex shrink-0', item.task ? 'text-success' : 'text-fg-subtle')} aria-hidden>
                        {item.task ? <SquareCheckBig size={16} strokeWidth={1.75} /> : <Square size={16} strokeWidth={1.75} />}
                      </span>
                    ) : block.ordered ? (
                      <span className="tabular mt-px w-5 shrink-0 text-right font-mono text-xs leading-6 text-fg-subtle" aria-hidden>
                        {block.start + ii}.
                      </span>
                    ) : (
                      <span className="mt-[9px] size-1.5 shrink-0 rotate-45 bg-accent/60" aria-hidden />
                    )}
                    <span className={cn('min-w-0 flex-1', item.task && 'text-fg-subtle line-through decoration-fg-faint')}>
                      {item.task !== null && <span className="sr-only">{item.task ? 'Done: ' : 'To do: '}</span>}
                      {renderInline(item.text, ctx, `${key}-${ii}`)}
                    </span>
                  </li>
                ))}
              </ListTag>
            );
          }
        }
      })}
    </div>
  );
}

// ─── Source highlighting (write mode) ────────────────────
// Colour and weight only: JetBrains Mono keeps one advance width for
// every weight, so the highlighted copy lines up with the textarea's
// caret exactly. Never add padding, borders or size changes here.

const MARK = 'text-fg-faint';

// code · [[wiki]] · **bold** · ~~strike~~ · *italic* · [label](url) · bare url
const SOURCE_INLINE_RE =
  /(`[^`\n]+`)|(\[\[)([^\]\n]+?)(\]\])|(\*\*)(.+?)(\*\*)|(~~)(.+?)(~~)|(\*)(?!\s)([^*\n]+?)(\*)|(\[)([^\]\n]+)(\]\()([^)\n]+)(\))|(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g;

function highlightInline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(SOURCE_INLINE_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}-${n++}`;
    if (m[1] != null) {
      out.push(
        <span key={k} className="bg-surface-active text-fg">
          {m[1]}
        </span>
      );
    } else if (m[2] != null) {
      out.push(
        <span key={k}>
          <span className="text-accent/45">{m[2]}</span>
          <span className="text-accent">{m[3]}</span>
          <span className="text-accent/45">{m[4]}</span>
        </span>
      );
    } else if (m[5] != null) {
      out.push(
        <span key={k}>
          <span className={MARK}>{m[5]}</span>
          <span className="font-semibold text-fg">{m[6]}</span>
          <span className={MARK}>{m[7]}</span>
        </span>
      );
    } else if (m[8] != null) {
      out.push(
        <span key={k}>
          <span className={MARK}>{m[8]}</span>
          <span className="text-fg-subtle line-through">{m[9]}</span>
          <span className={MARK}>{m[10]}</span>
        </span>
      );
    } else if (m[11] != null) {
      out.push(
        <span key={k}>
          <span className={MARK}>{m[11]}</span>
          <span className="italic text-fg">{m[12]}</span>
          <span className={MARK}>{m[13]}</span>
        </span>
      );
    } else if (m[14] != null) {
      out.push(
        <span key={k}>
          <span className={MARK}>{m[14]}</span>
          <span className="text-accent">{m[15]}</span>
          <span className={MARK}>
            {m[16]}
            {m[17]}
            {m[18]}
          </span>
        </span>
      );
    } else {
      out.push(
        <span key={k} className="text-accent/80 underline decoration-accent/30">
          {m[19]}
        </span>
      );
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function highlightLine(line: string, key: string): ReactNode {
  const heading = line.match(/^(#{1,6})(\s+)(.*)$/);
  if (heading) {
    return (
      <>
        <span className="text-accent/55">{heading[1]}</span>
        {heading[2]}
        <span className="font-semibold text-fg">{heading[3]}</span>
      </>
    );
  }
  if (HR_RE.test(line)) return <span className={MARK}>{line}</span>;
  const quote = line.match(/^(\s*>\s?)(.*)$/);
  if (quote) {
    return (
      <>
        <span className="text-accent/55">{quote[1]}</span>
        <span className="italic text-fg-subtle">{highlightInline(quote[2], key)}</span>
      </>
    );
  }
  const item = line.match(LIST_RE);
  if (item) {
    const done = item[5]?.toLowerCase() === 'x';
    return (
      <>
        {item[1]}
        <span className="text-accent/80">{item[2]}</span>
        {item[3]}
        {item[4] && <span className={done ? 'text-success' : 'text-fg-subtle'}>{item[4]}</span>}
        <span className={done ? 'text-fg-subtle' : undefined}>{highlightInline(item[6], key)}</span>
      </>
    );
  }
  return highlightInline(line, key);
}

/** Highlighted copy of the markdown source, line for line. */
export function highlightSource(source: string): ReactNode[] {
  const lines = source.split('\n');
  let inFence = false;
  return lines.map((line, i) => {
    let node: ReactNode;
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      node = <span className={MARK}>{line}</span>;
    } else if (inFence) {
      node = <span className="text-fg">{line}</span>;
    } else {
      node = highlightLine(line, `s${i}`);
    }
    return (
      <Fragment key={i}>
        {node}
        {i < lines.length - 1 ? '\n' : null}
      </Fragment>
    );
  });
}

// ─── Plain text helpers (list snippets, search) ──────────

/** Markdown → plain text (syntax removed, whitespace collapsed). */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t: string, a?: string) => a || t)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/\*\*|__|~~|\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * One line of plain text for list rows: body text first (headings are
 * skipped unless the note has nothing else). Drops a leading H1 = title.
 */
export function plainSnippet(content: string, title = '', max = 160): string {
  let text = content.replace(/\r\n?/g, '\n');
  const first = text.match(/^\s*#\s+(.+)\n?/);
  if (first && first[1].trim().toLowerCase() === title.trim().toLowerCase()) text = text.slice(first[0].length);
  const body = plainText(text.replace(/^\s{0,3}#{1,6}\s.*$/gm, ''));
  const out = body || plainText(text);
  return out.length > max ? `${out.slice(0, max).trimEnd()}…` : out;
}

/** Titles this note links to with [[…]] (lower-cased). */
export function wikiTargets(content: string): string[] {
  const out: string[] = [];
  for (const m of content.matchAll(/\[\[([^\]\n]+?)\]\]/g)) {
    const title = m[1].split('|')[0].trim().toLowerCase();
    if (title) out.push(title);
  }
  return out;
}
