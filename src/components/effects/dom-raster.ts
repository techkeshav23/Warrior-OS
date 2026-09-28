// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DOM Raster
// Paints a live DOM subtree onto a canvas so effects can break the
// real screen apart without html2canvas: background colours, linear
// and radial gradients, borders, clip-path polygons, text (per word,
// at its laid-out position, with font, colour, spacing and glow),
// inline SVG icons, images, 2D canvases and form field values.
// Approximate by design (no box-shadows, filters or 3D transforms)
// and bounded by element/word budgets so a capture stays fast.
// Browser only: call from effects or event handlers.
// ═══════════════════════════════════════════════════════════

export interface RasterRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RasterOptions {
  /** Capture area in viewport px (default: the root's bounding box). */
  rect?: RasterRect;
  /** Output pixel density (default: devicePixelRatio capped at 2). */
  scale?: number;
  /** CSS colour painted under everything. */
  background?: string;
  /** Subtrees matching this selector are skipped. */
  ignoreSelector?: string;
  /** Clip the output to a rounded rectangle of this radius (px). */
  radius?: number;
  maxElements?: number;
  maxWords?: number;
}

export interface Raster extends RasterRect {
  canvas: HTMLCanvasElement;
  scale: number;
  /** How much got painted, so callers can detect an empty capture. */
  elements: number;
  words: number;
}

interface WalkState {
  ctx: CanvasRenderingContext2D;
  clip: RasterRect;
  elements: number;
  words: number;
  maxElements: number;
  maxWords: number;
  ignore: string | null;
  range: Range;
  scale: number;
}

type Ctx = CanvasRenderingContext2D;
type CtxWithSpacing = CanvasRenderingContext2D & { letterSpacing?: string };

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE',
  'IFRAME', 'VIDEO', 'AUDIO', 'OBJECT', 'EMBED', 'SOURCE', 'TRACK', 'BR', 'WBR',
]);
const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'password', 'number', 'tel']);
const SVG_SHAPES = 'path, circle, ellipse, rect, line, polyline, polygon';
const SVG_HIDDEN_ANCESTORS = 'defs, clipPath, mask, pattern, symbol, marker';
/** Pseudo-element checks cost two extra style lookups; only for the first N elements. */
const PSEUDO_BUDGET = 1200;
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

// ─── Entry point ───

export function rasterizeElement(root: Element, options: RasterOptions = {}): Raster | null {
  if (typeof document === 'undefined') return null;
  const box = root.getBoundingClientRect();
  const rect: RasterRect = options.rect ?? {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
  };
  if (rect.width < 1 || rect.height < 1) return null;

  const scale = options.scale ?? Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Draw in viewport coordinates.
  ctx.setTransform(scale, 0, 0, scale, -rect.left * scale, -rect.top * scale);
  if (options.radius && options.radius > 0) {
    ctx.beginPath();
    roundRectPath(ctx, rect.left, rect.top, rect.width, rect.height, options.radius);
    ctx.clip();
  }
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
  }

  const state: WalkState = {
    ctx,
    clip: { ...rect },
    elements: 0,
    words: 0,
    maxElements: options.maxElements ?? 2500,
    maxWords: options.maxWords ?? 3000,
    ignore: options.ignoreSelector ?? null,
    range: document.createRange(),
    scale,
  };
  try {
    walk(root, 1, state);
  } catch {
    // Best effort: keep whatever was painted before the failure.
  }

  return {
    canvas,
    scale,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    elements: state.elements,
    words: state.words,
  };
}

// ─── Tree walk ───

