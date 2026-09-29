// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Syntax highlighting (FORGE HUD code theme)
// Tiny dependency-free tokenizers for the languages Warrior OS shows:
// HTML (with embedded <style>/<script>), CSS, JS/TS/JSON, Python and
// shell. Used by the Code Lab editor overlay and NEXUS code blocks.
// Output is plain React spans (never innerHTML), so any input is safe.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react';

export type SyntaxLang = 'html' | 'css' | 'js' | 'py' | 'sh' | 'plain';

export type TokenKind =
  | 'plain'
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'fn'
  | 'punct'
  | 'tag'
  | 'attr'
  | 'selector'
  | 'property';

export interface Token {
  kind: TokenKind;
  text: string;
}

/** FORGE HUD code palette: plasma structure, ember strings, gold values. */
export const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: '',
  keyword: 'text-plasma-300',
  string: 'text-ember-300',
  number: 'text-gold',
  comment: 'text-fg-subtle italic',
  fn: 'text-info',
  punct: 'text-fg-muted',
  tag: 'text-plasma-300',
  attr: 'text-info',
  selector: 'text-plasma-300',
  property: 'text-info',
};

const LANG_ALIASES: Record<string, SyntaxLang> = {
  html: 'html',
  htm: 'html',
  xml: 'html',
  svg: 'html',
  vue: 'html',
  css: 'css',
  scss: 'css',
  less: 'css',
  js: 'js',
  javascript: 'js',
  jsx: 'js',
  mjs: 'js',
  cjs: 'js',
  ts: 'js',
  typescript: 'js',
  tsx: 'js',
  json: 'js',
  java: 'js',
  c: 'js',
  cpp: 'js',
  'c++': 'js',
  cs: 'js',
  csharp: 'js',
  go: 'js',
  rust: 'js',
  rs: 'js',
  kotlin: 'js',
  swift: 'js',
  dart: 'js',
  php: 'js',
  py: 'py',
  python: 'py',
  sh: 'sh',
  bash: 'sh',
  shell: 'sh',
  zsh: 'sh',
  console: 'sh',
  powershell: 'sh',
  ps1: 'sh',
};

/** Map a fence / file language name onto one of the tokenizers. */
export function resolveSyntaxLang(lang: string | undefined | null): SyntaxLang {
  if (!lang) return 'plain';
  return LANG_ALIASES[lang.trim().toLowerCase()] ?? 'plain';
}

// ─── Regex tokenizers (JS-family, Python, shell) ───

const JS_KEYWORDS =
  'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|from|export|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|super|yield|delete|void|static|get|set|interface|type|enum|implements|public|private|protected|readonly|as|fn|func|def|struct|impl|pub|use|mod|package|int|float|double|char|bool|boolean|string|auto|val|var|println|include|namespace|using|template';
const JS_LITERALS = 'true|false|null|undefined|NaN|Infinity|nil|None|True|False|self';

const PY_KEYWORDS =
  'def|class|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|with|try|except|finally|raise|lambda|yield|pass|break|continue|global|nonlocal|async|await|del|assert|print';

const SH_KEYWORDS =
  'if|then|else|elif|fi|for|in|do|done|case|esac|while|until|function|return|export|local|echo|cd|sudo|npm|npx|pnpm|yarn|git|node|python|pip|ls|cat|mkdir|rm|cp|mv|curl';

interface Rule {
  kind: TokenKind;
  re: string;
}

function compile(rules: Rule[]): { re: RegExp; kinds: TokenKind[] } {
  return {
    re: new RegExp(rules.map((r) => `(${r.re})`).join('|'), 'g'),
    kinds: rules.map((r) => r.kind),
  };
}

const STRING_DQ = '"(?:\\\\.|[^"\\\\\\n])*"?';
const STRING_SQ = "'(?:\\\\.|[^'\\\\\\n])*'?";
const NUMBER = '\\b(?:0[xX][\\da-fA-F_]+|\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?n?)\\b';

const JS_RULES = compile([
  { kind: 'comment', re: '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)' },
  { kind: 'string', re: '`(?:\\\\[\\s\\S]|[^\\\\`])*`?' },
  { kind: 'string', re: STRING_DQ },
  { kind: 'string', re: STRING_SQ },
  { kind: 'number', re: NUMBER },
  { kind: 'keyword', re: `\\b(?:${JS_KEYWORDS})\\b` },
  { kind: 'number', re: `\\b(?:${JS_LITERALS})\\b` },
  { kind: 'fn', re: '\\b[A-Za-z_$][\\w$]*(?=\\s*\\()' },
  { kind: 'punct', re: '[{}()[\\];,.:?<>=+\\-*/%!&|^~]' },
]);

