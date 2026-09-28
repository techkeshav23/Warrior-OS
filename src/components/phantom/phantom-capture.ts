// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom capture / restore
// Browser-only helpers (call them from handlers or effects):
//  • findWindowElement   — the live DOM of an OS window (by z-index)
//  • captureWindowState  — scroll offsets + non-sensitive form values
//  • restoreWindowState  — re-applies them to a resurrected window
//  • snapshotWindow      — clones the window DOM, rasterises it via
//    SVG <foreignObject> → <img> → <canvas> → WebP blob, returns an
//    object URL. Intermediate SVG URLs and canvases are released.
// No html2canvas: the page's own stylesheets are embedded into the
// SVG so the clone renders with the real classes.
// ═══════════════════════════════════════════════════════════

import { isSensitiveTarget } from '@/hooks/useTypingBiometrics';
import type { PhantomFieldEntry, PhantomScrollEntry, PhantomWindowData } from '@/types/phantom';

const MAX_SCAN_ELEMENTS = 5000;
const MAX_SCROLL_ENTRIES = 40;
const MAX_FIELD_ENTRIES = 60;
const MAX_FIELD_LENGTH = 20_000;
const MAX_CSS_CHARS = 2_500_000;
const SNAPSHOT_MAX_EDGE = 960;
const IMAGE_TIMEOUT_MS = 4000;

const RESTORABLE_INPUT_TYPES = new Set([
  '',
  'text',
  'search',
  'email',
  'url',
  'tel',
  'number',
  'range',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'color',
]);

// ─── Locating a window ──────────────────────────────────────

/**
 * Find the live DOM root (the react-rnd box) of an OS window. z-index is
 * unique among open windows, and the title bar class confirms it is a window.
 */
export function findWindowElement(zIndex: number): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const nodes = document.querySelectorAll<HTMLElement>('.react-draggable');
  for (const el of Array.from(nodes)) {
    if (el.style.zIndex !== String(zIndex)) continue;
    if (!el.querySelector('.window-drag-handle')) continue;
    return el;
  }
  return null;
}

/** The scrollable content area inside a window root (below the title bar). */
function contentRoot(windowRoot: HTMLElement): HTMLElement | null {
  const glass = Array.from(windowRoot.children).find((c) =>
    c.querySelector(':scope > .window-drag-handle')
  );
  if (!glass) return null;
  const content = Array.from(glass.children).find(
    (c) => !c.classList.contains('window-drag-handle')
  );
  return content instanceof HTMLElement ? content : null;
}

function pathFrom(root: Element, el: Element): number[] | null {
  const path: number[] = [];
  let node: Element | null = el;
  while (node && node !== root) {
    const parent: Element | null = node.parentElement;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.children, node));
    node = parent;
  }
  return node === root ? path : null;
}

function resolvePath(root: Element, path: number[]): Element | null {
  let node: Element | null = root;
  for (const idx of path) {
    if (!node) return null;
    node = node.children.item(idx);
  }
  return node;
}

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function restorableField(el: Element): FieldElement | null {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return isSensitiveTarget(el) ? null : el;
  }
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (!RESTORABLE_INPUT_TYPES.has(type)) return null;
    return isSensitiveTarget(el) ? null : el;
  }
  return null;
}

// ─── State capture / restore ────────────────────────────────

/** Scroll offsets and non-sensitive form values inside a window. */
export function captureWindowState(windowRoot: HTMLElement, wasMaximized: boolean): PhantomWindowData {
  const scroll: PhantomScrollEntry[] = [];
  const fields: PhantomFieldEntry[] = [];
  const root = contentRoot(windowRoot);
  if (!root) return { scroll, fields, wasMaximized };

  const all = [root, ...Array.from(root.querySelectorAll('*')).slice(0, MAX_SCAN_ELEMENTS)];
  for (const el of all) {
    if (scroll.length < MAX_SCROLL_ENTRIES && (el.scrollTop > 0 || el.scrollLeft > 0)) {
      const path = el === root ? [] : pathFrom(root, el);
      if (path) scroll.push({ path, tag: el.tagName.toLowerCase(), top: el.scrollTop, left: el.scrollLeft });
    }
    if (fields.length < MAX_FIELD_ENTRIES) {
      const field = restorableField(el);
      if (field) {
        const path = pathFrom(root, field);
        if (path) {
          fields.push({
            path,
            tag: field.tagName.toLowerCase() as PhantomFieldEntry['tag'],
            type: field instanceof HTMLInputElement ? (field.getAttribute('type') || '').toLowerCase() : '',
            value: field.value.slice(0, MAX_FIELD_LENGTH),
          });
        }
      }
    }
  }
  return { scroll, fields, wasMaximized };
}