function walk(el: Element, parentOpacity: number, st: WalkState): void {
  if (st.elements >= st.maxElements || SKIP_TAGS.has(el.tagName)) return;
  if (st.ignore && el.matches(st.ignore)) return;
  const cs = getComputedStyle(el);
  if (cs.display === 'none') return;
  const opacity = parentOpacity * num(cs.opacity, 1);
  if (opacity < 0.01) return;
  st.elements += 1;

  const r = el.getBoundingClientRect();
  const visible = cs.visibility === 'visible';
  const onScreen = r.width > 0 && r.height > 0 && overlaps(r, st.clip);
  const clipsChildren = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
  if (clipsChildren && !onScreen) return;

  const ctx = st.ctx;
  const isSvg = el instanceof SVGSVGElement;
  ctx.save();
  if (cs.clipPath && cs.clipPath !== 'none') applyClipPath(ctx, cs.clipPath, r);

  if (visible && onScreen) {
    ctx.globalAlpha = opacity;
    paintBox(ctx, cs, r);
    if (st.elements < PSEUDO_BUDGET) paintPseudo(ctx, el, '::before', r, opacity);
    if (isSvg) {
      paintSvg(ctx, el, cs, r, opacity);
    } else if (el instanceof HTMLCanvasElement || el instanceof HTMLImageElement) {
      paintReplaced(ctx, el, r);
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      paintField(ctx, el, cs, r, opacity);
    }
  }

  if (!isSvg) {
    const prevClip = st.clip;
    if (clipsChildren) {
      ctx.beginPath();
      ctx.rect(r.left, r.top, r.width, r.height);
      ctx.clip();
      st.clip = intersect(st.clip, r);
    }
    for (let node = el.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === TEXT_NODE) {
        if (visible) paintText(st, node as Text, cs, r, opacity);
      } else if (node.nodeType === ELEMENT_NODE) {
        walk(node as Element, opacity, st);
      }
    }
    st.clip = prevClip;
    if (visible && onScreen && st.elements < PSEUDO_BUDGET) {
      paintPseudo(ctx, el, '::after', r, opacity);
    }
  }
  ctx.restore();
}

// ─── Boxes ───

function paintBox(ctx: Ctx, cs: CSSStyleDeclaration, r: DOMRect): void {
  const radius = cornerRadius(cs.borderTopLeftRadius, r);
  // background-clip: text paints the background through the glyphs only (see paintText).
  if (!isTextClipped(cs)) {
    if (colorAlpha(cs.backgroundColor) > 0 && setFill(ctx, cs.backgroundColor)) {
      fillShape(ctx, r, radius);
    }
    const image = cs.backgroundImage;
    if (image && image !== 'none') paintGradient(ctx, image, r, radius);
  }
  paintBorders(ctx, cs, r, radius);
}

function isTextClipped(cs: CSSStyleDeclaration): boolean {
  return cs.backgroundClip === 'text' || cs.getPropertyValue('-webkit-background-clip') === 'text';
}

