// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Code Lab
// HTML/CSS/JS playground with live iframe preview (no external deps).
// Toolbar: file (language) switcher, layout (split / stacked /
// editor / preview), auto-run, reset, Run. Editor: syntax colours,
// line gutter, current-line band, Tab indent (Esc then Tab leaves),
// auto-indent, Ctrl/Cmd+Enter runs. Preview: sandboxed iframe whose
// console.* calls and errors stream into the Console pane.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo, type KeyboardEvent, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Code2,
  Columns2,
  Eye,
  Info,
  Play,
  RotateCcw,
  RotateCw,
  Rows2,
  SquareTerminal,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  IconButton,
  SegmentedControl,
  Switch,
  Toolbar,
  ToolbarSeparator,
  ToolbarSpacer,
  Tooltip,
} from '@/components/ui';
import { highlight } from './syntax';
import { cn } from '@/lib/utils';
import { ENGRAVED_LABEL } from '@/components/ui/armor';

const STORE_KEY = 'warrior-codelab';
const LAYOUT_KEY = 'warrior-codelab-layout';
const MAX_LOGS = 200;

type Lang = 'html' | 'css' | 'js';
type Layout = 'split' | 'stack' | 'editor' | 'preview';
type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface Snippet {
  html: string;
  css: string;
  js: string;
}

interface ConsoleEntry {
  id: number;
  level: LogLevel;
  text: string;
  at: number;
}

const FILES: { lang: Lang; file: string; label: string; dot: string }[] = [
  { lang: 'html', file: 'index.html', label: 'HTML', dot: 'bg-ember-400' },
  { lang: 'css', file: 'style.css', label: 'CSS', dot: 'bg-info' },
  { lang: 'js', file: 'script.js', label: 'JS', dot: 'bg-gold' },
];

const DEFAULT_SNIPPET: Snippet = {
  html: `<main class="card">
  <p class="eyebrow">Warrior OS · Code Lab</p>
  <h1>Hello, Warrior</h1>
  <p class="lead">Edit the HTML, CSS and JS tabs. The preview updates as you type.</p>
  <button id="btn">Forge it</button>
  <p id="out">Forged 0 times</p>
</main>`,
  css: `:root { color-scheme: dark; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 50% 0%, #1b2026, #050608 70%);
  color: #eceae6;
  font-family: Inter, system-ui, sans-serif;
}

.card {
  max-width: 360px;
  padding: 32px 36px;
  background: linear-gradient(#232930, #15191e);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.6);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  text-align: center;
}

.eyebrow {
  margin: 0;
  font: 500 11px/16px ui-monospace, monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #78818c;
}

h1 { margin: 8px 0; font-size: 32px; color: #ff8a3d; text-transform: uppercase; letter-spacing: 0.04em; }
.lead { margin: 0 0 20px; color: #aab0b8; line-height: 1.5; }

button {
  padding: 10px 18px;
  border: 0;
  background: linear-gradient(#ffb27a, #ff8a3d 45%, #d4520b);
  clip-path: polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px);
  color: #1a0a02;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  cursor: pointer;
}

#out { margin: 12px 0 0; color: #78818c; font-size: 13px; }`,
  js: `let count = 0;
const out = document.getElementById('out');

document.getElementById('btn').addEventListener('click', () => {
  count++;
  out.textContent = \`Forged \${count} \${count === 1 ? 'time' : 'times'}\`;
  console.log('Forged', count);
});

console.log('Code Lab ready. Click the button.');`,
};

function loadSnippet(): Snippet {
  if (typeof window === 'undefined') return DEFAULT_SNIPPET;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...DEFAULT_SNIPPET, ...JSON.parse(raw) } : DEFAULT_SNIPPET;
  } catch {
    return DEFAULT_SNIPPET;
  }
}

function loadLayout(): Layout {
  if (typeof window === 'undefined') return 'split';
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw === 'stack' || raw === 'editor' || raw === 'preview' ? raw : 'split';
  } catch {
    return 'split';
  }
}

