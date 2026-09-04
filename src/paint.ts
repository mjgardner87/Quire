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

/** A mark on the sheet, with the strip of the flow it occupies, before any page is chosen. */
interface Mark {
  readonly draw: (offset: number) => Item;
  readonly top: number;
  readonly bottom: number;
  /** Marks sharing a group are never split across a page break. */
  group: number;
}

/** The nearest block that has to stay whole: a career entry, a bullet, a kept run. */
const ATOMIC = '.entry, .keep, li, .crit .head, .entry .head';

function atomicGroup(el: Element | null, root: HTMLElement, ids: Map<Element, number>, next: () => number): number {
  for (let at = el; at && at !== root; at = at.parentElement) {
    if (!at.matches(ATOMIC)) continue;
    let id = ids.get(at);
    if (id === undefined) { id = next(); ids.set(at, id); }
    return id;
  }
  return next();
}

/** Every filled box the document draws: backgrounds, and each visible border edge. */
function boxMarks(el: Element, origin: DOMRect, geo: Geometry, group: number, out: Mark[]): void {
  const style = getComputedStyle(el);
  const bg = toColour(style.backgroundColor);
  const edges: readonly [number, string, string][] = [
    [0, 'border-top-width', 'border-top-color'], [1, 'border-right-width', 'border-right-color'],
    [2, 'border-bottom-width', 'border-bottom-color'], [3, 'border-left-width', 'border-left-color'],
  ];
  for (const rect of el.getClientRects()) {
    const x = rect.left - origin.left;
    const top = rect.top - origin.top;
    const push = (dx: number, dy: number, w: number, h: number, rgb: Colour): void => {
      if (w <= 0 || h <= 0) return;
      out.push({
        top: top + dy, bottom: top + dy + h, group,
        draw: (offset) => ({
          kind: 'rect',
          x: (geo.marginSide + x + dx) * PT,
          y: (geo.marginTop + geo.contentH - (top + dy - offset) - h) * PT,
          w: w * PT, h: h * PT, colour: rgb,
        }),
      });
    };
    if (bg.alpha > 0.01) push(0, 0, rect.width, rect.height, bg.rgb);
    for (const [i, widthProp, colourProp] of edges) {
      const w = parseFloat(style.getPropertyValue(widthProp));
      if (!w) continue;
      const c = toColour(style.getPropertyValue(colourProp));
      if (c.alpha < 0.01) continue;
      if (i === 0) push(0, 0, rect.width, w, c.rgb);
      if (i === 1) push(rect.width - w, 0, w, rect.height, c.rgb);
      if (i === 2) push(0, rect.height - w, rect.width, w, c.rgb);
      if (i === 3) push(0, 0, w, rect.height, c.rgb);
    }
  }
}

/** The string the browser painted, which is not the source text when a rule transforms it. */
export function transformed(text: string, transform: string): string {
  if (transform.startsWith('uppercase')) return text.toUpperCase();
  if (transform.startsWith('lowercase')) return text.toLowerCase();
  if (transform.startsWith('capitalize')) return text.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());
  return text;
}