function paintBorders(ctx: Ctx, cs: CSSStyleDeclaration, r: DOMRect, radius: number): void {
  const sides = [
    { w: num(cs.borderTopWidth, 0), c: cs.borderTopColor, s: cs.borderTopStyle },
    { w: num(cs.borderRightWidth, 0), c: cs.borderRightColor, s: cs.borderRightStyle },
    { w: num(cs.borderBottomWidth, 0), c: cs.borderBottomColor, s: cs.borderBottomStyle },
    { w: num(cs.borderLeftWidth, 0), c: cs.borderLeftColor, s: cs.borderLeftStyle },
  ];
  const shown = sides.map((s) => s.w > 0 && s.s !== 'none' && s.s !== 'hidden' && colorAlpha(s.c) > 0);
  if (!shown.some(Boolean)) return;

  const first = sides[0];
  const uniform =
    shown.every(Boolean) && sides.every((s) => s.w === first.w && s.c === first.c && s.s === first.s);
  if (uniform && radius > 0.5) {
    if (!setStroke(ctx, first.c)) return;
    ctx.lineWidth = first.w;
    ctx.setLineDash(first.s === 'dashed' ? [first.w * 3, first.w * 2] : first.s === 'dotted' ? [first.w, first.w] : []);
    ctx.beginPath();
    roundRectPath(
      ctx,
      r.left + first.w / 2,
      r.top + first.w / 2,
      r.width - first.w,
      r.height - first.w,
      Math.max(0, radius - first.w / 2)
    );
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  const strips: Array<[number, number, number, number]> = [
    [r.left, r.top, r.width, sides[0].w],
    [r.right - sides[1].w, r.top, sides[1].w, r.height],
    [r.left, r.bottom - sides[2].w, r.width, sides[2].w],
    [r.left, r.top, sides[3].w, r.height],
  ];
  strips.forEach((strip, i) => {
    if (!shown[i] || !setFill(ctx, sides[i].c)) return;
    ctx.fillRect(strip[0], strip[1], strip[2], strip[3]);
  });
}

function paintPseudo(ctx: Ctx, el: Element, which: '::before' | '::after', r: DOMRect, opacity: number): void {
  const ps = getComputedStyle(el, which);
  const content = ps.content;
  if (!content || content === 'none' || content === 'normal' || ps.display === 'none') return;
  // Only overlay-style pseudos (position absolute/fixed + inset 0) map reliably onto the host box.
  if (ps.position !== 'absolute' && ps.position !== 'fixed') return;
  if (num(ps.top, 1) !== 0 || num(ps.left, 1) !== 0 || num(ps.right, 1) !== 0 || num(ps.bottom, 1) !== 0) return;
  const alpha = opacity * num(ps.opacity, 1);
  if (alpha < 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const radius = cornerRadius(ps.borderTopLeftRadius, r);
  if (colorAlpha(ps.backgroundColor) > 0 && setFill(ctx, ps.backgroundColor)) fillShape(ctx, r, radius);
  if (ps.backgroundImage && ps.backgroundImage !== 'none') paintGradient(ctx, ps.backgroundImage, r, radius);
  ctx.restore();
}

// ─── Gradients ───

interface GradientStop {
  color: string;
  pos: number | null;
}

interface ParsedGradient {
  kind: 'linear' | 'radial';
  angle: number;
  cx: number;
  cy: number;
  circle: boolean;
  stops: Array<{ color: string; pos: number }>;
}

function paintGradient(ctx: Ctx, value: string, r: DOMRect, radius: number): void {
  const g = parseGradient(value);
  if (!g) return;
  ctx.save();
  try {
    if (g.kind === 'linear') {
      ctx.fillStyle = linearGradientFor(ctx, g, r);
      fillShape(ctx, r, radius);
    } else {
      // Farthest-corner radial gradient; ellipses are drawn by squashing y.
      const cx = r.left + r.width * g.cx;
      const cy = r.top + r.height * g.cy;
      const fx = Math.max(g.cx, 1 - g.cx) * r.width;
      const fy = Math.max(g.cy, 1 - g.cy) * r.height;
      const rx = g.circle ? Math.hypot(fx, fy) : Math.max(1, fx * Math.SQRT2);
      const ry = g.circle ? rx : Math.max(1, fy * Math.SQRT2);
      const k = rx / ry;
      ctx.translate(cx, cy);
      ctx.scale(1, 1 / k);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, rx));
      for (const s of g.stops) grad.addColorStop(s.pos, s.color);
      ctx.fillStyle = grad;
      ctx.beginPath();
      const top = (r.top - cy) * k;
      roundRectPath(ctx, r.left - cx, top, r.width, r.height * k, radius);
      ctx.fill();
    }
  } catch {
    // Unparseable colour stop: skip this layer.
  }
  ctx.restore();
}

/** CSS linear-gradient geometry for a box (gradient line through the centre). Throws on a bad stop colour. */
function linearGradientFor(ctx: Ctx, g: ParsedGradient, r: RasterRect | DOMRect): CanvasGradient {
  const rad = (g.angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(r.width * dx) + Math.abs(r.height * dy)) / 2;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const grad = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  for (const s of g.stops) grad.addColorStop(s.pos, s.color);
  return grad;
}