/**
 * Runs first inside the preview: forwards console.* and errors to Code Lab.
 * `offset` = document lines before script.js line 1, `lines` = its length,
 * so reported line numbers are relative to script.js (other lines dropped).
 * The preview is sandboxed without allow-same-origin, so reading
 * localStorage / sessionStorage throws a SecurityError; the shim swaps in
 * a per-run in-memory Storage so snippets that save state still work.
 */
function consoleShim(token: string, offset: number, lines: number): string {
  return `(function(){var T=${JSON.stringify(token)},O=${offset},N=${lines};
function ln(n){n=+n-O;return n>=1&&n<=N?' (script.js line '+n+')':''}
function stackLine(v){var m=/about:srcdoc:(\\d+)/.exec(String(v&&v.stack||''));return m?ln(m[1]):''}
function fmt(v){try{if(typeof v==='string')return v;if(v instanceof Error)return v.name+': '+v.message+stackLine(v);if(typeof v==='function')return 'function '+(v.name||'anonymous')+'()';if(v===undefined)return 'undefined';if(v&&v.nodeType===1)return '<'+v.tagName.toLowerCase()+(v.id?'#'+v.id:'')+'>';var s=JSON.stringify(v);return s===undefined?String(v):s}catch(e){return String(v)}}
function send(level,args){try{parent.postMessage({source:'warrior-codelab',token:T,level:level,text:Array.prototype.map.call(args,fmt).join(' ').slice(0,4000)},'*')}catch(e){}}
['log','info','warn','error','debug'].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);if(o){try{o.apply(console,arguments)}catch(e){}}}});
addEventListener('error',function(e){send('error',[(e.message||'Error')+(e.lineno?ln(e.lineno):'')])});
addEventListener('unhandledrejection',function(e){send('error',['Uncaught (in promise) '+fmt(e.reason)])});
['localStorage','sessionStorage'].forEach(function(k){try{if(window[k])return}catch(e){}var m=Object.create(null),s={getItem:function(x){x=String(x);return x in m?m[x]:null},setItem:function(x,v){m[String(x)]=String(v)},removeItem:function(x){delete m[String(x)]},clear:function(){m=Object.create(null)},key:function(i){return Object.keys(m)[i]||null}};Object.defineProperty(s,'length',{get:function(){return Object.keys(m).length}});try{Object.defineProperty(window,k,{value:s,configurable:true})}catch(e){}});})();`;
}

/** Keep user code from closing its own <script>/<style> element early. */
function escapeEnd(code: string, tag: 'script' | 'style'): string {
  return code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');
}

/**
 * User JS runs as a plain top-level <script> (no try wrapper) so its
 * const/let/class bindings stay visible to inline handlers like
 * onclick="go()"; uncaught errors reach the shim's 'error' listener.
 */
function buildDoc(s: Snippet, token: string): string {
  const js = escapeEnd(s.js, 'script');
  const head = (shim: string) =>
    `<!DOCTYPE html><html><head><meta charset="utf-8"><script>${shim}<\/script><style>${escapeEnd(s.css, 'style')}</style></head><body>${s.html}<script>\n`;
  // The shim's own newline count doesn't depend on the numbers, so measure with a stand-in.
  const offset = head(consoleShim(token, 0, 0)).split('\n').length - 1;
  return `${head(consoleShim(token, offset, js.split('\n').length))}${js}\n<\/script></body></html>`;
}

