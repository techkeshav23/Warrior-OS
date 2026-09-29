// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Markdown
// Safe markdown → React elements for AI replies. Supports fenced
// code (language header, copy, line numbers, FORGE syntax colours),
// inline code, bold, italics, strike, headings, lists, quotes,
// tables, rules and links. Model output is never passed to
// dangerouslySetInnerHTML — every node is built as a React element,
// and links are limited to http(s)/mailto.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState, type ReactNode } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { highlight, resolveSyntaxLang } from '@/components/apps/code-lab/syntax';
import { cn } from '@/lib/utils';

// ─── Block parsing ───

type Block =
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; start: number; items: Array<{ text: string; depth: number }> }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'rule' };

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const RULE_RE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE_RE = /^\s{0,3}>/;
const LIST_RE = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableStart(lines: string[], i: number): boolean {
  return lines[i].includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1]);
}

function isBlockStart(lines: string[], i: number): boolean {
  const line = lines[i];
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    RULE_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line) ||
    isTableStart(lines, i)
  );
}

export function parseMarkdownBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = FENCE_RE.exec(line);
    if (fence) {
      const marker = fence[1];
      const close = new RegExp(`^\\s{0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}\\s*$`);
      const body: string[] = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // skip the closing fence (or run past the end of an unterminated one)
      blocks.push({ kind: 'code', lang: fence[2] ?? '', code: body.join('\n') });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (RULE_RE.test(line)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        quote.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', lines: quote });
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    const listMatch = LIST_RE.exec(line);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[2]);
      const start = ordered ? Number.parseInt(listMatch[2], 10) || 1 : 1;
      const items: Array<{ text: string; depth: number }> = [];
      while (i < lines.length) {
        const m = LIST_RE.exec(lines[i]);
        if (m) {
          const indent = m[1].replace(/\t/g, '  ').length;
          const depth = Math.min(3, Math.floor(indent / 2));
          // A top-level item of the other list type starts a new list.
          if (depth === 0 && items.length > 0 && /\d/.test(m[2]) !== ordered) break;
          items.push({ text: m[3], depth });
          i++;
          continue;
        }
        if (items.length > 0 && /^\s{2,}\S/.test(lines[i])) {
          items[items.length - 1].text += ` ${lines[i].trim()}`;
          i++;
          continue;
        }
        break;
      }
      blocks.push({ kind: 'list', ordered, start, items });
      continue;
    }

    const paragraph: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines, i)) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push({ kind: 'paragraph', lines: paragraph });
  }
  return blocks;
}

// ─── Inline parsing ───

const LINK_RE = /^\[([^\]\n]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/;
const AUTOLINK_RE = /^https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"\]]/;
const ESCAPABLE = '\\`*_{}[]()#+-.!~|>';

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

/** Allow only absolute http(s) and mailto links. */
function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:' ? url.href : null;
  } catch {
    return null;
  }
}

function findItalicEnd(text: string, from: number, marker: string): number {
  for (let j = from + 1; j < text.length; j++) {
    if (text[j] !== marker) continue;
    if (/\s/.test(text[j - 1])) continue;
    if (marker === '*' && text[j + 1] === '*') {
      j++;
      continue;
    }
    if (marker === '_' && isWordChar(text[j + 1])) continue;
    return j;
  }
  return -1;
}

