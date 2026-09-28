// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Code Lab
// HTML/CSS/JS playground with live iframe preview (no external deps)
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';

const STORE_KEY = 'warrior-codelab';

type Lang = 'html' | 'css' | 'js';

interface Snippet {
  html: string;
  css: string;
  js: string;
}

const DEFAULT_SNIPPET: Snippet = {
  html: '<h1>Hello, Warrior ⚔️</h1>\n<button id="btn">Click me</button>\n<p id="out"></p>',
  css: 'body{font-family:system-ui;background:#0a0e14;color:#e2e8f0;display:grid;place-items:center;height:100vh;gap:1rem}\nh1{color:#22d3ee}\nbutton{background:#22d3ee;border:0;padding:.6rem 1.2rem;border-radius:.5rem;cursor:pointer;font-weight:600}',
  js: "let count = 0;\ndocument.getElementById('btn').addEventListener('click', () => {\n  count++;\n  document.getElementById('out').textContent = `Clicked ${count} times`;\n});",
};

function loadSnippet(): Snippet {
  if (typeof window === 'undefined') return DEFAULT_SNIPPET;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...DEFAULT_SNIPPET, ...JSON.parse(raw) } : DEFAULT_SNIPPET;
  } catch { return DEFAULT_SNIPPET; }
}

function CodeLabAppInner() {
  const [snippet, setSnippet] = useState<Snippet>(loadSnippet);
  const [active, setActive] = useState<Lang>('html');
  const [srcDoc, setSrcDoc] = useState('');
  const [autoRun, setAutoRun] = useState(true);

  const buildDoc = useCallback((s: Snippet) => {
    return `<!DOCTYPE html><html><head><style>${s.css}</style></head><body>${s.html}<script>
      try { ${s.js} } catch(e) { document.body.insertAdjacentHTML('beforeend','<pre style="color:#ff5555;position:fixed;bottom:0;left:0;right:0;margin:0;padding:4px;background:#000;font-size:11px">'+e+'</pre>'); }
    <\/script></body></html>`;
  }, []);

  const run = useCallback(() => {
    setSrcDoc(buildDoc(snippet));
  }, [snippet, buildDoc]);

  // Initial run + persist
  useEffect(() => { setSrcDoc(buildDoc(snippet)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-run + save whenever snippet changes
  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(snippet));
    if (!autoRun) return;
    const t = setTimeout(() => setSrcDoc(buildDoc(snippet)), 600);
    return () => clearTimeout(t);
  }, [snippet, autoRun, buildDoc]);

  const setCode = useCallback((lang: Lang, value: string) => {
    setSnippet((s) => ({ ...s, [lang]: value }));
  }, []);

  const tabs: { lang: Lang; label: string; color: string }[] = useMemo(() => [
    { lang: 'html', label: 'HTML', color: 'text-orange-300' },
    { lang: 'css', label: 'CSS', color: 'text-blue-300' },
    { lang: 'js', label: 'JS', color: 'text-yellow-300' },
  ], []);

  const reset = useCallback(() => {
    if (confirm('Reset to default snippet? Your code will be lost.')) {
      setSnippet(DEFAULT_SNIPPET);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0a0e14] text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/30">
        <span className="text-sm font-bold text-cyan-300">💻 Code Lab</span>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-[11px] text-white/50 cursor-pointer select-none">
          <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} className="accent-cyan-400" />
          auto-run
        </label>
        <button onClick={run} className="px-3 py-1 rounded text-xs bg-cyan-400 text-black font-medium hover:bg-cyan-300">▶ Run</button>
        <button onClick={reset} className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-white/60 hover:bg-white/10">Reset</button>
      </div>

      {/* Split: editor | preview */}
      <div className="flex-1 flex min-h-0">
        {/* Editor */}
        <div className="w-1/2 flex flex-col border-r border-white/10 min-w-0">
          <div className="flex border-b border-white/10 bg-black/20">
            {tabs.map((t) => (
              <button
                key={t.lang}
                onClick={() => setActive(t.lang)}
                className={cn(
                  'px-4 py-2 text-xs font-mono font-medium transition-all',
                  active === t.lang ? cn('bg-white/5 border-b-2 border-cyan-400', t.color) : 'text-white/40 hover:text-white/70'
                )}
              >{t.label}</button>
            ))}
          </div>
          <textarea
            value={snippet[active]}
            onChange={(e) => setCode(active, e.target.value)}
            spellCheck={false}
            className="flex-1 bg-transparent p-3 text-[13px] font-mono text-white/85 outline-none resize-none leading-relaxed tab-size-2"
            style={{ tabSize: 2 }}
          />
        </div>

        {/* Preview */}
        <div className="w-1/2 flex flex-col bg-white min-w-0">
          <div className="px-3 py-1.5 bg-black/30 text-[11px] text-white/40 border-b border-white/10">Preview</div>
          <iframe
            title="Code Lab Preview"
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            className="flex-1 w-full bg-white"
          />
        </div>
      </div>
    </div>
  );
}

export const CodeLabApp = memo(CodeLabAppInner);