function setNativeValue(el: FieldElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  // React listens for these to run the field's onChange.
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Re-apply captured scroll and form state to a (re)opened window.
 * Entries already in `done` are never touched again (so a retry can't
 * overwrite something the user has started typing); newly satisfied
 * entries are added to it. Returns the number of satisfied entries.
 */
export function restoreWindowState(
  windowRoot: HTMLElement,
  data: PhantomWindowData,
  done: Set<string>
): number {
  const root = contentRoot(windowRoot);
  if (!root) return done.size;

  data.fields.forEach((f, i) => {
    const key = `f${i}`;
    if (done.has(key)) return;
    const el = resolvePath(root, f.path);
    if (!el || el.tagName.toLowerCase() !== f.tag) return;
    const field = restorableField(el);
    if (!field) return;
    if (field instanceof HTMLInputElement && (field.getAttribute('type') || '').toLowerCase() !== f.type) return;
    if (field.value !== f.value) setNativeValue(field, f.value);
    done.add(key);
  });

  data.scroll.forEach((s, i) => {
    const key = `s${i}`;
    if (done.has(key)) return;
    const el = s.path.length === 0 ? root : resolvePath(root, s.path);
    if (!el || el.tagName.toLowerCase() !== s.tag) return;
    el.scrollTop = s.top;
    el.scrollLeft = s.left;
    if (Math.abs(el.scrollTop - s.top) <= 2 && Math.abs(el.scrollLeft - s.left) <= 2) done.add(key);
  });
  return done.size;
}

// ─── Snapshot (DOM → image) ─────────────────────────────────

let cssCache: { key: string; text: string } | null = null;

/** Same-origin page CSS as one string (font-face/imports dropped), cached. */
function collectPageCss(): string {
  const sheets = Array.from(document.styleSheets);
  const lists: CSSRuleList[] = [];
  let key = `${sheets.length}`;
  for (const sheet of sheets) {
    try {
      const rules = sheet.cssRules;
      lists.push(rules);
      key += `|${sheet.href ?? 'inline'}:${rules.length}`;
    } catch {
      /* cross-origin sheet — unreadable, skip */
    }
  }
  if (cssCache && cssCache.key === key) return cssCache.text;

  const parts: string[] = [];
  let size = 0;
  for (const rules of lists) {
    for (const rule of Array.from(rules)) {
      if (typeof CSSFontFaceRule !== 'undefined' && rule instanceof CSSFontFaceRule) continue;
      if (typeof CSSImportRule !== 'undefined' && rule instanceof CSSImportRule) continue;
      const text = rule.cssText;
      size += text.length;
      if (size > MAX_CSS_CHARS) break;
      parts.push(text);
    }
  }
  const text = parts.join('\n');
  cssCache = { key, text };
  return text;
}

function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Prepare a clone so it renders like the original inside an SVG image. */
function prepareClone(original: HTMLElement, clone: HTMLElement): void {
  const origEls = [original, ...Array.from(original.querySelectorAll<HTMLElement>('*'))];
  const cloneEls = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
  const count = Math.min(origEls.length, cloneEls.length, MAX_SCAN_ELEMENTS);

  for (let i = 0; i < count; i++) {
    const o = origEls[i];
    const c = cloneEls[i];
    if (!c || o.tagName !== c.tagName) continue;

    if (o instanceof HTMLCanvasElement) {
      const box = o.getBoundingClientRect();
      const replacement = document.createElement('img');
      replacement.setAttribute('style', `width:${box.width}px;height:${box.height}px;display:block;`);
      try {
        if (o.width * o.height <= 2_000_000) replacement.setAttribute('src', o.toDataURL('image/png'));
      } catch {
        /* tainted canvas — leave blank */
      }
      c.replaceWith(replacement);
      continue;
    }
    if (o instanceof HTMLVideoElement || o instanceof HTMLIFrameElement || o instanceof HTMLAudioElement) {
      const box = o.getBoundingClientRect();
      const ph = document.createElement('div');
      ph.setAttribute('style', `width:${box.width}px;height:${box.height}px;background:rgba(0,0,0,0.35);`);
      c.replaceWith(ph);
      continue;
    }
    if (o instanceof HTMLImageElement) {
      const src = o.currentSrc || o.src;
      if (!src.startsWith('data:')) c.style.visibility = 'hidden'; // external images can't load in an SVG image
      continue;
    }
    if (o instanceof HTMLInputElement) {
      const sensitive = isSensitiveTarget(o) || o.type === 'password';
      c.setAttribute('value', sensitive ? '' : o.value);
      if (o.type === 'checkbox' || o.type === 'radio') {
        if (o.checked) c.setAttribute('checked', '');
        else c.removeAttribute('checked');
      }
    } else if (o instanceof HTMLTextAreaElement) {
      c.textContent = isSensitiveTarget(o) ? '' : o.value;
    } else if (o instanceof HTMLSelectElement) {
      const options = c.querySelectorAll('option');
      options.forEach((opt, idx) => {
        if (idx === o.selectedIndex) opt.setAttribute('selected', '');
        else opt.removeAttribute('selected');
      });
    }

    // Reproduce scroll position by shifting the scrolled element's children.
    if ((o.scrollTop > 0 || o.scrollLeft > 0) && c.children.length > 0) {
      c.style.overflow = 'hidden';
      for (const child of Array.from(c.children)) {
        if (child instanceof HTMLElement || child instanceof SVGElement) {
          child.style.setProperty('translate', `${-o.scrollLeft}px ${-o.scrollTop}px`);
        }
      }
    }
  }
}

function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(() => reject(new Error('snapshot timeout')), IMAGE_TIMEOUT_MS);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('snapshot decode failed'));
    };
    img.decoding = 'async';
    img.src = url;
  });
}

