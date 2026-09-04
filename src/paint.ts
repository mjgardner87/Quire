/**
 * Turn the rendered document into PDF items.
 *
 * Nothing here re-lays-out the document. The sheet is cloned into a multi-column box one page
 * wide and one page tall, so the browser breaks it into columns under the same
 * `break-inside: avoid` rules the print stylesheet already declares. Each column is a page. Every
 * position is then read back from the laid-out clone, which is why the PDF matches the screen.
 *
 * The clone is typeset in the embedded faces, so what is measured is what is drawn, on any
 * machine and with no font installed.
 */
import { documentName, type Design, type QDocument, type Slots } from './model';
import { A4, textWidth, writePdf, type Colour, type FaceId, type Item, type Page } from './pdf';
import facesJSON from './fonts/faces.json';

const MM = 96 / 25.4;
/** CSS pixels to PostScript points. A CSS pixel is 1/96in and a point is 1/72in. */
const PT = 72 / 96;
const GAP = 80;
const SERIF = 'Quire Serif';
const SANS = 'Quire Sans';
/** Chrome that never belongs on paper. The print stylesheet hides it; the clone drops it. */
const CHROME = '.ctl, .wc, .guide, .adder, .drop';

interface FaceData { readonly data: string; readonly ascent: number; readonly descent: number }
const FACES = facesJSON as unknown as Record<FaceId, FaceData>;
const CSS_FACES: readonly [FaceId, string, number, string][] = [
  ['serif', SERIF, 400, 'normal'], ['serif-bold', SERIF, 600, 'normal'], ['serif-italic', SERIF, 400, 'italic'],
  ['sans', SANS, 400, 'normal'], ['sans-medium', SANS, 500, 'normal'], ['sans-bold', SANS, 600, 'normal'],
  ['sans-italic', SANS, 400, 'italic'],
];

let loaded: Promise<void> | null = null;
/** Register the embedded faces with the document, once. Measurement then matches the PDF. */
export function loadFaces(): Promise<void> {
  loaded ??= Promise.all(CSS_FACES.map(async ([id, family, weight, style]) => {
    const bin = atob(FACES[id].data);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const face = new FontFace(family, buf.buffer as ArrayBuffer, { weight: String(weight), style });
    await face.load();
    document.fonts.add(face);
  })).then(() => undefined);
  return loaded;
}

/** The face for a run of text, from the family, weight and style the browser resolved. */
export function faceFor(family: string, weight: number, italic: boolean): FaceId {
  const serif = !/^["']?(Inter|system-ui|Quire Sans|-apple-system|Segoe UI)/i.test(family.trim());
  if (serif) return italic ? 'serif-italic' : weight >= 500 ? 'serif-bold' : 'serif';
  if (italic) return 'sans-italic';
  return weight >= 600 ? 'sans-bold' : weight >= 500 ? 'sans-medium' : 'sans';
}

let probe: CanvasRenderingContext2D | null = null;
/** Any CSS colour as sRGB in 0 to 1, with its alpha. The canvas does the parsing, including oklch. */
export function toColour(css: string): { rgb: Colour; alpha: number } {
  probe ??= document.createElement('canvas').getContext('2d');
  if (!probe) return { rgb: [0, 0, 0], alpha: 1 };
  probe.fillStyle = '#000';
  probe.fillStyle = css;
  const v = probe.fillStyle as string;
  if (v.startsWith('#')) {
    const n = parseInt(v.slice(1), 16);
    return { rgb: [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255], alpha: 1 };
  }
  const parts = /rgba?\(([^)]+)\)/.exec(v)?.[1]?.split(',').map((p) => parseFloat(p)) ?? [0, 0, 0, 1];
  return { rgb: [(parts[0] ?? 0) / 255, (parts[1] ?? 0) / 255, (parts[2] ?? 0) / 255], alpha: parts[3] ?? 1 };
}

interface Geometry { readonly contentW: number; readonly contentH: number; readonly marginTop: number; readonly marginSide: number }

/** One line of text as the browser laid it out: its box, its string and the style that drew it. */
interface Line { readonly rect: DOMRect; readonly text: string; readonly style: CSSStyleDeclaration }

