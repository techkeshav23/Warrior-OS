// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Calculator App
// Scientific calculator with keyboard support + history
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';

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

function CalculatorAppInner() {
  const [display, setDisplay] = useState('0');
  const [previous, setPrevious] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [waiting, setWaiting] = useState(false); // waiting for next operand
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [deg, setDeg] = useState(true); // degrees vs radians for trig

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
    setHistory((h) => [{ expr: `${fmt(previous)} ${op} ${fmt(current)}`, result: resStr }, ...h].slice(0, MAX_HISTORY));
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
    setHistory((h) => [{ expr: `${label}(${fmt(current)})`, result: resStr }, ...h].slice(0, MAX_HISTORY));
    setDisplay(resStr);
    setWaiting(true);
  }, [display]);

  const insertConst = useCallback((val: number) => {
    setDisplay(fmt(val));
    setWaiting(false);
  }, []);

  const toRad = useCallback((x: number) => (deg ? (x * Math.PI) / 180 : x), [deg]);

  // ─── Keyboard support ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key;
      if (/[0-9]/.test(k)) { inputDigit(k); }
      else if (k === '.') inputDot();
      else if (k === '+') chooseOp('+');
      else if (k === '-') chooseOp('-');
      else if (k === '*') chooseOp('×');
      else if (k === '/') { e.preventDefault(); chooseOp('÷'); }
      else if (k === '^') chooseOp('^');
      else if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); }
      else if (k === 'Backspace') backspace();
      else if (k === 'Escape') clearAll();
      else if (k === '%') applyFn('%', (x) => x / 100);
      else return;
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputDigit, inputDot, chooseOp, equals, backspace, clearAll, applyFn]);

  const sciButtons: { label: string; fn: () => void; cls?: string }[] = [
    { label: deg ? 'DEG' : 'RAD', fn: () => setDeg((d) => !d), cls: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
    { label: 'sin', fn: () => applyFn('sin', (x) => Math.sin(toRad(x))) },
    { label: 'cos', fn: () => applyFn('cos', (x) => Math.cos(toRad(x))) },
    { label: 'tan', fn: () => applyFn('tan', (x) => Math.tan(toRad(x))) },
    { label: 'ln', fn: () => applyFn('ln', Math.log) },
    { label: 'log', fn: () => applyFn('log', Math.log10) },
    { label: '√', fn: () => applyFn('√', Math.sqrt) },
    { label: 'x²', fn: () => applyFn('sqr', (x) => x * x) },
    { label: 'xʸ', fn: () => chooseOp('^'), cls: 'text-cyan-300' },
    { label: '1/x', fn: () => applyFn('1/', (x) => 1 / x) },
    { label: 'n!', fn: () => applyFn('fact', factorial) },
    { label: '%', fn: () => applyFn('%', (x) => x / 100) },
    { label: 'π', fn: () => insertConst(Math.PI) },
    { label: 'e', fn: () => insertConst(Math.E) },
  ];

  const padBtn = (label: string, onClick: () => void, cls = '', active = false) => (
    <button
      key={label}
      onClick={onClick}
      className={cn(
        'rounded-lg py-3 text-base font-medium transition-all border border-white/10',
        'bg-white/5 text-white/80 hover:bg-white/10 active:scale-95',
        active && 'ring-1 ring-cyan-400/60 bg-cyan-500/15 text-cyan-200',
        cls
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full bg-black/40">
      {/* ─── Main calculator ─── */}
      <div className="flex flex-col flex-1 p-3 gap-3 min-w-0">
        {/* Display */}
        <div className="rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-right">
          <div className="text-[11px] font-mono text-white/30 h-4 truncate">
            {previous !== null && op ? `${fmt(previous)} ${op}` : ' '}
          </div>
          <div className="text-3xl font-mono text-white truncate tabular-nums">{display}</div>
        </div>

        {/* Scientific row */}
        <div className="grid grid-cols-7 gap-1.5">
          {sciButtons.map((b) => padBtn(b.label, b.fn, cn('py-2 text-xs', b.cls)))}
        </div>

        {/* Number pad */}
        <div className="grid grid-cols-4 gap-1.5 flex-1">
          {padBtn('AC', clearAll, 'text-red-300 bg-red-500/10 border-red-500/20')}
          {padBtn('±', toggleSign)}
          {padBtn('⌫', backspace)}
          {padBtn('÷', () => chooseOp('÷'), 'text-cyan-300 bg-cyan-500/10', op === '÷')}

          {padBtn('7', () => inputDigit('7'))}
          {padBtn('8', () => inputDigit('8'))}
          {padBtn('9', () => inputDigit('9'))}
          {padBtn('×', () => chooseOp('×'), 'text-cyan-300 bg-cyan-500/10', op === '×')}

          {padBtn('4', () => inputDigit('4'))}
          {padBtn('5', () => inputDigit('5'))}
          {padBtn('6', () => inputDigit('6'))}
          {padBtn('−', () => chooseOp('-'), 'text-cyan-300 bg-cyan-500/10', op === '-')}

          {padBtn('1', () => inputDigit('1'))}
          {padBtn('2', () => inputDigit('2'))}
          {padBtn('3', () => inputDigit('3'))}
          {padBtn('+', () => chooseOp('+'), 'text-cyan-300 bg-cyan-500/10', op === '+')}

          {padBtn('0', () => inputDigit('0'), 'col-span-2')}
          {padBtn('.', inputDot)}
          {padBtn('=', equals, 'text-black bg-cyan-400 hover:bg-cyan-300 border-cyan-400 font-bold')}
        </div>
      </div>

      {/* ─── History sidebar ─── */}
      <div className="w-40 shrink-0 border-l border-white/10 bg-black/20 flex flex-col">
        <div className="px-3 py-2 flex items-center justify-between border-b border-white/10">
          <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">History</span>
          {history.length > 0 && (
            <button onClick={() => setHistory([])} className="text-[10px] text-red-400/60 hover:text-red-400">
              clear
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {history.length === 0 && (
            <p className="text-[10px] text-white/25 text-center mt-4">No calculations yet</p>
          )}
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => { setDisplay(h.result); setWaiting(true); }}
              className="w-full text-right rounded px-2 py-1.5 hover:bg-white/5 transition-colors"
            >
              <div className="text-[10px] font-mono text-white/35 truncate">{h.expr}</div>
              <div className="text-xs font-mono text-cyan-300/90 truncate">= {h.result}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const CalculatorApp = memo(CalculatorAppInner);