/**
 * Rasterise a window. The synchronous part (clone + serialise) runs
 * immediately, so it is safe to call while the window is being removed;
 * the returned promise resolves to an object URL (caller must revoke it)
 * or null if the browser can't render the snapshot.
 */
export function snapshotWindow(windowRoot: HTMLElement, width: number, height: number): Promise<string | null> {
  if (typeof document === 'undefined' || width < 2 || height < 2) return Promise.resolve(null);

  let svgUrl: string | null = null;
  try {
    const clone = windowRoot.cloneNode(true) as HTMLElement;
    prepareClone(windowRoot, clone);
    const cs = clone.style;
    cs.setProperty('transform', 'none');
    cs.setProperty('translate', 'none');
    cs.setProperty('position', 'relative');
    cs.setProperty('left', '0');
    cs.setProperty('top', '0');
    cs.setProperty('margin', '0');
    cs.setProperty('z-index', 'auto');
    cs.setProperty('width', `${width}px`);
    cs.setProperty('height', `${height}px`);

    const bodyStyle = window.getComputedStyle(document.body);
    const css = collectPageCss();
    const xhtml = new XMLSerializer().serializeToString(clone);
    const wrapperStyle = [
      `width:${width}px`,
      `height:${height}px`,
      'overflow:hidden',
      `font-family:${bodyStyle.fontFamily.replace(/"/g, "'")}`,
      `color:${bodyStyle.color}`,
      'box-sizing:border-box',
    ].join(';');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<foreignObject x="0" y="0" width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="${wrapperStyle}">` +
      `<style>${escapeXmlText(css)}</style>${xhtml}</div></foreignObject></svg>`;
    svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  } catch {
    if (svgUrl) URL.revokeObjectURL(svgUrl);
    return Promise.resolve(null);
  }

  const sourceUrl = svgUrl;
  return (async () => {
    const canvas = document.createElement('canvas');
    try {
      const img = await loadImage(sourceUrl);
      const scale = Math.min(1, SNAPSHOT_MAX_EDGE / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let blob: Blob | null = null;
      try {
        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
      } catch {
        blob = null; // tainted canvas (some browsers treat foreignObject as cross-origin)
      }
      if (blob) {
        URL.revokeObjectURL(sourceUrl);
        return URL.createObjectURL(blob);
      }
      // Fall back to showing the SVG itself; the store revokes it later.
      return sourceUrl;
    } catch {
      URL.revokeObjectURL(sourceUrl);
      return null;
    } finally {
      releaseCanvas(canvas);
    }
  })();
}
