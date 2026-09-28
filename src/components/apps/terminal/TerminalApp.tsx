// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Terminal App
// In-browser terminal emulator with custom commands. FORGE HUD
// theme: ink well, 13px JetBrains Mono, plasma prompt, command
// "blocks" (prompt + output, failed blocks marked in danger), ember
// warnings, gold XP rewards. History (↑/↓), fish-style suggestions
// (→ accepts), Tab completion, Ctrl+L clear, quick-start chips.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronRight, Eraser, Sparkles, SquareTerminal, Trophy } from 'lucide-react';
import { Badge, IconButton, Kbd } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { COMMANDS } from './commands';
import { EASTER_EGGS } from './easter-eggs';
import { discoverEasterEgg, recordTerminalCommand } from './terminal-achievements';

type LineType =
  | 'input'
  | 'output'
  | 'error'
  | 'success'
  | 'warning'
  | 'info'
  | 'ascii'
  /** The designed welcome banner (content = plain-text fallback). */
  | 'welcome'
  /** XP reward line (easter-egg discovery). */
  | 'xp'
  /** Achievement unlocked line. */
  | 'achievement';

interface TerminalLine {
  id: number;
  type: LineType;
  content: string;
  /** Input lines: when the command ran (epoch ms). */
  at?: number;
  /** XP lines: the amount earned. */
  xp?: number;
}

const PROMPT = 'warrior@os:~$';

const WELCOME = `Welcome to Warrior Terminal v1.0
Type 'help' for available commands.`;

/** One-click starters shown in the welcome banner. */
const QUICK_COMMANDS = ['help', 'neofetch', 'decks', 'stats', 'quote'];

/** Tab completion covers the listed commands only: secret eggs stay secret. */
const COMPLETIONS = Array.from(
  new Set([...Object.keys(COMMANDS), 'clear', 'history', 'xp', 'matrix', 'cowsay', 'hack', 'motivate', 'warrior'])
).sort();

const LINE_COLOR: Partial<Record<LineType, string>> = {
  output: 'text-fg-muted',
  info: 'text-fg-muted',
  success: 'text-success',
  warning: 'text-ember-400',
  error: 'text-danger',
  ascii: 'text-plasma-300',
};

/** Own-property lookup, so names like "constructor" aren't treated as commands. */
function lookup<T>(table: Record<string, T>, name: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, name) ? table[name] : undefined;
}