/** Split a text node into the lines the browser broke it into, with each line's own box. */
function linesOf(node: Text, style: CSSStyleDeclaration): Line[] {
  const text = node.data;
  const out: Line[] = [];
  const range = document.createRange();
  let start = 0;
  let top: number | null = null;
  let left = 0;
  const flush = (end: number, rect: DOMRect | null): void => {
    const slice = text.slice(start, end).replace(/\s+$/, '');
    if (rect && slice.trim()) out.push({ rect, text: slice, style });
    start = end;
  };
  let current: DOMRect | null = null;
  for (let i = 0; i < text.length; i++) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (top === null || Math.abs(r.top - top) > 1 || r.left < left - 1) {
      flush(i, current);
      top = r.top;
      current = r;
    } else if (current) {
      current = new DOMRect(current.x, Math.min(current.y, r.y), r.right - current.x, Math.max(current.height, r.height));
    }
    left = r.left;
  }
  flush(text.length, current);
  return out;
}

/** Which column a box sits in, and its position inside that column. */
function place(rect: DOMRect, origin: DOMRect, geo: Geometry): { page: number; x: number; y: number } {
  const x = rect.left - origin.left;
  // Columns start at k * (width + gap). Floor, never round: rounding sends everything past the
  // half-way mark of a column, such as a right-aligned contact block, to the next page. The
  // pitch is fractional, so a column's own left edge can measure a hair under k * pitch and
  // floor it back to the page before. One pixel of tolerance costs nothing against an 80px gap.
  const pitch = geo.contentW + GAP;
  const page = Math.max(0, Math.floor((x + 1) / pitch));
  return { page, x: x - page * pitch, y: rect.top - origin.top };
}

/** Every filled box the document draws: backgrounds, and each visible border edge. */
function boxItems(el: Element, origin: DOMRect, geo: Geometry, pages: Item[][]): void {
  const style = getComputedStyle(el);
  const rects = [...el.getClientRects()];
  if (!rects.length) return;
  const bg = toColour(style.backgroundColor);
  const edges: readonly [string, string][] = [
    ['borderTopWidth', 'borderTopColor'], ['borderRightWidth', 'borderRightColor'],
    ['borderBottomWidth', 'borderBottomColor'], ['borderLeftWidth', 'borderLeftColor'],
  ];
  for (const rect of rects) {
    const at = place(rect, origin, geo);
    const target = pages[at.page];
    if (!target) continue;
    const toPdf = (x: number, y: number, w: number, h: number, rgb: Colour): Item => ({
      kind: 'rect',
      x: (geo.marginSide + x) * PT,
      y: (geo.marginTop + geo.contentH - y - h) * PT,
      w: w * PT, h: h * PT, colour: rgb,
    });
    if (bg.alpha > 0.01) target.push(toPdf(at.x, at.y, rect.width, rect.height, bg.rgb));
    edges.forEach(([widthProp, colourProp], i) => {
      const w = parseFloat(style.getPropertyValue(widthProp.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())));
      if (!w) return;
      const c = toColour(style.getPropertyValue(colourProp.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase())));
      if (c.alpha < 0.01) return;
      if (i === 0) target.push(toPdf(at.x, at.y, rect.width, w, c.rgb));
      if (i === 1) target.push(toPdf(at.x + rect.width - w, at.y, w, rect.height, c.rgb));
      if (i === 2) target.push(toPdf(at.x, at.y + rect.height - w, rect.width, w, c.rgb));
      if (i === 3) target.push(toPdf(at.x, at.y, w, rect.height, c.rgb));
    });
  }
}

/** The string the browser painted, which is not the source text when a rule transforms it. */
export function transformed(text: string, transform: string): string {
  if (transform.startsWith('uppercase')) return text.toUpperCase();
  if (transform.startsWith('lowercase')) return text.toLowerCase();
  if (transform.startsWith('capitalize')) return text.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());
  return text;
}

