// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Calculator App
// Scientific calculator with keyboard support + history.
// Cut-steel keypad, operators with an ember face, equals the molten plate;
// the display auto-fits its number. Keys flash when typed. Keyboard
// input only reaches the calculator while its window is focused and
// no text field has focus.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useLayoutEffect, useRef, memo, type ReactNode } from 'react';
import { Delete, History, Trash2, X } from 'lucide-react';
import { EmptyState, IconButton, Kbd } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  BEVEL_PRESSED,
  BEVEL_RAISED,
  BEVEL_SUNK,
  EMBER_PLATE,
  ENGRAVED_LABEL,
  FOCUS_EDGE,
  SLOT_FILL,
  STEEL_PLATE,
  STEEL_PLATE_HOT,
} from '@/components/ui/armor';

type Op = '+' | '-' | '×' | '÷' | '^' | null;

interface HistoryEntry {
  expr: string;
  result: string;
}

const MAX_HISTORY = 12;

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? NaN : a / b;
    case '^': return Math.pow(a, b);
    default: return b;
  }
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity; // overflow guard
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Trim floating point noise, keep readable precision */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(12)));
}

// ─── Presentation helpers (display only; state keeps raw strings) ───

/** 1234567.5 → 1,234,567.5 (plain decimals only; "Error", 1e+21 pass through). */
function groupDigits(value: string): string {
  const m = value.match(/^(-?)(\d+)(\.\d*)?$/);
  if (!m) return value;
  return `${m[1]}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${m[3] ?? ''}`;
}

/** Typographic operators for the expression line and history. */
function prettyExpr(expr: string): string {
  return expr.replace(/(\d|\)) - /g, '$1 − ').replace(/ \^ /g, ' ^ ');
}

const OP_SYMBOL: Record<Exclude<Op, null>, string> = { '+': '+', '-': '−', '×': '×', '÷': '÷', '^': '^' };

// ─── Keys ───

type KeyTone = 'digit' | 'fn' | 'clear' | 'op' | 'op-active' | 'equals' | 'sci' | 'sci-accent';

// Cut-steel keys: bevelled plates that sink when pressed (or flashed by
// the keyboard). Digits are raised steel, functions darker gunmetal,
// operators steel with an ember face and seam, equals the molten plate.
const KEY_BASE =
  'relative flex min-h-0 min-w-0 select-none items-center justify-center chamfer [--cut:6px] font-display ' +
  'transition-[background-color,color,box-shadow,filter,transform] duration-120 ease-out-quint ' +
  FOCUS_EDGE + ' active:translate-y-px data-[flash]:translate-y-px';

/** Sunk look while the keyboard flashes a key (mirrors BEVEL_PRESSED). */
const FLASH_SINK =
  'data-[flash]:shadow-[inset_0_1px_0_rgb(0_0_0/0.55),inset_0_2px_5px_rgb(0_0_0/0.35),inset_0_-1px_0_rgb(255_255_255/0.06)]';

/** Darker gunmetal plate for secondary keys. */
const GUNMETAL = 'bg-linear-to-b from-steel-750 to-steel-850';