const LINK_CLASS =
  'text-accent underline decoration-accent/40 underline-offset-2 transition-[text-decoration-color] duration-120 ease-out-quint hover:decoration-accent';

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let buffer = '';
  let k = 0;
  const flush = () => {
    if (buffer) {
      out.push(buffer);
      buffer = '';
    }
  };
  const key = (tag: string) => `${keyBase}-${tag}${k++}`;

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    // Backslash escapes
    if (ch === '\\' && next !== undefined && ESCAPABLE.includes(next)) {
      buffer += next;
      i += 2;
      continue;
    }

    // Inline code: `code` or ``code with ` inside``
    if (ch === '`') {
      let run = 1;
      while (text[i + run] === '`') run++;
      const fence = '`'.repeat(run);
      const end = text.indexOf(fence, i + run);
      if (end !== -1) {
        flush();
        const code = text.slice(i + run, end).replace(/^ (.+) $/, '$1');
        out.push(
          <code
            key={key('c')}
            className="bg-steel-950/80 px-1.5 py-px font-mono text-[0.86em] text-fg ring-1 ring-inset ring-line box-decoration-clone"
          >
            {code}
          </code>
        );
        i = end + run;
        continue;
      }
      buffer += fence;
      i += run;
      continue;
    }

    // Bold: **text** or __text__
    if ((ch === '*' || ch === '_') && next === ch && (ch === '*' || !isWordChar(text[i - 1]))) {
      const end = text.indexOf(ch + ch, i + 2);
      if (end > i + 2) {
        flush();
        out.push(<strong key={key('b')} className="font-semibold text-fg">{renderInline(text.slice(i + 2, end), key('bi'))}</strong>);
        i = end + 2;
        continue;
      }
    }

    // Strikethrough: ~~text~~
    if (ch === '~' && next === '~') {
      const end = text.indexOf('~~', i + 2);
      if (end > i + 2) {
        flush();
        out.push(<del key={key('s')} className="text-fg-subtle">{renderInline(text.slice(i + 2, end), key('si'))}</del>);
        i = end + 2;
        continue;
      }
    }

    // Italic: *text* or _text_
    if (
      (ch === '*' || ch === '_') &&
      next !== undefined &&
      next !== ch &&
      !/\s/.test(next) &&
      (ch === '*' || !isWordChar(text[i - 1]))
    ) {
      const end = findItalicEnd(text, i, ch);
      if (end !== -1) {
        flush();
        out.push(<em key={key('i')} className="italic">{renderInline(text.slice(i + 1, end), key('ii'))}</em>);
        i = end + 1;
        continue;
      }
    }

    // Link: [text](https://...)
    if (ch === '[') {
      const m = LINK_RE.exec(text.slice(i));
      if (m) {
        flush();
        const href = safeHref(m[2]);
        const label = renderInline(m[1], key('li'));
        out.push(
          href ? (
            <a key={key('a')} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
              {label}
            </a>
          ) : (
            <span key={key('a')}>{label}</span>
          )
        );
        i += m[0].length;
        continue;
      }
    }

    // Bare URL
    if (ch === 'h' && !isWordChar(text[i - 1]) && (text.startsWith('https://', i) || text.startsWith('http://', i))) {
      const m = AUTOLINK_RE.exec(text.slice(i));
      const href = m ? safeHref(m[0]) : null;
      if (m && href) {
        flush();
        out.push(
          <a key={key('u')} href={href} target="_blank" rel="noopener noreferrer" className={cn(LINK_CLASS, 'break-all')}>
            {m[0]}
          </a>
        );
        i += m[0].length;
        continue;
      }
    }

    buffer += ch;
    i++;
  }
  flush();
  return out;
}

// ─── Code block ───

const LANG_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  py: 'Python',
  python: 'Python',
  sh: 'Shell',
  bash: 'Bash',
  shell: 'Shell',
  zsh: 'Shell',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  sql: 'SQL',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  cs: 'C#',
  go: 'Go',
  rust: 'Rust',
  rs: 'Rust',
  md: 'Markdown',
  markdown: 'Markdown',
  yaml: 'YAML',
  yml: 'YAML',
};

/** Line numbers appear once a snippet is long enough to talk about by line. */
const LINE_NUMBERS_FROM = 4;

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const syntax = resolveSyntaxLang(lang);
  const highlighted = useMemo(() => highlight(code, syntax), [code, syntax]);
  const lineCount = useMemo(() => code.split('\n').length, [code]);
  const label = LANG_LABELS[lang.toLowerCase()] ?? (lang || 'Code');

  const copy = () => {
    const done = (state: 'copied' | 'failed') => {
      setCopyState(state);
      window.setTimeout(() => setCopyState('idle'), 1600);
    };
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      done('failed');
      return;
    }
    navigator.clipboard.writeText(code).then(
      () => done('copied'),
      () => done('failed')
    );
  };

  return (
    <figure className="chamfer-md my-3 overflow-hidden bg-linear-to-b from-steel-950 to-ink-850 shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_2px_6px_rgb(0_0_0/0.45),inset_0_-1px_0_rgb(255_255_255/0.07)]">
      <figcaption className="flex h-8 items-center justify-between gap-2 border-b border-line bg-steel-800/70 pl-3 pr-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-1.5 shrink-0 rotate-45 bg-plasma-400/80" aria-hidden />
          <span className="truncate font-mono text-2xs font-medium uppercase tracking-[0.12em] text-fg-subtle">
            {label}
          </span>
        </span>
        <button
          type="button"
          onClick={copy}
          className={cn(
            'chamfer-xs focus-ring flex h-6 items-center gap-1.5 px-2 text-xs font-medium',
            'transition-colors duration-120 ease-out-quint',
            copyState === 'copied'
              ? 'text-success'
              : copyState === 'failed'
                ? 'text-danger'
                : 'text-fg-muted hover:bg-surface-hover hover:text-fg active:bg-surface-active'
          )}
          aria-label="Copy code"
        >
          {copyState === 'copied' ? (
            <Check size={13} strokeWidth={2} aria-hidden />
          ) : copyState === 'failed' ? (
            <X size={13} strokeWidth={2} aria-hidden />
          ) : (
            <Copy size={13} strokeWidth={1.75} aria-hidden />
          )}
          <span aria-live="polite">
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </span>
        </button>
      </figcaption>
      <div className="scrollbar-thin flex max-h-80 overflow-auto">
        {lineCount >= LINE_NUMBERS_FROM && (
          <div
            aria-hidden
            className="sticky left-0 shrink-0 select-none border-r border-line bg-ink-850 py-3 pl-3 pr-2.5 text-right font-mono text-xs leading-5 text-fg-faint tabular"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        )}
        <pre className="min-w-0 flex-1 select-text whitespace-pre px-3.5 py-3 font-mono text-xs leading-5 text-fg [font-variant-ligatures:none]">
          <code>{highlighted}</code>
        </pre>
      </div>
    </figure>
  );
}