/** Draw one laid-out line at the baseline the browser put it on. */
function textItem(line: Line, origin: DOMRect, geo: Geometry, pages: Item[][]): void {
  const at = place(line.rect, origin, geo);
  const target = pages[at.page];
  if (!target) return;
  const size = parseFloat(line.style.fontSize);
  const weight = parseInt(line.style.fontWeight, 10) || 400;
  const face = faceFor(line.style.fontFamily.split(',')[0] ?? '', weight, line.style.fontStyle === 'italic');
  const metrics = FACES[face];
  const ascent = metrics.ascent / (metrics.ascent - metrics.descent);
  const tracking = parseFloat(line.style.letterSpacing) || 0;
  const colour = toColour(line.style.color);
  target.push({
    kind: 'text',
    x: (geo.marginSide + at.x) * PT,
    y: (geo.marginTop + geo.contentH - at.y - line.rect.height * ascent) * PT,
    size: size * PT,
    face,
    colour: colour.rgb,
    text: transformed(line.text, line.style.textTransform),
    tracking: tracking * PT,
  });
}

/** The running text for one slot on one page, with its tokens filled in. */
export function slotText(template: string, doc: QDocument, date: string, page: number, pages: number): string {
  return template
    .replace(/\{name\}/g, documentName(doc))
    .replace(/\{title\}/g, doc.title)
    .replace(/\{date\}/g, date)
    .replace(/\{page\}/g, String(page))
    .replace(/\{pages\}/g, String(pages));
}

function runningItems(doc: QDocument, date: string, geo: Geometry, pages: Item[][]): void {
  const size = 7.6;
  const colour = toColour('#6a7178').rgb;
  const tracking = 0.02 * size;
  pages.forEach((items, i) => {
    if (i === 0 && !doc.running.firstPage) return;
    const slots: readonly [Slots, number][] = [
      [doc.running.header, (geo.marginTop - 6) * PT + geo.contentH * PT],
      [doc.running.footer, (geo.marginTop - 8) * PT],
    ];
    for (const [set, y] of slots) {
      for (const [slot, align] of [['left', 0], ['centre', 0.5], ['right', 1]] as const) {
        const text = slotText(set[slot], doc, date, i + 1, pages.length);
        if (!text.trim()) continue;
        const w = textWidth(text, 'sans', size, tracking);
        const boxW = geo.contentW * PT;
        items.push({
          kind: 'text', face: 'sans', size, colour, text, tracking,
          x: geo.marginSide * PT + (boxW - w) * align,
          y,
        });
      }
    }
  });
}

/**
 * Give every ::before and ::after a real element carrying the same computed style. The accent
 * bar, the rule beside a heading, the dash before a bullet and the separator between skills are
 * all pseudo-elements, and a pseudo-element is not in the tree to be measured.
 */
function materialisePseudos(root: HTMLElement, suppress: HTMLStyleElement): void {
  const planned: { el: Element; which: '::before' | '::after'; span: HTMLSpanElement }[] = [];
  // Read every pseudo before changing anything: inserting one element re-lays-out the next.
  for (const el of [...root.querySelectorAll('*')]) {
    for (const which of ['::before', '::after'] as const) {
      const pseudo = getComputedStyle(el, which);
      const content = pseudo.content;
      if (!content || content === 'none' || content === 'normal') continue;
      const span = document.createElement('span');
      for (const prop of pseudo) span.style.setProperty(prop, pseudo.getPropertyValue(prop));
      span.style.removeProperty('content');
      const literal = /^"([\s\S]*)"$/.exec(content)?.[1];
      if (literal) span.textContent = literal;
      span.dataset.quirePseudo = which;
      planned.push({ el, which, span });
    }
  }
  // Switch the pseudos off before their stand-ins go in, or a heading draws its rule twice and
  // the two share the space between them.
  suppress.textContent = '[data-quire-export] *::before, [data-quire-export] *::after { content: none !important; }';
  for (const { el, which, span } of planned) {
    if (which === '::before') el.prepend(span); else el.append(span);
  }
}

/**
 * A career entry lays its date column out as a float. Chromium does not break a float cleanly at
 * a column edge: it overflows the column instead, and `break-inside: avoid` on the entry does not
 * stop it. The exporter keeps an entry whole, so the float is not needed and a grid can take its
 * place, which also stops a heading being orphaned from its bullets. An entry taller than most of
 * a page keeps the float and is allowed to break.
 */