const PY_RULES = compile([
  { kind: 'comment', re: '#[^\\n]*' },
  { kind: 'string', re: '"""[\\s\\S]*?(?:"""|$)' },
  { kind: 'string', re: "'''[\\s\\S]*?(?:'''|$)" },
  { kind: 'string', re: `[fFrRbB]?${STRING_DQ}` },
  { kind: 'string', re: `[fFrRbB]?${STRING_SQ}` },
  { kind: 'number', re: NUMBER },
  { kind: 'keyword', re: `\\b(?:${PY_KEYWORDS})\\b` },
  { kind: 'number', re: '\\b(?:True|False|None|self)\\b' },
  { kind: 'fn', re: '\\b[A-Za-z_][\\w]*(?=\\s*\\()' },
  { kind: 'punct', re: '[{}()[\\];,.:<>=+\\-*/%!&|^~@]' },
]);

const SH_RULES = compile([
  { kind: 'comment', re: '(?:^|(?<=\\s))#[^\\n]*' },
  { kind: 'string', re: STRING_DQ },
  { kind: 'string', re: STRING_SQ },
  { kind: 'fn', re: '(?:^|(?<=\\s))--?[A-Za-z][\\w-]*' },
  { kind: 'number', re: '\\$\\{?[A-Za-z_][\\w]*\\}?' },
  { kind: 'keyword', re: `\\b(?:${SH_KEYWORDS})\\b` },
  { kind: 'number', re: NUMBER },
  { kind: 'punct', re: '[|&;<>(){}\\[\\]=]' },
]);