const KEY_TONE: Record<KeyTone, string> = {
  digit: cn(STEEL_PLATE, STEEL_PLATE_HOT, BEVEL_RAISED, BEVEL_PRESSED, FLASH_SINK, 'text-xl font-medium hover:text-ember-200'),
  fn: cn(GUNMETAL, BEVEL_RAISED, BEVEL_PRESSED, FLASH_SINK, 'text-lg text-fg-muted hover:from-steel-700 hover:text-fg data-[flash]:text-fg'),
  clear: cn(
    GUNMETAL,
    BEVEL_PRESSED,
    'text-sm font-semibold uppercase tracking-[0.12em] text-danger hover:from-[#3a1319] hover:to-steel-850',
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_-2px_0_rgb(255_84_112/0.55)]',
    FLASH_SINK
  ),
  // Steel with an ember face and a heated bottom seam.
  op: cn(
    GUNMETAL,
    'text-2xl text-accent hover:from-steel-700 hover:text-ember-300',
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_1px_0_0_rgb(255_255_255/0.04),inset_0_-2px_0_var(--color-ember-600),inset_0_-12px_14px_-12px_rgb(247_107_21/0.5)]',
    BEVEL_PRESSED,
    FLASH_SINK
  ),
  'op-active': 'bg-linear-to-b from-ember-800 to-steel-850 text-2xl text-ember-200 ember-edge',
  // The molten plate: hot core on top, deep ember below, white-hot seam.
  equals: cn(
    EMBER_PLATE,
    'text-3xl font-bold hover:brightness-115 hover:saturate-125 active:brightness-95 data-[flash]:brightness-95',
    BEVEL_PRESSED,
    FLASH_SINK
  ),
  sci: cn(
    'bg-linear-to-b from-steel-800 to-steel-900 font-mono text-2xs text-fg-muted',
    BEVEL_RAISED,
    BEVEL_PRESSED,
    FLASH_SINK,
    'hover:from-steel-750 hover:text-fg data-[flash]:text-fg'
  ),
  'sci-accent': cn(
    'bg-linear-to-b from-steel-800 to-steel-900 font-mono text-2xs text-accent',
    BEVEL_RAISED,
    BEVEL_PRESSED,
    FLASH_SINK,
    'hover:from-steel-750 hover:text-ember-300'
  ),
};

interface KeyProps {
  tone: KeyTone;
  onClick: () => void;
  children: ReactNode;
  /** Accessible name when the label is a symbol. */
  label?: string;
  /** Keyboard flash. */
  flash?: boolean;
  pressed?: boolean;
  className?: string;
  title?: string;
}