function squareEntries(root: HTMLElement, geo: Geometry): void {
  for (const entry of root.querySelectorAll<HTMLElement>('.entry')) {
    if (entry.offsetHeight >= geo.contentH * 0.7) continue;
    const when = entry.querySelector<HTMLElement>(':scope > .when');
    const what = entry.querySelector<HTMLElement>(':scope > .what');
    if (!when || !what) continue;
    const width = getComputedStyle(when).width;
    const indent = parseFloat(getComputedStyle(what).marginLeft) - parseFloat(width);
    entry.style.display = 'grid';
    entry.style.gridTemplateColumns = `${width} 1fr`;
    entry.style.columnGap = `${Math.max(0, indent)}px`;
    entry.style.breakInside = 'avoid';
    when.style.float = 'none';
    when.style.width = 'auto';
    what.style.marginLeft = '0';
    const clear = entry.querySelector<HTMLElement>(':scope > [data-quire-pseudo="::after"]');
    if (clear) clear.style.display = 'none';
  }
}

/** Build the offscreen clone the browser paginates for us, and hand back its column count. */
function paginate(sheet: HTMLElement, geo: Geometry): { holder: HTMLElement; suppress: HTMLStyleElement; columns: number; origin: DOMRect } {
  const holder = document.createElement('div');
  holder.className = sheet.className;
  holder.setAttribute('data-quire-export', '');
  holder.style.cssText = `position:fixed;left:-99999px;top:0;margin:0;padding:0;border:0;box-shadow:none;`
    + `width:${geo.contentW}px;height:${geo.contentH}px;column-width:${geo.contentW}px;column-gap:${GAP}px;`
    + `column-fill:auto;overflow:visible;`;
  // Typeset the clone in the faces the PDF embeds. The sheet may be set in XCharter or in a
  // fallback the machine happens to have, and text measured in one face and drawn in another
  // collides. This also makes the exported PDF identical on every machine.
  holder.style.setProperty('--font-body', `"${SERIF}", serif`);
  holder.style.setProperty('--font-label', `"${SANS}", sans-serif`);
  for (const child of [...sheet.children]) holder.append(child.cloneNode(true));
  document.body.append(holder);
  holder.querySelectorAll(CHROME).forEach((el) => el.remove());
  holder.querySelectorAll<HTMLElement>('.pb').forEach((el) => { el.style.breakBefore = 'column'; });
  const suppress = document.createElement('style');
  document.head.append(suppress);
  materialisePseudos(holder, suppress);
  squareEntries(holder, geo);
  const columns = Math.max(1, Math.round((holder.scrollWidth + GAP) / (geo.contentW + GAP)));
  return { holder, suppress, columns, origin: holder.getBoundingClientRect() };
}

/** The whole document as PDF bytes, laid out exactly as the sheet on screen. */
export async function exportPdf(sheet: HTMLElement, design: Design, doc: QDocument, date: string): Promise<Uint8Array> {
  await loadFaces();
  await document.fonts.ready;
  const geo: Geometry = {
    marginTop: design.marginTop * MM,
    marginSide: design.marginSide * MM,
    contentW: (210 - 2 * design.marginSide) * MM,
    contentH: (297 - 2 * design.marginTop) * MM,
  };
  const { holder, suppress, columns, origin } = paginate(sheet, geo);
  try {
    const pages: Item[][] = Array.from({ length: columns }, () => []);
    const walker = document.createTreeWalker(holder, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.ELEMENT_NODE) { boxItems(node as Element, origin, geo, pages); continue; }
      const text = node as Text;
      if (!text.data.trim() || !text.parentElement) continue;
      const style = getComputedStyle(text.parentElement);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      for (const line of linesOf(text, style)) textItem(line, origin, geo, pages);
    }
    runningItems(doc, date, geo, pages);
    return writePdf(pages.map((items): Page => ({ items })), A4);
  } finally {
    holder.remove();
    suppress.remove();
  }
}