function makeToken(): string {
  return `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// ─── Editor: textarea over a highlighted layer ───

interface CodeEditorProps {
  value: string;
  lang: Lang;
  label: string;
  cursorLine: number;
  onChange: (value: string) => void;
  onRun: () => void;
  onCursor: (line: number, col: number) => void;
}

function CodeEditor({ value, lang, label, cursorLine, onChange, onRun, onCursor }: CodeEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const escapedRef = useRef(false);
  const highlighted = useMemo(() => highlight(value, lang), [value, lang]);
  const lineCount = useMemo(() => value.split('\n').length, [value]);

  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (layerRef.current) layerRef.current.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`;
  };

  const reportCursor = () => {
    const ta = taRef.current;
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const lineStart = before.lastIndexOf('\n') + 1;
    onCursor(before.split('\n').length, ta.selectionStart - lineStart + 1);
  };

  /** Insert text at the selection, keeping the browser's undo stack when possible. */
  const insert = (text: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
    if (!ok) {
      const { selectionStart: a, selectionEnd: b } = ta;
      onChange(ta.value.slice(0, a) + text + ta.value.slice(b));
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = a + text.length;
      });
    }
  };

  const outdent = () => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
    const lead = /^ {1,2}|^\t/.exec(ta.value.slice(lineStart))?.[0];
    if (!lead) return;
    ta.setSelectionRange(lineStart, lineStart + lead.length);
    const ok = typeof document.execCommand === 'function' && document.execCommand('delete');
    if (!ok) onChange(ta.value.slice(0, lineStart) + ta.value.slice(lineStart + lead.length));
    const caret = Math.max(lineStart, start - lead.length);
    requestAnimationFrame(() => ta.setSelectionRange(caret, caret));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun();
      return;
    }
    if (e.key === 'Escape') {
      escapedRef.current = true;
      return;
    }
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Esc, then Tab: leave the editor (no keyboard trap).
      if (escapedRef.current) {
        escapedRef.current = false;
        return;
      }
      e.preventDefault();
      if (e.shiftKey) outdent();
      else insert('  ');
      return;
    }
    escapedRef.current = false;
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.nativeEvent.isComposing) {
      const ta = e.currentTarget;
      const before = ta.value.slice(0, ta.selectionStart);
      const line = before.slice(before.lastIndexOf('\n') + 1);
      const indent = /^[ \t]*/.exec(line)?.[0] ?? '';
      const extra = /[{([]\s*$/.test(line) ? '  ' : '';
      if (indent || extra) {
        e.preventDefault();
        insert(`\n${indent}${extra}`);
      }
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-steel-950 font-mono text-ui leading-5 [font-variant-ligatures:none] [tab-size:2]">
      {/* Gutter */}
      <div aria-hidden className="brushed relative w-11 shrink-0 select-none overflow-hidden bg-steel-850 shadow-[inset_-1px_0_0_rgb(0_0_0/0.7),1px_0_0_rgb(255_255_255/0.04)]">
        <div ref={gutterRef} className="py-3 pr-2.5 text-right text-xs leading-5 text-fg-faint tabular">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className={cn(i + 1 === cursorLine && 'text-ember-300')}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Code */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div ref={layerRef} aria-hidden className="pointer-events-none absolute left-0 top-0 min-w-full">
          <div
            className="absolute inset-x-0 h-5 bg-ember-500/[0.06] shadow-[inset_2px_0_0_var(--color-ember-500)]"
            style={{ top: `calc(0.75rem + ${(cursorLine - 1) * 1.25}rem)` }}
          />
          <pre className="relative m-0 whitespace-pre px-4 py-3 text-fg">
            {highlighted}
            {'\n'}
          </pre>
        </div>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          onSelect={reportCursor}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label={`${label} editor`}
          className="scrollbar-thin absolute inset-0 size-full resize-none overflow-auto whitespace-pre bg-transparent px-4 py-3 text-transparent caret-ember-300 outline-none selection:bg-ember-500/30 selection:text-transparent focus-visible:outline-none"
        />
      </div>
    </div>
  );
}

// ─── Pane chrome ───

function PaneHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'brushed relative flex h-9 shrink-0 items-center gap-2 bg-steel-800 pl-3 pr-1.5',
        'shadow-[inset_0_1px_0_rgb(255_255_255/0.07),inset_0_-1px_0_rgb(0_0_0/0.65)]',
        className
      )}
    >
      {children}
    </div>
  );
}