function parseGradient(value: string): ParsedGradient | null {
  const m = /(^|[\s,])(linear|radial)-gradient\(/.exec(value);
  if (!m) return null;
  const kind = m[2] as 'linear' | 'radial';
  const open = m.index + m[0].length;
  let depth = 1;
  let i = open;
  for (; i < value.length && depth > 0; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
  }
  const parts = splitTopLevel(value.slice(open, i - 1));
  let angle = 180;
  let cx = 0.5;
  let cy = 0.5;
  let circle = false;

  const head = (parts[0] ?? '').trim();
  const isDescriptor =
    kind === 'linear'
      ? /^(to\s|in\s)/i.test(head) || /^-?[\d.]+(deg|turn|rad|grad)\b/i.test(head)
      : /^(circle|ellipse|closest-|farthest-|at\s|in\s|\d)/i.test(head);
  if (isDescriptor) {
    parts.shift();
    if (kind === 'linear') {
      angle = parseLinearAngle(head);
    } else {
      circle = /\bcircle\b/i.test(head);
      const at = /at\s+(-?[\d.]+)%\s+(-?[\d.]+)%/i.exec(head);
      if (at) {
        cx = parseFloat(at[1]) / 100;
        cy = parseFloat(at[2]) / 100;
      }
    }
  }

  const raw: GradientStop[] = parts.map(parseStop).filter((s): s is GradientStop => s !== null);
  if (raw.length < 2) return null;
  return { kind, angle, cx, cy, circle, stops: distributeStops(raw) };
}

function parseLinearAngle(head: string): number {
  const deg = /(-?[\d.]+)(deg|turn|rad|grad)/i.exec(head);
  if (deg) {
    const v = parseFloat(deg[1]);
    const unit = deg[2].toLowerCase();
    if (unit === 'turn') return v * 360;
    if (unit === 'rad') return (v * 180) / Math.PI;
    if (unit === 'grad') return v * 0.9;
    return v;
  }
  const to = /to\s+([a-z]+)(?:\s+([a-z]+))?/i.exec(head);
  if (!to) return 180;
  const words = [to[1], to[2]].filter(Boolean).map((w) => w.toLowerCase());
  const has = (w: string) => words.includes(w);
  if (has('top') && has('right')) return 45;
  if (has('bottom') && has('right')) return 135;
  if (has('bottom') && has('left')) return 225;
  if (has('top') && has('left')) return 315;
  if (has('top')) return 0;
  if (has('right')) return 90;
  if (has('left')) return 270;
  return 180;
}

function parseStop(part: string): GradientStop | null {
  const p = part.trim();
  if (!p) return null;
  let color: string;
  let rest: string;
  if (/^[a-z-]+\(/i.test(p)) {
    let depth = 0;
    let end = -1;
    for (let i = 0; i < p.length; i++) {
      if (p[i] === '(') depth++;
      else if (p[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) return null;
    color = p.slice(0, end + 1);
    rest = p.slice(end + 1);
  } else {
    const space = p.indexOf(' ');
    color = space < 0 ? p : p.slice(0, space);
    rest = space < 0 ? '' : p.slice(space);
  }
  if (/^-?[\d.]/.test(color)) return null; // a colour hint, not a stop
  const pct = /(-?[\d.]+)%/.exec(rest);
  return { color, pos: pct ? Math.max(0, Math.min(1, parseFloat(pct[1]) / 100)) : null };
}

function distributeStops(raw: GradientStop[]): Array<{ color: string; pos: number }> {
  const pos = raw.map((s) => s.pos);
  if (pos[0] === null) pos[0] = 0;
  if (pos[pos.length - 1] === null) pos[pos.length - 1] = 1;
  let lastKnown = 0;
  for (let i = 1; i < pos.length; i++) {
    if (pos[i] !== null) {
      const from = pos[lastKnown] ?? 0;
      const to = pos[i] ?? 1;
      const gap = i - lastKnown;
      for (let j = lastKnown + 1; j < i; j++) pos[j] = from + ((to - from) * (j - lastKnown)) / gap;
      lastKnown = i;
    }
  }
  let prev = 0;
  return raw.map((s, i) => {
    const p = Math.max(prev, pos[i] ?? prev);
    prev = p;
    return { color: s.color, pos: p };
  });
}

function splitTopLevel(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
  }
  out.push(body.slice(start));
  return out;
}

// ─── Text ───

function paintText(st: WalkState, node: Text, cs: CSSStyleDeclaration, box: DOMRect, opacity: number): void {
  const text = node.data;
  if (!text || !text.trim() || st.words >= st.maxWords) return;
  const ctx = st.ctx as CtxWithSpacing;
  ctx.globalAlpha = opacity;
  if (!setTextFill(ctx, cs, box)) return;
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  applyTextShadow(ctx, cs.textShadow, st.scale);

  const transform = cs.textTransform;
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (st.words >= st.maxWords) break;
    st.range.setStart(node, m.index);
    st.range.setEnd(node, m.index + m[0].length);
    const rects = st.range.getClientRects();
    if (rects.length === 0) continue;
    const wordBox = rects[0];
    if (!overlaps(wordBox, st.clip)) continue;
    const word = applyTextTransform(m[0], transform);
    const ascent = ctx.measureText(word).fontBoundingBoxAscent;
    ctx.fillText(word, wordBox.left, wordBox.top + (Number.isFinite(ascent) ? ascent : wordBox.height * 0.8));
    st.words += 1;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/** Text colour, or the element's gradient for background-clip: text. False when invisible. */
function setTextFill(ctx: Ctx, cs: CSSStyleDeclaration, box: DOMRect): boolean {
  if (colorAlpha(cs.color) > 0) return setFill(ctx, cs.color);
  if (!isTextClipped(cs) || !cs.backgroundImage || cs.backgroundImage === 'none') return false;
  const g = parseGradient(cs.backgroundImage);
  if (!g) return false;
  try {
    if (g.kind === 'linear') {
      ctx.fillStyle = linearGradientFor(ctx, g, box);
      return true;
    }
    return setFill(ctx, g.stops[0].color);
  } catch {
    return false;
  }
}

function applyTextTransform(word: string, transform: string): string {
  if (transform === 'uppercase') return word.toUpperCase();
  if (transform === 'lowercase') return word.toLowerCase();
  if (transform === 'capitalize') return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}

function applyTextShadow(ctx: Ctx, shadow: string, scale: number): void {
  if (!shadow || shadow === 'none') return;
  const first = splitTopLevel(shadow)[0]?.trim() ?? '';
  const colorMatch = /^([a-z-]+\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+)/i.exec(first);
  if (!colorMatch) return;
  const lengths = first
    .slice(colorMatch[0].length)
    .trim()
    .split(/\s+/)
    .map((v) => parseFloat(v))
    .filter((v) => Number.isFinite(v));
  if (lengths.length < 2) return;
  ctx.shadowColor = colorMatch[0];
  ctx.shadowOffsetX = lengths[0] * scale;
  ctx.shadowOffsetY = lengths[1] * scale;
  ctx.shadowBlur = (lengths[2] ?? 0) * scale;
}

// ─── Replaced elements ───

function paintReplaced(ctx: Ctx, el: HTMLCanvasElement | HTMLImageElement, r: DOMRect): void {
  try {
    if (el instanceof HTMLCanvasElement) {
      if (el.width > 0 && el.height > 0) ctx.drawImage(el, r.left, r.top, r.width, r.height);
    } else if (el.complete && el.naturalWidth > 0) {
      ctx.drawImage(el, r.left, r.top, r.width, r.height);
    }
  } catch {
    // Unreadable source (e.g. lost WebGL context): skip.
  }
}

function paintField(
  ctx: Ctx,
  el: HTMLInputElement | HTMLTextAreaElement,
  cs: CSSStyleDeclaration,
  r: DOMRect,
  opacity: number
): void {
  if (el instanceof HTMLInputElement && !TEXT_INPUT_TYPES.has(el.type)) return;
  const isPassword = el instanceof HTMLInputElement && el.type === 'password';
  let text = isPassword ? '•'.repeat(el.value.length) : el.value;
  let color = cs.color;
  if (!text && el.placeholder) {
    text = el.placeholder;
    color = getComputedStyle(el, '::placeholder').color || cs.color;
  }
  if (!text || colorAlpha(color) <= 0) return;
  const left = r.left + num(cs.borderLeftWidth, 0) + num(cs.paddingLeft, 0);
  const right = r.right - num(cs.borderRightWidth, 0) - num(cs.paddingRight, 0);
  const fontSize = num(cs.fontSize, 14);
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, r.top, Math.max(0, right - left), r.height);
  ctx.clip();
  ctx.globalAlpha = opacity;
  if (setFill(ctx, color)) {
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.textBaseline = 'middle';
    const y =
      el instanceof HTMLTextAreaElement
        ? r.top + num(cs.borderTopWidth, 0) + num(cs.paddingTop, 0) + fontSize * 0.7
        : r.top + r.height / 2;
    ctx.fillText(text.split('\n')[0], left, y);
  }
  ctx.restore();
}

// ─── Inline SVG (icons) ───

function paintSvg(ctx: Ctx, svg: SVGSVGElement, cs: CSSStyleDeclaration, r: DOMRect, opacity: number): void {
  const layoutW = svg.clientWidth || r.width;
  const layoutH = svg.clientHeight || r.height;
  const vb = svg.viewBox?.baseVal;
  const hasViewBox = !!vb && vb.width > 0 && vb.height > 0;
  const vw = hasViewBox ? vb.width : layoutW;
  const vh = hasViewBox ? vb.height : layoutH;
  const vx = hasViewBox ? vb.x : 0;
  const vy = hasViewBox ? vb.y : 0;
  const s = Math.min(layoutW / vw, layoutH / vh);
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  ctx.save();
  ctx.translate(cx, cy);
  const matrix = /^matrix\(([^)]+)\)$/.exec(cs.transform);
  if (matrix) {
    const [a, b, c, d] = matrix[1].split(',').map((v) => parseFloat(v));
    if ([a, b, c, d].every((v) => Number.isFinite(v))) ctx.transform(a, b, c, d, 0, 0);
  }
  ctx.scale(s, s);
  ctx.translate(-vx - vw / 2, -vy - vh / 2);

  svg.querySelectorAll(SVG_SHAPES).forEach((shape) => {
    if (shape.closest(SVG_HIDDEN_ANCESTORS)) return;
    const path = toPath2D(shape);
    if (!path) return;
    const scs = getComputedStyle(shape);
    if (scs.display === 'none' || scs.visibility === 'hidden') return;
    const shapeAlpha = opacity * num(scs.opacity, 1);
    const fill = resolvePaint(scs.fill, svg);
    const stroke = resolvePaint(scs.stroke, svg);
    if (fill) {
      ctx.globalAlpha = shapeAlpha * num(scs.fillOpacity, 1);
      if (setFill(ctx, fill)) ctx.fill(path, scs.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
    }
    if (stroke && setStroke(ctx, stroke)) {
      ctx.globalAlpha = shapeAlpha * num(scs.strokeOpacity, 1);
      ctx.lineWidth = num(scs.strokeWidth, 1);
      ctx.lineCap = scs.strokeLinecap === 'round' || scs.strokeLinecap === 'square' ? scs.strokeLinecap : 'butt';
      ctx.lineJoin = scs.strokeLinejoin === 'round' || scs.strokeLinejoin === 'bevel' ? scs.strokeLinejoin : 'miter';
      const dash = scs.strokeDasharray;
      if (dash && dash !== 'none') {
        ctx.setLineDash(dash.split(/[\s,]+/).map((v) => parseFloat(v)).filter((v) => Number.isFinite(v)));
        ctx.lineDashOffset = num(scs.strokeDashoffset, 0);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke(path);
    }
  });
  ctx.restore();
}

function toPath2D(shape: Element): Path2D | null {
  const p = new Path2D();
  if (shape instanceof SVGPathElement) {
    const d = shape.getAttribute('d');
    return d ? new Path2D(d) : null;
  }
  if (shape instanceof SVGCircleElement) {
    p.arc(shape.cx.baseVal.value, shape.cy.baseVal.value, shape.r.baseVal.value, 0, Math.PI * 2);
    return p;
  }
  if (shape instanceof SVGEllipseElement) {
    p.ellipse(
      shape.cx.baseVal.value,
      shape.cy.baseVal.value,
      shape.rx.baseVal.value,
      shape.ry.baseVal.value,
      0,
      0,
      Math.PI * 2
    );
    return p;
  }
  if (shape instanceof SVGRectElement) {
    roundRectPath(
      p,
      shape.x.baseVal.value,
      shape.y.baseVal.value,
      shape.width.baseVal.value,
      shape.height.baseVal.value,
      shape.rx.baseVal.value
    );
    return p;
  }
  if (shape instanceof SVGLineElement) {
    p.moveTo(shape.x1.baseVal.value, shape.y1.baseVal.value);
    p.lineTo(shape.x2.baseVal.value, shape.y2.baseVal.value);
    return p;
  }
  if (shape instanceof SVGPolylineElement || shape instanceof SVGPolygonElement) {
    const nums = (shape.getAttribute('points') ?? '')
      .trim()
      .split(/[\s,]+/)
      .map((v) => parseFloat(v))
      .filter((v) => Number.isFinite(v));
    if (nums.length < 4) return null;
    p.moveTo(nums[0], nums[1]);
    for (let i = 2; i + 1 < nums.length; i += 2) p.lineTo(nums[i], nums[i + 1]);
    if (shape instanceof SVGPolygonElement) p.closePath();
    return p;
  }
  return null;
}

/** 'none' → null, url(#gradient) → its first stop colour, anything else as-is. */
function resolvePaint(paint: string, svg: SVGSVGElement): string | null {
  if (!paint || paint === 'none') return null;
  const ref = /url\(["']?#([^"')]+)["']?\)/.exec(paint);
  if (!ref) return paint;
  const target = svg.ownerDocument.getElementById(ref[1]);
  const stop = target?.querySelector('stop');
  return stop ? getComputedStyle(stop).stopColor || null : null;
}

// ─── Clip paths ───

function applyClipPath(ctx: Ctx, clipPath: string, r: DOMRect): void {
  const poly = /^polygon\((.*)\)$/i.exec(clipPath.trim());
  if (poly) {
    const points = splitTopLevel(poly[1]).map((pair) => {
      const [x, y] = pair.trim().split(/\s+/);
      return { x: r.left + lengthIn(x, r.width), y: r.top + lengthIn(y, r.height) };
    });
    if (points.length < 3 || points.some((pt) => !Number.isFinite(pt.x) || !Number.isFinite(pt.y))) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.clip();
    return;
  }
  const inset = /^inset\(([^)]*)\)$/i.exec(clipPath.trim());
  if (inset) {
    const v = inset[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
    const top = lengthIn(v[0], r.height);
    const right = lengthIn(v[1] ?? v[0], r.width);
    const bottom = lengthIn(v[2] ?? v[0], r.height);
    const left = lengthIn(v[3] ?? v[1] ?? v[0], r.width);
    if (![top, right, bottom, left].every((n) => Number.isFinite(n))) return;
    ctx.beginPath();
    ctx.rect(r.left + left, r.top + top, r.width - left - right, r.height - top - bottom);
    ctx.clip();
  }
}

function lengthIn(value: string | undefined, basis: number): number {
  if (!value) return NaN;
  if (value.endsWith('%')) return (parseFloat(value) / 100) * basis;
  return parseFloat(value);
}

// ─── Small helpers ───

function num(value: string, fallback: number): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function overlaps(a: RasterRect | DOMRect, b: RasterRect): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

function intersect(a: RasterRect, b: RasterRect | DOMRect): RasterRect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function cornerRadius(value: string, r: RasterRect | DOMRect): number {
  const first = (value || '0').trim().split(/\s+/)[0];
  const raw = first.endsWith('%') ? (parseFloat(first) / 100) * Math.min(r.width, r.height) : parseFloat(first);
  return Number.isFinite(raw) ? Math.max(0, Math.min(raw, r.width / 2, r.height / 2)) : 0;
}

/** Alpha of a computed CSS colour (rgb/rgba, modern "/ a" syntax, transparent). */
export function colorAlpha(color: string): number {
  if (!color || color === 'transparent') return 0;
  const slash = /\/\s*([\d.]+)(%?)\s*\)\s*$/.exec(color);
  if (slash) return parseFloat(slash[1]) / (slash[2] ? 100 : 1);
  const rgba = /^rgba\(([^)]*)\)/i.exec(color);
  if (rgba) {
    const parts = rgba[1].split(',');
    return parts.length === 4 ? parseFloat(parts[3]) : 1;
  }
  return 1;
}

const SENTINEL = '#010203';

/** Assigns a CSS colour, reporting whether the canvas accepted it. */
function setFill(ctx: Ctx, color: string): boolean {
  ctx.fillStyle = SENTINEL;
  ctx.fillStyle = color;
  return ctx.fillStyle !== SENTINEL;
}

function setStroke(ctx: Ctx, color: string): boolean {
  ctx.strokeStyle = SENTINEL;
  ctx.strokeStyle = color;
  return ctx.strokeStyle !== SENTINEL;
}

function fillShape(ctx: Ctx, r: RasterRect | DOMRect, radius: number): void {
  ctx.beginPath();
  if (radius > 0.5) roundRectPath(ctx, r.left, r.top, r.width, r.height, radius);
  else ctx.rect(r.left, r.top, r.width, r.height);
  ctx.fill();
}

export function roundRectPath(
  path: CanvasPath,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const rr = Math.max(0, Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2));
  path.moveTo(x + rr, y);
  path.arcTo(x + w, y, x + w, y + h, rr);
  path.arcTo(x + w, y + h, x, y + h, rr);
  path.arcTo(x, y + h, x, y, rr);
  path.arcTo(x, y, x + w, y, rr);
  path.closePath();
}