/** One laid-out line, to be drawn at the baseline the browser put it on. */
function textMark(line: Line, origin: DOMRect, geo: Geometry, group: number, out: Mark[]): void {
  const size = parseFloat(line.style.fontSize);
  const weight = parseInt(line.style.fontWeight, 10) || 400;
  const face = faceFor(line.style.fontFamily.split(',')[0] ?? '', weight, line.style.fontStyle === 'italic');
  const metrics = FACES[face];
  const ascent = metrics.ascent / (metrics.ascent - metrics.descent);
  const tracking = parseFloat(line.style.letterSpacing) || 0;
  const colour = toColour(line.style.color);
  const x = line.rect.left - origin.left;
  const top = line.rect.top - origin.top;
  const text = transformed(line.text, line.style.textTransform);
  out.push({
    top, bottom: top + line.rect.height, group,
    draw: (offset) => ({
      kind: 'text',
      x: (geo.marginSide + x) * PT,
      y: (geo.marginTop + geo.contentH - (top - offset) - line.rect.height * ascent) * PT,
      size: size * PT,
      face,
      colour: colour.rgb,
      text,
      tracking: tracking * PT,
    }),
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

/**
 * Draw the running header and footer.
 *
 * Each line is centred in its margin band, which is where the print stylesheet's `@page` margin
 * boxes put it, so an exported sheet and a printed one read the same. Measuring the line from the
 * content edge instead put the header 4.5pt inside the content box, on top of the first line of a
 * full sheet, and the footer 1.4pt inside the foot of it.
 */
function runningItems(doc: QDocument, date: string, geo: Geometry, pages: Item[][]): void {
  const size = 7.6;
  const colour = toColour('#6a7178').rgb;
  const tracking = 0.02 * size;
  const metrics = FACES.sans;
  const em = metrics.ascent - metrics.descent;
  /** The margin band, and the baseline measured down from the top of one, in points. */
  const band = geo.marginTop * PT;
  const baseline = (band - size * em / 1000) / 2 + size * metrics.ascent / 1000;
  const sheet = (geo.marginTop * 2 + geo.contentH) * PT;
  pages.forEach((items, i) => {
    if (i === 0 && !doc.running.firstPage) return;
    const slots: readonly [Slots, number][] = [
      [doc.running.header, sheet - baseline],
      [doc.running.footer, band - baseline],
    ];
    for (const [set, y] of slots) {
      for (const [slot, align] of [['left', 0], ['centre', 0.5], ['right', 1]] as const) {
        const text = slotText(set[slot], doc, date, i + 1, pages.length);
        if (!text.trim()) continue;
        const w = textWidth(text, 'sans', size, tracking);
        items.push({
          kind: 'text', face: 'sans', size, colour, text, tracking,
          x: geo.marginSide * PT + (geo.contentW * PT - w) * align,
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
 * A career entry lays its date column out as a float. A float makes the entry's marks overlap in
 * the flow in ways that are awkward to keep whole, and a grid says the same thing plainly.
 */
function squareEntries(root: HTMLElement): void {
  for (const entry of root.querySelectorAll<HTMLElement>('.entry')) {
    const when = entry.querySelector<HTMLElement>(':scope > .when');
    const what = entry.querySelector<HTMLElement>(':scope > .what');
    if (!when || !what) continue;
    const width = getComputedStyle(when).width;
    const indent = parseFloat(getComputedStyle(what).marginLeft) - parseFloat(width);
    entry.style.display = 'grid';
    entry.style.gridTemplateColumns = `${width} 1fr`;
    entry.style.columnGap = `${Math.max(0, indent)}px`;
    when.style.float = 'none';
    when.style.width = 'auto';
    what.style.marginLeft = '0';
    const clear = entry.querySelector<HTMLElement>(':scope > [data-quire-pseudo="::after"]');
    if (clear) clear.style.display = 'none';
  }
}

/**
 * Pack the marks into pages.
 *
 * Quire does its own page breaks rather than ask the browser for them. CSS multi-column looked
 * like a free paginator, but neither engine keeps every fragment inside its column: Chromium
 * overflows rather than break a float, Gecko overflows too and ignores a forced column break, and
 * an overflowing line is not moved to the next page, it is drawn off the foot of this one and
 * lost. Laying the document out in one flow and cutting it here is the same in every browser.
 */
export function packPages(marks: readonly Mark[], contentH: number): Item[][] {
  if (!marks.length) return [[]];
  // Marks that overlap in the flow belong together: a name and the contact block beside it, or
  // the two halves of a two-column block, cannot be split by a horizontal cut.
  const order = [...marks].sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  const spans = new Map<number, { top: number; bottom: number }>();
  for (const mark of order) {
    const span = spans.get(mark.group);
    if (span) { span.top = Math.min(span.top, mark.top); span.bottom = Math.max(span.bottom, mark.bottom); }
    else spans.set(mark.group, { top: mark.top, bottom: mark.bottom });
  }
  const units: { top: number; bottom: number; groups: Set<number> }[] = [];
  for (const [group, span] of [...spans.entries()].sort((a, b) => a[1].top - b[1].top)) {
    const last = units[units.length - 1];
    if (last && span.top < last.bottom - 0.5) {
      last.bottom = Math.max(last.bottom, span.bottom);
      last.groups.add(group);
    } else units.push({ top: span.top, bottom: span.bottom, groups: new Set([group]) });
  }
  const offsetOf = new Map<number, number>();
  const pageOf = new Map<number, number>();
  let page = 0;
  let offset = 0;
  for (const unit of units) {
    // A unit taller than the sheet has to run on; anything else that will not fit starts a page.
    if (unit.bottom - offset > contentH && unit.top - offset > 0.5 && unit.bottom - unit.top <= contentH) {
      page += 1;
      offset = unit.top;
    }
    for (const group of unit.groups) { offsetOf.set(group, offset); pageOf.set(group, page); }
  }
  const pages: Item[][] = Array.from({ length: page + 1 }, () => []);
  for (const mark of order) {
    const at = pageOf.get(mark.group) ?? 0;
    pages[at]?.push(mark.draw(offsetOf.get(mark.group) ?? 0));
  }
  return pages;
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
  const holder = document.createElement('div');
  holder.className = sheet.className;
  holder.setAttribute('data-quire-export', '');
  holder.style.cssText = 'position:fixed;left:-99999px;top:0;margin:0;padding:0;border:0;'
    + `box-shadow:none;width:${geo.contentW}px;height:auto;overflow:visible;`;
  // Typeset the clone in the faces the PDF embeds. The sheet may be set in XCharter or in a
  // fallback the machine happens to have, and text measured in one face and drawn in another
  // collides. This also makes the exported PDF identical on every machine.
  holder.style.setProperty('--font-body', `"${SERIF}", serif`);
  holder.style.setProperty('--font-label', `"${SANS}", sans-serif`);
  for (const child of [...sheet.children]) holder.append(child.cloneNode(true));
  document.body.append(holder);
  const suppress = document.createElement('style');
  document.head.append(suppress);
  try {
    holder.querySelectorAll(CHROME).forEach((el) => el.remove());
    materialisePseudos(holder, suppress);
    squareEntries(holder);
    const origin = holder.getBoundingClientRect();
    const marks: Mark[] = [];
    const ids = new Map<Element, number>();
    let counter = 0;
    const next = (): number => ++counter;
    const walker = document.createTreeWalker(holder, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        boxMarks(el, origin, geo, atomicGroup(el, holder, ids, next), marks);
        continue;
      }
      const text = node as Text;
      if (!text.data.trim() || !text.parentElement) continue;
      const style = getComputedStyle(text.parentElement);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const group = atomicGroup(text.parentElement, holder, ids, next);
      for (const line of linesOf(text, style)) textMark(line, origin, geo, group, marks);
    }
    const pages = packPages(marks, geo.contentH);
    runningItems(doc, date, geo, pages);
    return writePdf(pages.map((items): Page => ({ items })), A4);
  } finally {
    holder.remove();
    suppress.remove();
  }
}