const LOG_STYLE: Record<LogLevel, { row: string; icon: ReactNode }> = {
  log: { row: 'text-fg-muted', icon: <ChevronRight size={12} strokeWidth={2} className="text-fg-faint" aria-hidden /> },
  debug: { row: 'text-fg-subtle', icon: <ChevronRight size={12} strokeWidth={2} className="text-fg-faint" aria-hidden /> },
  info: { row: 'text-info', icon: <Info size={12} strokeWidth={2} aria-hidden /> },
  warn: { row: 'bg-warning/6 text-warning', icon: <TriangleAlert size={12} strokeWidth={2} aria-hidden /> },
  error: { row: 'bg-danger/8 text-danger', icon: <CircleAlert size={12} strokeWidth={2} aria-hidden /> },
};

// ─── App ───

function CodeLabAppInner() {
  const [snippet, setSnippet] = useState<Snippet>(loadSnippet);
  const [active, setActive] = useState<Lang>('html');
  const [autoRun, setAutoRun] = useState(true);
  const [layout, setLayoutState] = useState<Layout>(loadLayout);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);
  // Initial run: build the preview from the saved snippet on first render.
  const [doc, setDoc] = useState(() => {
    const token = makeToken();
    return { token, html: buildDoc(snippet, token), at: Date.now() };
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef(doc.token);
  const builtRef = useRef<Snippet>(snippet);
  const logIdRef = useRef(1);
  const consoleRef = useRef<HTMLDivElement>(null);

  const runSnippet = useCallback((s: Snippet) => {
    const token = makeToken();
    tokenRef.current = token;
    builtRef.current = s;
    setLogs([]);
    setDoc({ token, html: buildDoc(s, token), at: Date.now() });
  }, []);

  const run = useCallback(() => runSnippet(snippet), [runSnippet, snippet]);

  // Save on every change; debounced auto-run.
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(snippet));
    } catch {
      /* storage full or blocked: the preview still works */
    }
    if (!autoRun || snippet === builtRef.current) return;
    const t = setTimeout(() => runSnippet(snippet), 600);
    return () => clearTimeout(t);
  }, [snippet, autoRun, runSnippet]);

  // Console bridge: messages from the current preview run only.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { source?: unknown; token?: unknown; level?: unknown; text?: unknown } | null;
      if (!data || typeof data !== 'object' || data.source !== 'warrior-codelab') return;
      if (data.token !== tokenRef.current) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      const level: LogLevel =
        data.level === 'info' || data.level === 'warn' || data.level === 'error' || data.level === 'debug'
          ? data.level
          : 'log';
      const text = typeof data.text === 'string' ? data.text : String(data.text ?? '');
      setLogs((prev) => {
        const next = [...prev, { id: logIdRef.current++, level, text, at: Date.now() }];
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Keep the newest console line in view.
  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length, consoleOpen]);

  const setCode = useCallback((lang: Lang, value: string) => {
    setSnippet((s) => ({ ...s, [lang]: value }));
  }, []);

  const setLayout = useCallback((next: Layout) => {
    setLayoutState(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(() => {
    setSnippet(DEFAULT_SNIPPET);
    setConfirmReset(false);
  }, []);

  const file = FILES.find((f) => f.lang === active) ?? FILES[0];
  const code = snippet[active];
  const lineCount = code.split('\n').length;
  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;
  const showEditor = layout !== 'preview';
  const showPreview = layout !== 'editor';

  return (
    <div className="@container flex h-full min-h-0 flex-col bg-steel-900 text-fg">
      {/* ── Toolbar ── */}
      <Toolbar aria-label="Code Lab" className="brushed bg-steel-850">
        <SegmentedControl<Lang>
          size="sm"
          aria-label="File"
          value={active}
          onChange={(lang) => {
            setActive(lang);
            setCursor({ line: 1, col: 1 });
          }}
          options={FILES.map((f) => ({
            value: f.lang,
            label: (
              <span className="flex items-center gap-1.5">
                <span className={cn('size-1.5 shrink-0 rotate-45', f.dot)} aria-hidden />
                <span className="hidden font-mono @3xl:inline">{f.file}</span>
                <span className="@3xl:hidden">{f.label}</span>
              </span>
            ),
          }))}
        />
        <ToolbarSpacer />
        <SegmentedControl<Layout>
          size="sm"
          aria-label="Layout"
          value={layout}
          onChange={setLayout}
          options={[
            { value: 'split', icon: Columns2, 'aria-label': 'Side by side' },
            { value: 'stack', icon: Rows2, 'aria-label': 'Stacked' },
            { value: 'editor', icon: Code2, 'aria-label': 'Editor only' },
            { value: 'preview', icon: Eye, 'aria-label': 'Preview only' },
          ]}
        />
        <ToolbarSeparator />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
          <Switch size="sm" checked={autoRun} onCheckedChange={setAutoRun} aria-label="Auto-run" />
          <span className="hidden @2xl:inline">Auto-run</span>
        </label>
        <IconButton icon={RotateCcw} size="sm" onClick={() => setConfirmReset(true)} aria-label="Reset to starter code" tooltip />
        <Tooltip content="Run" shortcut="Ctrl ↵">
          <Button variant="primary" size="sm" leadingIcon={Play} onClick={run}>
            Run
          </Button>
        </Tooltip>
      </Toolbar>

      {/* ── Panes ── */}
      <div className={cn('flex min-h-0 flex-1', layout === 'stack' ? 'flex-col' : 'flex-row')}>
        {showEditor && (
          <section
            aria-label="Editor"
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col',
              showPreview &&
                (layout === 'stack'
                  ? 'shadow-[inset_0_-1px_0_rgb(0_0_0/0.8),0_1px_0_rgb(255_255_255/0.05)]'
                  : 'shadow-[inset_-1px_0_0_rgb(0_0_0/0.8),1px_0_0_rgb(255_255_255/0.05)]')
            )}
          >
            <PaneHeader>
              <span className="notch -ml-3 flex h-full items-center gap-2 bg-steel-700 px-3.5 shadow-[inset_0_-2px_0_var(--color-ember-500)] [--notch:5px]">
                <span className={cn('size-2 shrink-0 rotate-45', file.dot)} aria-hidden />
                <span className="truncate font-mono text-xs text-fg">{file.file}</span>
              </span>
              <span className={ENGRAVED_LABEL}>{file.label}</span>
              <span className="flex-1" />
              <span className="pr-1.5 font-mono text-2xs text-fg-subtle tabular">
                Ln {cursor.line}, Col {cursor.col}
              </span>
            </PaneHeader>
            <CodeEditor
              key={active}
              value={code}
              lang={active}
              label={file.label}
              cursorLine={cursor.line}
              onChange={(value) => setCode(active, value)}
              onRun={run}
              onCursor={(line, col) => setCursor({ line, col })}
            />
          </section>
        )}

        <section
          aria-label="Preview"
          className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !showPreview && 'hidden')}
        >
          <PaneHeader>
            <span className="relative flex size-2 shrink-0" aria-hidden>
              {autoRun && <span className="absolute inset-0 rounded-full bg-success opacity-50 motion-safe:animate-ping" />}
              <span className={cn('relative size-2 rounded-full', autoRun ? 'bg-success' : 'bg-fg-subtle')} />
            </span>
            <span className={ENGRAVED_LABEL}>Preview</span>
            <span className="truncate font-mono text-2xs text-fg-subtle tabular">
              {autoRun ? 'Live' : 'Manual'} · ran {clockTime(doc.at)}
            </span>
            <span className="flex-1" />
            <IconButton icon={RotateCw} size="xs" iconSize={13} onClick={run} aria-label="Reload preview" tooltip />
          </PaneHeader>
          <div className="relative min-h-0 flex-1 bg-steel-950">
            <iframe
              ref={iframeRef}
              title="Code Lab Preview"
              srcDoc={doc.html}
              sandbox="allow-scripts"
              className="absolute inset-0 size-full border-0"
            />
          </div>

          {/* Console */}
          <div className={cn('flex shrink-0 flex-col bg-steel-900 shadow-[0_-1px_0_rgb(0_0_0/0.8)]', consoleOpen && 'h-40')}>
            <PaneHeader>
              <button
                type="button"
                onClick={() => setConsoleOpen((open) => !open)}
                aria-expanded={consoleOpen}
                className="focus-ring-inset chamfer-xs -ml-1.5 flex h-7 items-center gap-1.5 px-1.5 text-fg-muted transition-colors duration-120 hover:bg-steel-700 hover:text-ember-200"
              >
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  className={cn('transition-transform duration-180 ease-out-quint', !consoleOpen && '-rotate-90')}
                  aria-hidden
                />
                <SquareTerminal size={14} strokeWidth={1.75} aria-hidden />
                <span className={ENGRAVED_LABEL}>Console</span>
              </button>
              {errorCount > 0 && (
                <Badge tone="danger" size="sm">
                  {errorCount} {errorCount === 1 ? 'error' : 'errors'}
                </Badge>
              )}
              {warnCount > 0 && (
                <Badge tone="warning" size="sm">
                  {warnCount} {warnCount === 1 ? 'warning' : 'warnings'}
                </Badge>
              )}
              {logs.length > 0 && errorCount === 0 && warnCount === 0 && (
                <span className="font-mono text-2xs text-fg-subtle tabular">{logs.length}</span>
              )}
              <span className="flex-1" />
              <IconButton
                icon={Trash2}
                size="xs"
                iconSize={13}
                onClick={() => setLogs([])}
                disabled={logs.length === 0}
                aria-label="Clear console"
                tooltip
              />
            </PaneHeader>
            {consoleOpen && (
              <div
                ref={consoleRef}
                className="scrollbar-thin min-h-0 flex-1 select-text overflow-y-auto"
                role="log"
                aria-label="Console output"
              >
                {logs.length === 0 ? (
                  <p className="flex items-center gap-2 px-3 py-3 text-xs text-fg-subtle">
                    <CircleCheck size={14} strokeWidth={1.75} className="text-fg-faint" aria-hidden />
                    No output yet. <span className="font-mono text-fg-muted">console.log()</span> from your script shows
                    up here.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {logs.map((entry) => {
                      const style = LOG_STYLE[entry.level];
                      return (
                        <li key={entry.id} className={cn('flex items-start gap-2 px-3 py-1 font-mono text-xs leading-5', style.row)}>
                          <span className="flex h-5 shrink-0 items-center">{style.icon}</span>
                          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{entry.text}</span>
                          <time className="shrink-0 text-2xs text-fg-subtle tabular">{clockTime(entry.at)}</time>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Status bar ── */}
      <div className="brushed flex h-7 shrink-0 items-center gap-3 bg-steel-850 px-3 font-mono text-2xs text-fg-subtle shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_-1px_0_rgb(0_0_0/0.7)]">
        <span className="flex items-center gap-1.5">
          <span className={cn('size-1.5 rotate-45', file.dot)} aria-hidden />
          {file.label}
        </span>
        <span className="tabular">
          {lineCount} {lineCount === 1 ? 'line' : 'lines'} · {code.length} chars
        </span>
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-danger">
            <CircleAlert size={12} strokeWidth={2} aria-hidden />
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </span>
        )}
        <span className="flex-1" />
        <span className="hidden @2xl:inline">Esc then Tab leaves the editor</span>
        <span className="flex items-center gap-1 text-fg-muted">
          <CircleCheck size={12} strokeWidth={2} className="text-success" aria-hidden />
          Saved locally
        </span>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={reset}
        tone="danger"
        title="Reset to the starter code?"
        description="Your HTML, CSS and JS are replaced with the starter snippet. This can't be undone."
        confirmLabel="Reset code"
      />
    </div>
  );
}

export const CodeLabApp = memo(CodeLabAppInner);