// ─── Block rendering ───

function renderParagraphLines(lines: string[], keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) out.push(<br key={`${keyBase}-br${idx}`} />);
    out.push(...renderInline(line, `${keyBase}-l${idx}`));
  });
  return out;
}

function renderBlock(block: Block, key: string): ReactNode {
  switch (block.kind) {
    case 'code':
      return <CodeBlock key={key} code={block.code} lang={block.lang} />;
    case 'heading':
      return (
        <p
          key={key}
          role="heading"
          aria-level={Math.min(6, block.level + 2)}
          className={cn(
            'font-semibold tracking-tight text-fg [&:not(:first-child)]:mt-4',
            block.level <= 2 ? 'text-base' : 'text-sm'
          )}
        >
          {renderInline(block.text, key)}
        </p>
      );
    case 'rule':
      return <hr key={key} className="my-4 border-line" />;
    case 'quote':
      return (
        <blockquote key={key} className="border-l-2 border-accent/40 pl-3.5 text-fg-muted">
          {renderParagraphLines(block.lines, key)}
        </blockquote>
      );
    case 'table':
      return (
        <div key={key} className="chamfer-sm scrollbar-thin my-1 overflow-x-auto bg-steel-950/40 shadow-[inset_0_0_0_1px_var(--color-line)]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-surface-2">
              <tr>
                {block.header.map((cell, c) => (
                  <th
                    key={`${key}-h${c}`}
                    className="border-b border-line px-3 py-2 font-mono text-2xs font-medium uppercase tracking-[0.12em] text-fg-subtle"
                  >
                    {renderInline(cell, `${key}-h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {block.rows.map((row, r) => (
                <tr key={`${key}-r${r}`} className="transition-colors duration-120 hover:bg-surface-hover">
                  {row.map((cell, c) => (
                    <td key={`${key}-r${r}c${c}`} className="px-3 py-2 align-top text-fg-muted">
                      {renderInline(cell, `${key}-r${r}c${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'list': {
      const items = block.items.map((item, idx) => (
        <li key={`${key}-i${idx}`} style={{ marginLeft: `${item.depth * 16}px` }} className="pl-1">
          {renderInline(item.text, `${key}-i${idx}`)}
        </li>
      ));
      return block.ordered ? (
        <ol key={key} start={block.start} className="list-decimal space-y-1 pl-5 marker:font-mono marker:text-xs marker:text-fg-subtle">
          {items}
        </ol>
      ) : (
        <ul key={key} className="list-disc space-y-1 pl-5 marker:text-accent/70">
          {items}
        </ul>
      );
    }
    case 'paragraph':
      return <p key={key}>{renderParagraphLines(block.lines, key)}</p>;
  }
}

interface NexusMarkdownProps {
  text: string;
  className?: string;
}

function NexusMarkdownInner({ text, className }: NexusMarkdownProps) {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);
  return (
    <div className={cn('select-text space-y-3 break-words text-sm', className)}>
      {blocks.map((block, idx) => renderBlock(block, `b${idx}`))}
    </div>
  );
}

export const NexusMarkdown = memo(NexusMarkdownInner);