function Key({ tone, onClick, children, label, flash, pressed, className, title }: KeyProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={title}
      data-flash={flash || undefined}
      className={cn(KEY_BASE, KEY_TONE[tone], 'tabular', className)}
    >
      {children}
    </button>
  );
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ w: el.offsetWidth, h: el.offsetHeight });
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function CalculatorAppInner() {
  const [display, setDisplay] = useState('0');
  const [previous, setPrevious] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [waiting, setWaiting] = useState(false); // waiting for next operand
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [deg, setDeg] = useState(true); // degrees vs radians for trig
  /** The expression behind the result on screen (shown above it). */
  const [lastExpr, setLastExpr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [rootRef, root] = useSize<HTMLDivElement>();
  const [displayRef, displayBox] = useSize<HTMLDivElement>();

  const inputDigit = useCallback((d: string) => {
    setDisplay((prev) => {
      if (waiting || prev === '0' || prev === 'Error') {
        setWaiting(false);
        return d;
      }
      if (prev.replace(/[-.]/g, '').length >= 15) return prev; // length cap
      return prev + d;
    });
    if (waiting) setWaiting(false);
  }, [waiting]);

  const inputDot = useCallback(() => {
    setDisplay((prev) => {
      if (waiting || prev === 'Error') { setWaiting(false); return '0.'; }
      return prev.includes('.') ? prev : prev + '.';
    });
    if (waiting) setWaiting(false);
  }, [waiting]);

  const clearAll = useCallback(() => {
    setDisplay('0');
    setPrevious(null);
    setOp(null);
    setWaiting(false);
  }, []);

  const backspace = useCallback(() => {
    setDisplay((prev) => {
      if (waiting || prev === 'Error') return prev;
      if (prev.length <= 1 || (prev.length === 2 && prev.startsWith('-'))) return '0';
      return prev.slice(0, -1);
    });
  }, [waiting]);

  const toggleSign = useCallback(() => {
    setDisplay((prev) => (prev === '0' || prev === 'Error' ? prev : prev.startsWith('-') ? prev.slice(1) : '-' + prev));
  }, []);

  const chooseOp = useCallback((nextOp: Op) => {
    const current = parseFloat(display);
    if (previous !== null && op && !waiting) {
      const result = compute(previous, current, op);
      const resStr = fmt(result);
      setHistory((h) => [{ expr: `${fmt(previous)} ${op} ${fmt(current)}`, result: resStr }, ...h].slice(0, MAX_HISTORY));
      setDisplay(resStr);
      setPrevious(Number.isFinite(result) ? result : null);
    } else {
      setPrevious(current);
    }
    setOp(nextOp);
    setWaiting(true);
  }, [display, previous, op, waiting]);

  const equals = useCallback(() => {
    if (previous === null || op === null) return;
    const current = parseFloat(display);
    const result = compute(previous, current, op);
    const resStr = fmt(result);
    const expr = `${fmt(previous)} ${op} ${fmt(current)}`;
    setHistory((h) => [{ expr, result: resStr }, ...h].slice(0, MAX_HISTORY));
    setLastExpr(expr);
    setDisplay(resStr);
    setPrevious(null);
    setOp(null);
    setWaiting(true);
  }, [display, previous, op]);

  /** Apply a unary scientific function to the current display value */
  const applyFn = useCallback((label: string, fn: (x: number) => number) => {
    const current = parseFloat(display);
    const result = fn(current);
    const resStr = fmt(result);
    const expr = `${label}(${fmt(current)})`;
    setHistory((h) => [{ expr, result: resStr }, ...h].slice(0, MAX_HISTORY));
    setLastExpr(expr);
    setDisplay(resStr);
    setWaiting(true);
  }, [display]);

  const insertConst = useCallback((val: number) => {
    setDisplay(fmt(val));
    setWaiting(false);
  }, []);

  const toRad = useCallback((x: number) => (deg ? (x * Math.PI) / 180 : x), [deg]);

  const flashKey = useCallback((id: string) => {
    clearTimeout(flashTimer.current);
    setFlash(id);
    flashTimer.current = setTimeout(() => setFlash(null), 120);
  }, []);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // ─── Keyboard support ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      // Typing in another app's field (or this window being in the background) is not calculator input.
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const win = rootRef.current?.closest('[data-window-id]');
      if (win && !win.hasAttribute('data-focused')) return;

      const k = e.key;
      if (/^[0-9]$/.test(k)) { inputDigit(k); flashKey(k); }
      else if (k === '.') { inputDot(); flashKey('.'); }
      else if (k === '+') { chooseOp('+'); flashKey('op+'); }
      else if (k === '-') { chooseOp('-'); flashKey('op-'); }
      else if (k === '*') { chooseOp('×'); flashKey('op×'); }
      else if (k === '/') { e.preventDefault(); chooseOp('÷'); flashKey('op÷'); }
      else if (k === '^') { chooseOp('^'); flashKey('op^'); }
      else if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); flashKey('eq'); }
      else if (k === 'Backspace') { backspace(); flashKey('back'); }
      else if (k === 'Escape') { clearAll(); flashKey('clear'); }
      else if (k === '%') { applyFn('%', (x) => x / 100); flashKey('pct'); }
      else return;
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputDigit, inputDot, chooseOp, equals, backspace, clearAll, applyFn, flashKey, rootRef]);

  const sciButtons: { id: string; label: string; fn: () => void; title: string; accent?: boolean; active?: boolean }[] = [
    { id: 'deg', label: deg ? 'DEG' : 'RAD', fn: () => setDeg((d) => !d), title: deg ? 'Degrees (switch to radians)' : 'Radians (switch to degrees)', accent: true },
    { id: 'sin', label: 'sin', fn: () => applyFn('sin', (x) => Math.sin(toRad(x))), title: 'Sine' },
    { id: 'cos', label: 'cos', fn: () => applyFn('cos', (x) => Math.cos(toRad(x))), title: 'Cosine' },
    { id: 'tan', label: 'tan', fn: () => applyFn('tan', (x) => Math.tan(toRad(x))), title: 'Tangent' },
    { id: 'ln', label: 'ln', fn: () => applyFn('ln', Math.log), title: 'Natural log' },
    { id: 'log', label: 'log', fn: () => applyFn('log', Math.log10), title: 'Log base 10' },
    { id: 'sqrt', label: '√', fn: () => applyFn('√', Math.sqrt), title: 'Square root' },
    { id: 'sqr', label: 'x²', fn: () => applyFn('sqr', (x) => x * x), title: 'Square' },
    { id: 'op^', label: 'xʸ', fn: () => chooseOp('^'), title: 'Power', accent: true, active: op === '^' && waiting },
    { id: 'inv', label: '1/x', fn: () => applyFn('1/', (x) => 1 / x), title: 'Reciprocal' },
    { id: 'fact', label: 'n!', fn: () => applyFn('fact', factorial), title: 'Factorial' },
    { id: 'pct', label: '%', fn: () => applyFn('%', (x) => x / 100), title: 'Percent' },
    { id: 'pi', label: 'π', fn: () => insertConst(Math.PI), title: 'Pi' },
    { id: 'e', label: 'e', fn: () => insertConst(Math.E), title: "Euler's number" },
  ];

  const opKey = (symbol: Exclude<Op, null>, name: string) => (
    <Key
      tone={op === symbol && waiting ? 'op-active' : 'op'}
      onClick={() => chooseOp(symbol)}
      label={name}
      pressed={op === symbol && waiting}
      flash={flash === `op${symbol}`}
    >
      {OP_SYMBOL[symbol]}
    </Key>
  );

  const digitKey = (d: string, className?: string) => (
    <Key tone="digit" onClick={() => (d === '.' ? inputDot() : inputDigit(d))} flash={flash === d} className={className} label={d === '.' ? 'Decimal point' : undefined}>
      {d}
    </Key>
  );

  // ─── Layout by window size ───
  const wide = root.w === 0 || root.w >= 400; // history as a sidebar
  const short = root.h > 0 && root.h < 440;
  const showHistory = wide || historyOpen;

  // ─── Display ───
  const shown = groupDigits(display);
  const isError = display === 'Error';
  const expression =
    previous !== null && op
      ? `${groupDigits(fmt(previous))} ${OP_SYMBOL[op]}`
      : waiting && lastExpr
        ? `${prettyExpr(lastExpr)} =`
        : '';
  // Inter's tabular digits run ~0.62em wide: fit the number to the display.
  const maxPx = short ? 36 : 44;
  const fontPx = displayBox.w
    ? Math.max(14, Math.min(maxPx, Math.floor((displayBox.w - 4) / (Math.max(shown.length, 1) * 0.62))))
    : maxPx;

  const historyPanel = showHistory && (
    <aside
      aria-label="History"
      className={cn(
        'flex w-38 shrink-0 flex-col border-l border-line',
        wide ? 'brushed bg-steel-900/60' : 'armor-popover absolute inset-y-0 right-0 z-10 animate-fade-in [--cut:0px]'
      )}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line pl-3.5 pr-1.5">
        <span className={ENGRAVED_LABEL}>History</span>
        <span className="flex items-center">
          {history.length > 0 && (
            <IconButton icon={Trash2} aria-label="Clear history" variant="ghost-danger" size="xs" tooltip tooltipSide="bottom" onClick={() => setHistory([])} />
          )}
          {!wide && <IconButton icon={X} aria-label="Close history" size="xs" onClick={() => setHistoryOpen(false)} />}
        </span>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5">
        {history.length === 0 ? (
          <EmptyState size="sm" grid={false} icon={History} title="No history" description="Results land here." className="px-2 py-8" />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {history.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    setDisplay(h.result);
                    setLastExpr(h.expr);
                    setWaiting(true);
                  }}
                  title={`${prettyExpr(h.expr)} = ${h.result}`}
                  className={cn(
                    'focus-ring-inset chamfer-xs flex w-full flex-col items-end gap-0.5 px-2.5 py-1.5 text-right',
                    'transition-colors duration-120 ease-out-quint hover:bg-steel-750 active:bg-steel-700',
                    i === 0 && 'bevel bg-steel-800'
                  )}
                >
                  <span className="tabular w-full truncate font-mono text-2xs text-fg-subtle">{prettyExpr(h.expr)}</span>
                  <span className={cn('tabular w-full truncate font-mono text-ui', h.result === 'Error' ? 'text-danger' : 'text-fg')}>
                    = {groupDigits(h.result)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!short && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-3 py-2 text-2xs text-fg-subtle">
          <span className="flex items-center gap-1">
            <Kbd size="sm">Enter</Kbd> =
          </span>
          <span className="flex items-center gap-1">
            <Kbd size="sm">Esc</Kbd> clear
          </span>
        </div>
      )}
    </aside>
  );

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 bg-steel-950/30">
      {/* ─── Main calculator ─── */}
      <div className={cn('flex min-w-0 flex-1 flex-col p-3', short ? 'gap-2' : 'gap-2.5')}>
        {/* Display */}
        <div
          className={cn(
            'chamfer-md relative flex shrink-0 flex-col justify-end px-4',
            SLOT_FILL,
            BEVEL_SUNK,
            short ? 'min-h-19 pb-2 pt-2' : 'min-h-24 pb-3 pt-2.5'
          )}
        >
          <div className="flex h-5 items-center justify-between gap-2">
            <span className={ENGRAVED_LABEL}>
              {deg ? 'Deg' : 'Rad'}
              <span aria-hidden className="ml-2 inline-block h-1.5 w-1.5 bg-ember-500 align-middle shadow-[0_0_6px_var(--color-ember-500)]" />
            </span>
            {!wide && (
              <IconButton
                icon={History}
                aria-label={historyOpen ? 'Hide history' : 'Show history'}
                size="xs"
                active={historyOpen}
                onClick={() => setHistoryOpen((o) => !o)}
              />
            )}
          </div>
          <div className="tabular mt-1 h-4 truncate text-right font-mono text-xs text-fg-subtle" title={expression || undefined}>
            {expression || ' '}
          </div>
          <div ref={displayRef} className="mt-1 flex min-w-0 justify-end">
            <output
              aria-live="polite"
              aria-label="Result"
              title={shown}
              className={cn(
                'tabular block max-w-full truncate font-display font-medium leading-tight tracking-tight',
                isError ? 'text-danger' : 'text-fg [text-shadow:0_0_18px_rgb(255_138_61/0.18)]'
              )}
              style={{ fontSize: fontPx }}
            >
              {shown}
            </output>
          </div>
        </div>

        {/* Scientific rows */}
        <div className="grid shrink-0 grid-cols-7 gap-1" role="group" aria-label="Scientific functions">
          {sciButtons.map((b) => (
            <Key
              key={b.id}
              tone={b.active ? 'op-active' : b.accent ? 'sci-accent' : 'sci'}
              onClick={b.fn}
              title={b.title}
              label={b.title}
              pressed={b.id === 'op^' ? !!b.active : undefined}
              flash={flash === b.id}
              className={cn(short ? 'h-6' : 'h-7', b.active && 'font-mono text-2xs')}
            >
              {b.label}
            </Key>
          ))}
        </div>

        {/* Number pad */}
        <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-5 gap-1.5" role="group" aria-label="Keypad">
          <Key tone="clear" onClick={clearAll} label="All clear" flash={flash === 'clear'}>
            AC
          </Key>
          <Key tone="fn" onClick={toggleSign} label="Toggle sign">
            ±
          </Key>
          <Key tone="fn" onClick={backspace} label="Backspace" flash={flash === 'back'}>
            <Delete size={20} strokeWidth={1.75} aria-hidden />
          </Key>
          {opKey('÷', 'Divide')}

          {digitKey('7')}
          {digitKey('8')}
          {digitKey('9')}
          {opKey('×', 'Multiply')}

          {digitKey('4')}
          {digitKey('5')}
          {digitKey('6')}
          {opKey('-', 'Subtract')}

          {digitKey('1')}
          {digitKey('2')}
          {digitKey('3')}
          {opKey('+', 'Add')}

          {digitKey('0', 'col-span-2')}
          {digitKey('.')}
          <Key tone="equals" onClick={equals} label="Equals" flash={flash === 'eq'}>
            =
          </Key>
        </div>
      </div>

      {/* ─── History ─── */}
      {historyPanel}
    </div>
  );
}

export const CalculatorApp = memo(CalculatorAppInner);
