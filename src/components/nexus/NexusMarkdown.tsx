// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Markdown
// Safe markdown → React elements for AI replies. Supports fenced
// code (with copy button), inline code, bold, italics, strike,
// headings, lists, quotes, tables, rules and links. Model output
// is never passed to dangerouslySetInnerHTML — every node is built
// as a React element, and links are limited to http(s)/mailto.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState, type ReactNode } from 'react';
import { Check, Copy, X } from 'lucide-react';
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

const LINK_CLASS = 'text-cyan-300 underline decoration-cyan-300/40 underline-offset-2 hover:decoration-cyan-300';

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
            className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-cyan-200"
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
        out.push(<strong key={key('b')} className="font-semibold text-white">{renderInline(text.slice(i + 2, end), key('bi'))}</strong>);
        i = end + 2;
        continue;
      }
    }

    // Strikethrough: ~~text~~
    if (ch === '~' && next === '~') {
      const end = text.indexOf('~~', i + 2);
      if (end > i + 2) {
        flush();
        out.push(<del key={key('s')} className="opacity-70">{renderInline(text.slice(i + 2, end), key('si'))}</del>);
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
        out.push(<em key={key('i')} className="italic text-white/90">{renderInline(text.slice(i + 1, end), key('ii'))}</em>);
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

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

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
    <div className="my-2 overflow-hidden rounded-lg border border-white/10 bg-black/50">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-3 py-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">{lang || 'code'}</span>
        <button
          type="button"
          onClick={copy}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors',
            copyState === 'copied'
              ? 'text-emerald-300'
              : copyState === 'failed'
                ? 'text-rose-300'
                : 'text-white/55 hover:bg-white/5 hover:text-cyan-300'
          )}
          aria-label="Copy code"
        >
          {copyState === 'copied' ? <Check size={11} /> : copyState === 'failed' ? <X size={11} /> : <Copy size={11} />}
          {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-80 overflow-auto p-3 font-mono text-[12px] leading-relaxed text-cyan-50/90">
        <code>{code}</code>
      </pre>
    </div>
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
          className={cn(
            'font-semibold text-white',
            block.level <= 2 ? 'text-[15px]' : 'text-sm',
            'mt-1'
          )}
        >
          {renderInline(block.text, key)}
        </p>
      );
    case 'rule':
      return <hr key={key} className="my-2 border-white/10" />;
    case 'quote':
      return (
        <blockquote key={key} className="border-l-2 border-cyan-400/40 pl-3 text-white/70">
          {renderParagraphLines(block.lines, key)}
        </blockquote>
      );
    case 'table':
      return (
        <div key={key} className="my-1 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-white/5">
              <tr>
                {block.header.map((cell, c) => (
                  <th key={`${key}-h${c}`} className="border-b border-white/10 px-2 py-1.5 font-semibold text-white/85">
                    {renderInline(cell, `${key}-h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={`${key}-r${r}`} className="odd:bg-white/[0.02]">
                  {row.map((cell, c) => (
                    <td key={`${key}-r${r}c${c}`} className="border-b border-white/5 px-2 py-1.5 align-top text-white/75">
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
        <li key={`${key}-i${idx}`} style={{ marginLeft: `${item.depth * 14}px` }} className="pl-0.5">
          {renderInline(item.text, `${key}-i${idx}`)}
        </li>
      ));
      return block.ordered ? (
        <ol key={key} start={block.start} className="list-decimal space-y-0.5 pl-5 marker:text-cyan-300/70">
          {items}
        </ol>
      ) : (
        <ul key={key} className="list-disc space-y-0.5 pl-5 marker:text-cyan-300/70">
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
    <div className={cn('space-y-2 break-words text-sm leading-relaxed', className)}>
      {blocks.map((block, idx) => renderBlock(block, `b${idx}`))}
    </div>
  );
}

export const NexusMarkdown = memo(NexusMarkdownInner);
