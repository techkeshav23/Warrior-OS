// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Terminal App
// In-browser terminal emulator with custom commands
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { COMMANDS } from './commands';
import { EASTER_EGGS } from './easter-eggs';

interface TerminalLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'success' | 'warning' | 'info' | 'ascii';
  content: string;
}

const WELCOME = `Welcome to Warrior Terminal v1.0
Type 'help' for available commands.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

function TerminalAppInner() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: 'info', content: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);
  const addXP = useXPStore((s) => s.addXP);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        content: `warrior@os:~$ ${trimmed}`,
      };

      // Parse command
      const parts = trimmed.split(/\s+/);
      const name = parts[0].toLowerCase();
      const args = parts.slice(1);

      const resultLines: TerminalLine[] = [inputLine];

      if (name === 'clear') {
        setLines([]);
        setInput('');
        setHistory((h) => [...h, trimmed]);
        setHistoryIndex(-1);
        return;
      }

      if (name === 'history') {
        resultLines.push({
          id: idRef.current++,
          type: 'info',
          content: history.length > 0
            ? history.map((h, i) => `  ${i + 1}  ${h}`).join('\n')
            : '  No history yet.',
        });
      } else if (name === 'xp') {
        const { xp, level, getLevelTitle } = useXPStore.getState();
        resultLines.push({
          id: idRef.current++,
          type: 'success',
          content: `XP: ${xp} | Level: ${level} | Title: ${getLevelTitle()}`,
        });
      } else if (COMMANDS[name]) {
        const result = COMMANDS[name](args);
        resultLines.push({
          id: idRef.current++,
          type: result.type,
          content: result.output,
        });
      } else if (EASTER_EGGS[name]) {
        const result = EASTER_EGGS[name](args);
        resultLines.push({
          id: idRef.current++,
          type: result.type,
          content: result.output,
        });
        addXP(5, 'easter-egg');
      } else {
        resultLines.push({
          id: idRef.current++,
          type: 'error',
          content: `command not found: ${name}. Type 'help' for available commands.`,
        });
      }

      setLines((prev) => [...prev, ...resultLines]);
      setHistory((h) => [...h, trimmed]);
      setHistoryIndex(-1);
      setInput('');
    },
    [history, addXP]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
      }
    },
    [input, history, historyIndex, execute]
  );

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return 'text-cyan-300';
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'ascii': return 'text-cyan-300/70';
      default: return 'text-white/70';
    }
  };

  return (
    <div
      className="h-full bg-black/80 font-mono text-sm flex flex-col cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
        {lines.map((line) => (
          <pre
            key={line.id}
            className={cn('whitespace-pre-wrap text-xs leading-relaxed', getLineColor(line.type))}
          >
            {line.content}
          </pre>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center p-3 border-t border-white/10 bg-black/40">
        <span className="text-cyan-400 text-xs mr-2 flex-shrink-0">warrior@os:~$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-white text-xs outline-none caret-cyan-400"
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export const TerminalApp = memo(TerminalAppInner);