function longestCommonPrefix(words: string[]): string {
  if (words.length === 0) return '';
  let prefix = words[0];
  for (const word of words.slice(1)) {
    while (!word.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

/**
 * Fish-style suggestion: the rest of the newest history entry extending
 * the input, else of the first command name it prefixes.
 */
function suggestFor(input: string, history: string[], historyIndex: number): string {
  if (!input || historyIndex !== -1) return '';
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.length > input.length && h.startsWith(input)) return h.slice(input.length);
  }
  if (/\s/.test(input)) return '';
  const lower = input.toLowerCase();
  const match = COMPLETIONS.find((c) => c.startsWith(lower) && c.length > lower.length);
  return match ? match.slice(lower.length) : '';
}

function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// ─── Pieces ───

function Prompt({ className }: { className?: string }) {
  return (
    <span className={cn('shrink-0 whitespace-nowrap', className)}>
      <span className="text-plasma-400">warrior@os</span>
      <span className="text-fg-subtle">:</span>
      <span className="text-info">~</span>
      <span className="text-fg-subtle">$</span>
    </span>
  );
}

/** `help` output: command names in plasma, descriptions muted. */
function HelpText({ content }: { content: string }) {
  const rows = content.split('\n');
  return (
    <div className="text-fg-muted">
      {rows.map((row, i) => {
        const m = /^(\s{2})(\S.*?)(\s+— .*)$/.exec(row);
        if (m) {
          return (
            <div key={i} className="whitespace-pre-wrap break-words">
              {m[1]}
              <span className="text-plasma-300">{m[2]}</span>
              <span>{m[3]}</span>
            </div>
          );
        }
        if (i === 0) {
          return (
            <div key={i} className="whitespace-pre-wrap text-fg">
              {row}
            </div>
          );
        }
        return (
          <div key={i} className="whitespace-pre-wrap break-words text-fg-subtle">
            {row || ' '}
          </div>
        );
      })}
    </div>
  );
}

function WelcomeBanner({ onRun }: { onRun: (command: string) => void }) {
  return (
    <div className="flex items-start gap-3.5 py-1 font-sans">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-card border border-line-strong bg-ink-800 text-plasma-400 shadow-[0_0_20px_-8px_var(--color-plasma-400)] inset-shadow-[0_1px_0_rgb(255_255_255/0.06)]">
        <SquareTerminal size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-fg">Warrior Terminal</span>
          <span className="font-mono text-2xs text-fg-subtle">v1.0 · warrior-bash</span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-fg-muted">
          <span>
            Type <span className="font-mono text-plasma-300">help</span> to see every command.
          </span>
          <span className="flex items-center gap-1 text-fg-subtle">
            <Kbd size="sm">↑</Kbd>
            <Kbd size="sm">↓</Kbd>
            history
            <span className="text-fg-faint" aria-hidden>
              ·
            </span>
            <Kbd size="sm">Tab</Kbd>
            complete
            <span className="text-fg-faint" aria-hidden>
              ·
            </span>
            <Kbd size="sm" keys={['Ctrl', 'L']} />
            clear
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_COMMANDS.map((command) => (
            <button
              key={command}
              type="button"
              onClick={() => onRun(command)}
              className="focus-ring group/q inline-flex h-6 items-center gap-1 rounded-full border border-line-strong bg-surface-2 pl-1.5 pr-2.5 font-mono text-2xs text-fg-muted transition-[border-color,background-color,color] duration-120 ease-out-quint hover:border-plasma-400/40 hover:bg-surface-hover hover:text-fg"
            >
              <ChevronRight size={12} strokeWidth={2} className="text-plasma-400" aria-hidden />
              {command}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OutputLine({ line, onRun }: { line: TerminalLine; onRun: (command: string) => void }): ReactNode {
  switch (line.type) {
    case 'welcome':
      return <WelcomeBanner onRun={onRun} />;
    case 'xp':
      return (
        <div className="flex items-center gap-2 py-0.5 text-gold">
          <Sparkles size={14} strokeWidth={1.75} aria-hidden />
          <span className="font-sans text-xs font-medium">Easter egg discovered</span>
          <Badge tone="gold" size="sm">
            +{line.xp ?? 0} XP
          </Badge>
        </div>
      );
    case 'achievement':
      return (
        <div className="flex items-center gap-2 py-0.5 text-ember-400">
          <Trophy size={14} strokeWidth={1.75} aria-hidden />
          <span className="font-sans text-xs font-medium">You found a hidden easter egg</span>
          <Badge tone="ember" size="sm">
            Achievement unlocked
          </Badge>
        </div>
      );
    case 'ascii':
      return (
        <pre className="scrollbar-thin overflow-x-auto whitespace-pre leading-[1.2] text-plasma-300">{line.content}</pre>
      );
    default:
      if (line.type === 'info' && line.content.startsWith('Available commands:')) {
        return <HelpText content={line.content} />;
      }
      return (
        <pre className={cn('whitespace-pre-wrap break-words', LINE_COLOR[line.type] ?? 'text-fg-muted')}>
          {line.content}
        </pre>
      );
  }
}

interface Block {
  key: number;
  input?: TerminalLine;
  lines: TerminalLine[];
}

function toBlocks(lines: TerminalLine[]): Block[] {
  const blocks: Block[] = [];
  for (const line of lines) {
    if (line.type === 'input') blocks.push({ key: line.id, input: line, lines: [] });
    else if (blocks.length === 0) blocks.push({ key: line.id, lines: [line] });
    else blocks[blocks.length - 1].lines.push(line);
  }
  return blocks;
}

// ─── Terminal ───

function TerminalAppInner() {
  const [lines, setLines] = useState<TerminalLine[]>([{ id: 0, type: 'welcome', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const execute = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;

      // Add input line
      const inputLine: TerminalLine = {
        id: idRef.current++,
        type: 'input',
        content: `${PROMPT} ${trimmed}`,
        at: Date.now(),
      };

      // Parse command
      const parts = trimmed.split(/\s+/);
      const name = parts[0].toLowerCase();
      const args = parts.slice(1);

      const resultLines: TerminalLine[] = [inputLine];

      if (name === 'clear') {
        recordTerminalCommand();
        setLines([]);
        setInput('');
        setHistory((h) => [...h, trimmed]);
        setHistoryIndex(-1);
        return;
      }

      const command = lookup(COMMANDS, name);
      const egg = lookup(EASTER_EGGS, name);
      let recognized = true;

      if (name === 'history') {
        resultLines.push({
          id: idRef.current++,
          type: 'info',
          content: history.length > 0 ? history.map((h, i) => `  ${i + 1}  ${h}`).join('\n') : '  No history yet.',
        });
      } else if (name === 'xp') {
        const { xp, level, getLevelTitle } = useXPStore.getState();
        resultLines.push({
          id: idRef.current++,
          type: 'success',
          content: `XP: ${xp} | Level: ${level} | Title: ${getLevelTitle()}`,
        });
      } else if (command) {
        try {
          const result = command(args);
          resultLines.push({
            id: idRef.current++,
            type: result.type,
            content: result.output,
          });
        } catch (err) {
          resultLines.push({
            id: idRef.current++,
            type: 'error',
            content: `${name}: ${err instanceof Error ? err.message : 'command failed'}`,
          });
        }
      } else if (egg) {
        const result = egg(args);
        resultLines.push({
          id: idRef.current++,
          type: result.type,
          content: result.output,
        });
        // XP once per egg; secret eggs unlock the hidden-easter-egg achievement.
        const discovery = discoverEasterEgg(result.eggId, result.secret === true);
        if (discovery.xp > 0) {
          resultLines.push({
            id: idRef.current++,
            type: 'xp',
            xp: discovery.xp,
            content: `Easter egg discovered · +${discovery.xp} XP`,
          });
        }
        if (discovery.achievementUnlocked) {
          resultLines.push({
            id: idRef.current++,
            type: 'achievement',
            content: 'You found a hidden easter egg. Achievement unlocked!',
          });
        }
      } else {
        recognized = false;
        resultLines.push({
          id: idRef.current++,
          type: 'error',
          content: `command not found: ${name}. Type 'help' for available commands.`,
        });
      }

      // Terminal Warrior counts recognised commands only.
      if (recognized) recordTerminalCommand();

      setLines((prev) => [...prev, ...resultLines]);
      setHistory((h) => [...h, trimmed]);
      setHistoryIndex(-1);
      setInput('');
    },
    [history]
  );

  const suggestion = suggestFor(input, history, historyIndex);

  const complete = useCallback(() => {
    const value = input.trimStart();
    if (!value || /\s/.test(value)) return;
    const prefix = value.toLowerCase();
    const matches = COMPLETIONS.filter((c) => c.startsWith(prefix));
    if (matches.length === 0) return;
    if (matches.length === 1) {
      setInput(`${matches[0]} `);
      return;
    }
    const common = longestCommonPrefix(matches);
    if (common.length > prefix.length) {
      setInput(common);
      return;
    }
    // Ambiguous: list the candidates, like a real shell.
    setLines((prev) => [
      ...prev,
      { id: idRef.current++, type: 'input', content: `${PROMPT} ${value}`, at: Date.now() },
      { id: idRef.current++, type: 'info', content: matches.join('   ') },
    ]);
  }, [input]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        execute(input);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (history.length > 0) {
          const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex !== -1) {
          const newIndex = historyIndex + 1;
          if (newIndex >= history.length) {
            setHistoryIndex(-1);
            setInput('');
          } else {
            setHistoryIndex(newIndex);
            setInput(history[newIndex]);
          }
        }
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        setLines([]);
      } else if (e.key === 'Tab' && !e.shiftKey && input.trim()) {
        // An empty prompt lets Tab move focus as usual.
        e.preventDefault();
        complete();
      } else if ((e.key === 'ArrowRight' || e.key === 'End') && suggestion) {
        const el = e.currentTarget;
        if (el.selectionStart === input.length && el.selectionEnd === input.length) {
          e.preventDefault();
          setInput(input + suggestion);
        }
      }
    },
    [input, history, historyIndex, execute, complete, suggestion]
  );

  const focusInput = () => {
    // Don't steal focus while the user is selecting output to copy.
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (selection && selection.toString().length > 0) return;
    inputRef.current?.focus();
  };

  const runQuick = useCallback(
    (command: string) => {
      execute(command);
      inputRef.current?.focus();
    },
    [execute]
  );

  const blocks = useMemo(() => toBlocks(lines), [lines]);

  return (
    <div
      className="@container flex h-full min-h-0 cursor-text flex-col bg-ink-900 font-mono text-ui text-fg selection:bg-plasma-400/25 selection:text-fg"
      onClick={focusInput}
    >
      {/* Header */}
      <div className="flex h-9 shrink-0 cursor-default items-center gap-2 border-b border-line bg-ink-950/40 pl-3.5 pr-1.5">
        <SquareTerminal size={14} strokeWidth={1.75} className="shrink-0 text-plasma-400" aria-hidden />
        <span className="truncate text-xs text-fg-muted">
          warrior@os<span className="text-fg-subtle">:</span>
          <span className="text-info">~</span>
        </span>
        <span className="flex-1" />
        {history.length > 0 && (
          <span className="hud-label tabular hidden @sm:inline">
            {history.length} {history.length === 1 ? 'command' : 'commands'}
          </span>
        )}
        <IconButton
          icon={Eraser}
          size="sm"
          iconSize={14}
          onClick={(e) => {
            e.stopPropagation();
            setLines([]);
            inputRef.current?.focus();
          }}
          aria-label="Clear terminal"
          tooltip="Clear"
          shortcut="Ctrl L"
          tooltipSide="bottom"
        />
      </div>

      {/* Output */}
      <div
        ref={scrollerRef}
        role="log"
        aria-label="Terminal output"
        className="scrollbar-thin min-h-0 flex-1 select-text overflow-y-auto px-4 py-3 leading-5"
      >
        {blocks.length === 0 ? (
          <p className="py-1 font-sans text-xs text-fg-subtle">
            Screen cleared. Type <span className="font-mono text-plasma-300">help</span> for commands.
          </p>
        ) : (
          blocks.map((block, i) => {
            const failed = block.lines.some((l) => l.type === 'error');
            return (
              <div key={block.key} className={cn('relative py-2.5', i > 0 && 'border-t border-line')}>
                {block.input && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -left-3 bottom-2.5 top-2.5 w-0.5 rounded-full',
                      failed ? 'bg-danger/70' : 'bg-transparent'
                    )}
                  />
                )}
                {block.input && (
                  <div className="flex items-baseline gap-2">
                    <Prompt />
                    <span className="min-w-0 flex-1 break-all text-fg">
                      {block.input.content.startsWith(PROMPT)
                        ? block.input.content.slice(PROMPT.length).trimStart()
                        : block.input.content}
                    </span>
                    {block.input.at && (
                      <time className="shrink-0 text-2xs text-fg-subtle tabular">{clockTime(block.input.at)}</time>
                    )}
                  </div>
                )}
                {block.lines.length > 0 && (
                  <div className={cn('flex flex-col gap-1', block.input && 'mt-1.5')}>
                    {block.lines.map((line) => (
                      <OutputLine key={line.id} line={line} onRun={runQuick} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-t border-line bg-ink-950/50 px-4 transition-colors duration-120 focus-within:bg-ink-950/70">
        <Prompt />
        <div className="relative h-5 min-w-0 flex-1">
          {suggestion && (
            <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre leading-5 text-fg-faint">
              <span className="invisible">{input}</span>
              {suggestion}
            </span>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="relative h-5 w-full bg-transparent leading-5 text-fg caret-plasma-400 outline-none focus-visible:outline-none"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Terminal command"
          />
        </div>
        {suggestion ? (
          <span className="hidden shrink-0 items-center gap-1 font-sans text-2xs text-fg-subtle @md:flex">
            <Kbd size="sm">→</Kbd> accept
          </span>
        ) : input.trim() ? (
          <span className="hidden shrink-0 items-center gap-1 font-sans text-2xs text-fg-subtle @md:flex">
            <Kbd size="sm">Enter</Kbd> run
          </span>
        ) : null}
      </div>
    </div>
  );
}

export const TerminalApp = memo(TerminalAppInner);