function tokenizeRegex(code: string, compiled: { re: RegExp; kinds: TokenKind[] }, out: Token[]): void {
  const re = new RegExp(compiled.re.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) out.push({ kind: 'plain', text: code.slice(last, m.index) });
    const group = m.findIndex((g, i) => i > 0 && g !== undefined);
    out.push({ kind: compiled.kinds[group - 1] ?? 'plain', text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push({ kind: 'plain', text: code.slice(last) });
}

// ─── CSS (small state machine: selectors vs declarations) ───

const CSS_VALUE_RULES = compile([
  { kind: 'comment', re: '\\/\\*[\\s\\S]*?(?:\\*\\/|$)' },
  { kind: 'string', re: STRING_DQ },
  { kind: 'string', re: STRING_SQ },
  { kind: 'number', re: '#[\\da-fA-F]{3,8}\\b' },
  { kind: 'number', re: '-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[a-zA-Z%]+)?' },
  { kind: 'keyword', re: '!important' },
  { kind: 'fn', re: '[A-Za-z-]+(?=\\()' },
  { kind: 'punct', re: '[(),/]' },
]);

function tokenizeCss(code: string, out: Token[]): void {
  let i = 0;
  let depth = 0;
  const push = (kind: TokenKind, text: string) => {
    if (text) out.push({ kind, text });
  };
  while (i < code.length) {
    const ch = code[i];
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      const stop = end === -1 ? code.length : end + 2;
      push('comment', code.slice(i, stop));
      i = stop;
      continue;
    }
    if (/\s/.test(ch)) {
      let j = i;
      while (j < code.length && /\s/.test(code[j])) j++;
      push('plain', code.slice(i, j));
      i = j;
      continue;
    }
    if (ch === '{' || ch === '}' || ch === ';') {
      push('punct', ch);
      depth = ch === '{' ? depth + 1 : ch === '}' ? Math.max(0, depth - 1) : depth;
      i++;
      continue;
    }
    // What ends this chunk decides what it is: `{` → selector / at-rule header,
    // otherwise (inside a block) a declaration.
    let j = i;
    while (j < code.length && !'{};'.includes(code[j]) && !code.startsWith('/*', j)) j++;
    const chunk = code.slice(i, j);
    const header = code[j] === '{' || depth === 0;
    if (header) {
      if (chunk.startsWith('@')) {
        const m = /^@[\w-]+/.exec(chunk);
        push('keyword', m ? m[0] : chunk);
        if (m) tokenizeRegex(chunk.slice(m[0].length), CSS_VALUE_RULES, out);
      } else {
        push('selector', chunk);
      }
    } else {
      const colon = chunk.indexOf(':');
      if (colon === -1) {
        push('property', chunk);
      } else {
        push('property', chunk.slice(0, colon));
        push('punct', ':');
        tokenizeRegex(chunk.slice(colon + 1), CSS_VALUE_RULES, out);
      }
    }
    i = j;
  }
}

// ─── HTML (tags, attributes, embedded CSS / JS) ───

function tokenizeHtml(code: string, out: Token[]): void {
  let i = 0;
  let text = '';
  const flush = () => {
    if (text) out.push({ kind: 'plain', text });
    text = '';
  };
  while (i < code.length) {
    if (code.startsWith('<!--', i)) {
      flush();
      const end = code.indexOf('-->', i + 4);
      const stop = end === -1 ? code.length : end + 3;
      out.push({ kind: 'comment', text: code.slice(i, stop) });
      i = stop;
      continue;
    }
    const tagMatch = /^<\/?([A-Za-z][\w:-]*)|^<!doctype\b/i.exec(code.slice(i, i + 64));
    if (code[i] === '<' && tagMatch) {
      flush();
      const closing = code[i + 1] === '/';
      const open = closing ? '</' : '<';
      out.push({ kind: 'punct', text: open });
      const nameStart = i + open.length;
      const name = tagMatch[1] ?? code.slice(nameStart, i + tagMatch[0].length);
      out.push({ kind: tagMatch[1] ? 'tag' : 'keyword', text: code.slice(nameStart, nameStart + name.length) });
      let j = nameStart + name.length;
      // Attributes until the tag closes.
      while (j < code.length && code[j] !== '>') {
        const rest = code.slice(j);
        const ws = /^\s+/.exec(rest);
        if (ws) {
          out.push({ kind: 'plain', text: ws[0] });
          j += ws[0].length;
          continue;
        }
        const str = /^"[^"]*"?|^'[^']*'?/.exec(rest);
        if (str) {
          out.push({ kind: 'string', text: str[0] });
          j += str[0].length;
          continue;
        }
        if (rest[0] === '=' || rest[0] === '/') {
          out.push({ kind: 'punct', text: rest[0] });
          j++;
          continue;
        }
        const attr = /^[^\s=>/"']+/.exec(rest);
        if (attr) {
          out.push({ kind: 'attr', text: attr[0] });
          j += attr[0].length;
          continue;
        }
        out.push({ kind: 'plain', text: rest[0] });
        j++;
      }
      if (code[j] === '>') {
        out.push({ kind: 'punct', text: '>' });
        j++;
      }
      i = j;
      // Embedded languages
      const lower = name.toLowerCase();
      if (!closing && (lower === 'style' || lower === 'script')) {
        const closeAt = code.toLowerCase().indexOf(`</${lower}`, i);
        const stop = closeAt === -1 ? code.length : closeAt;
        const inner = code.slice(i, stop);
        if (lower === 'style') tokenizeCss(inner, out);
        else tokenizeRegex(inner, JS_RULES, out);
        i = stop;
      }
      continue;
    }
    if (code[i] === '&') {
      const ent = /^&[#\w]+;/.exec(code.slice(i, i + 12));
      if (ent) {
        flush();
        out.push({ kind: 'number', text: ent[0] });
        i += ent[0].length;
        continue;
      }
    }
    text += code[i];
    i++;
  }
  flush();
}

/** Split code into highlight tokens. */
export function tokenize(code: string, lang: SyntaxLang): Token[] {
  const out: Token[] = [];
  switch (lang) {
    case 'html':
      tokenizeHtml(code, out);
      break;
    case 'css':
      tokenizeCss(code, out);
      break;
    case 'js':
      tokenizeRegex(code, JS_RULES, out);
      break;
    case 'py':
      tokenizeRegex(code, PY_RULES, out);
      break;
    case 'sh':
      tokenizeRegex(code, SH_RULES, out);
      break;
    default:
      out.push({ kind: 'plain', text: code });
  }
  return out;
}

/** Highlighted code as React spans (drop inside a <pre>/<code>). */
export function highlight(code: string, lang: SyntaxLang): ReactNode[] {
  if (lang === 'plain') return [code];
  return tokenize(code, lang).map((token, i) =>
    token.kind === 'plain' ? (
      token.text
    ) : (
      <span key={i} className={TOKEN_CLASS[token.kind]}>
        {token.text}
      </span>
    )
  );
}
