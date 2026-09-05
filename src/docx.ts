/**
 * The Word file. Some portals will not take a PDF, and a panel sometimes asks for a document it
 * can comment in. This writes the same words, the same structure and the same emphasis into a
 * .docx that Word and LibreOffice open, in the document's own type, colour and margins.
 *
 * It is not a second design. Word owns the line breaking and the pagination here, so what this
 * produces is the document's structure, not its typesetting. Export PDF stays the way an
 * application is sent.
 *
 * No DOM and no dependency, so Vitest runs it in Node. The archive is stored, not deflated: a
 * stored zip is what the format allows, it holds a job application in well under a megabyte, and
 * it keeps this module synchronous and free of a compression stream a browser may not have.
 */

import {
  criterionLabel, documentName, tokenise,
  type Block, type Design, type QDocument, type Slots, type Token,
} from './model';

/* ------------------------------------------------------------------ */
/* The archive                                                          */
/* ------------------------------------------------------------------ */

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A growing byte string. Parts are kept whole: spreading a part into push overflows the stack. */
class Bytes {
  private parts: Uint8Array[] = [];
  length = 0;
  num(...n: number[]): void { this.add(Uint8Array.from(n)); }
  add(a: Uint8Array): void { this.parts.push(a); this.length += a.length; }
  done(): Uint8Array {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const p of this.parts) { out.set(p, at); at += p.length; }
    return out;
  }
}

interface Entry { name: string; data: Uint8Array }

/** The DOS epoch. A fixed stamp, so the same document exports the same bytes twice. */
const DOS_DATE = 0x0021;
const DOS_TIME = 0x0000;

const u16 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

/** A stored zip: a local header for each part, then the central directory and the end record. */
function zip(entries: readonly Entry[]): Uint8Array {
  const out = new Bytes();
  const central = new Bytes();
  for (const e of entries) {
    const name = new TextEncoder().encode(e.name);
    const at = out.length;
    // 0x0800 says the name is UTF-8. Every name here is ASCII, so it only states the fact.
    const shared = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc32(e.data)), ...u32(e.data.length), ...u32(e.data.length), ...u16(name.length)];
    out.num(0x50, 0x4b, 0x03, 0x04, ...shared, ...u16(0));
    out.add(name);
    out.add(e.data);
    central.num(0x50, 0x4b, 0x01, 0x02, ...u16(20), ...shared,
      ...u16(0), // extra field
      ...u16(0), // comment
      ...u16(0), // first disk
      ...u16(0), // internal attributes
      ...u32(0), // external attributes
      ...u32(at));
    central.add(name);
  }
  const start = out.length;
  const size = central.length;
  out.add(central.done());
  out.num(0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length), ...u32(size), ...u32(start), ...u16(0));
  return out.done();
}

/* ------------------------------------------------------------------ */
/* XML                                                                  */
/* ------------------------------------------------------------------ */

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Escape the markup characters and drop the control codes XML 1.0 forbids. */
function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const file = (name: string, xml: string): Entry => ({ name, data: new TextEncoder().encode(xml) });

/* ------------------------------------------------------------------ */
/* Measures and colours                                                 */
/* ------------------------------------------------------------------ */

/** Twips: a twentieth of a point, which is what Word measures a page in. */
const mm = (n: number): number => Math.round(n * 1440 / 25.4);
/** Half-points, which is what Word measures type in. */
const hp = (pt: number): number => Math.round(pt * 2);
const A4_WIDTH = mm(210);
const A4_HEIGHT = mm(297);

const INK = '1C2024';
const INK_2 = '3A4148';
const MUTED = '6A7178';
const RULE = 'D2D7DB';
const RULE_STRONG = '9AA3AA';
const FLAG = '9A4B00';
const FLAG_BG = 'FFF1DC';

const hex = (colour: string): string => colour.replace('#', '').toUpperCase();

/** The family Word should ask for, taken from the head of the design's own stack. */
const family = (id: string): string => (id === 'system-ui' ? 'Calibri' : id === 'XCharter' ? 'Charter' : id);

/* ------------------------------------------------------------------ */
/* Runs                                                                 */
/* ------------------------------------------------------------------ */

interface RunStyle {
  font?: string; size?: number; colour?: string; fill?: string;
  bold?: boolean; italic?: boolean; caps?: boolean; track?: number;
}

/** The children of w:rPr, in the order the schema declares them. */
function rPr(s: RunStyle): string {
  let x = '';
  if (s.font) x += `<w:rFonts w:ascii="${esc(s.font)}" w:hAnsi="${esc(s.font)}" w:cs="${esc(s.font)}"/>`;
  if (s.bold) x += '<w:b/>';
  if (s.italic) x += '<w:i/>';
  if (s.caps) x += '<w:caps/>';
  if (s.colour) x += `<w:color w:val="${s.colour}"/>`;
  if (s.track) x += `<w:spacing w:val="${s.track}"/>`;
  if (s.size) x += `<w:sz w:val="${s.size}"/><w:szCs w:val="${s.size}"/>`;
  if (s.fill) x += `<w:shd w:val="clear" w:color="auto" w:fill="${s.fill}"/>`;
  return x === '' ? '' : `<w:rPr>${x}</w:rPr>`;
}

/** One run. A newline in the model is a line break inside the paragraph, never a new one. */
function run(text: string, s: RunStyle = {}): string {
  const body = esc(text).split('\n')
    .map((part, i) => (i ? '<w:br/>' : '') + `<w:t xml:space="preserve">${part}</w:t>`).join('');
  return `<w:r>${rPr(s)}${body}</w:r>`;
}

/**
 * The author's text with the emphasis they typed. A flag keeps its brackets, its amber and its
 * tint: the point of a flag is that it cannot be missed in the document that gets sent.
 */
function runs(text: string, s: RunStyle = {}): string {
  return tokenise(text).map((t: Token) => {
    switch (t.kind) {
      case 'flag': return run(`[[${t.text}]]`, { ...s, colour: FLAG, fill: FLAG_BG });
      case 'bold': return run(t.text, { ...s, bold: true });
      case 'italic': return run(t.text, { ...s, italic: true });
      default: return run(t.text, s);
    }
  }).join('');
}

/* ------------------------------------------------------------------ */
/* Paragraphs and tables                                                */
/* ------------------------------------------------------------------ */

interface ParaOpts {
  style: string;
  breakBefore?: boolean;
  numId?: number;
  border?: string;
  tabs?: { pos: number; align: 'center' | 'right' }[];
  jc?: 'left' | 'right' | 'center';
  keepNext?: boolean;
}

/** The children of w:pPr, in the order the schema declares them. */
function para(content: string, o: ParaOpts): string {
  let p = `<w:pStyle w:val="${o.style}"/>`;
  if (o.keepNext) p += '<w:keepNext/>';
  if (o.breakBefore) p += '<w:pageBreakBefore/>';
  if (o.numId) p += `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${o.numId}"/></w:numPr>`;
  if (o.border) p += `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="${o.border}"/></w:pBdr>`;
  if (o.tabs?.length) p += `<w:tabs>${o.tabs.map((t) => `<w:tab w:val="${t.align}" w:pos="${t.pos}"/>`).join('')}</w:tabs>`;
  if (o.jc && o.jc !== 'left') p += `<w:jc w:val="${o.jc}"/>`;
  return `<w:p><w:pPr>${p}</w:pPr>${content}</w:p>`;
}

/** The hairline under a masthead. Word draws a rule as a border on an empty paragraph. */
const rule = (): string => para('', { style: 'Rule', border: RULE_STRONG });

/** A borderless table. It is how Word holds a hanging date column or a set of list columns. */
function table(widths: readonly number[], rows: readonly string[][]): string {
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  const body = rows.map((cells) => '<w:tr>' + cells.map((c, i) =>
    `<w:tc><w:tcPr><w:tcW w:w="${widths[i] ?? 0}" w:type="dxa"/></w:tcPr>${c || para('', { style: 'Body' })}</w:tc>`,
  ).join('') + '</w:tr>').join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/>' +
    '<w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
    `<w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
}

/* ------------------------------------------------------------------ */
/* The document body                                                    */
/* ------------------------------------------------------------------ */

interface Ctx { doc: QDocument; content: number }

function contactLines(b: { contact: string[] }, right: boolean): string {
  return b.contact.map((line, i) =>
    para(runs(line, i === 0 ? { bold: true, colour: INK } : {}), { style: 'Contact', jc: right ? 'right' : 'left' })).join('');
}

function masthead(b: Extract<Block, { type: 'masthead' }>, ctx: Ctx, brk: boolean): string {
  const left = para(runs(b.name), { style: 'Name', breakBefore: brk }) +
    (b.creds ? para(runs(b.creds), { style: 'Creds' }) : '') +
    (b.tagline ? para(runs(b.tagline), { style: 'Tagline' }) : '');
  if (ctx.doc.layout.contact === 'beside' && b.contact.length > 0) {
    const wide = Math.round(ctx.content * 0.62);
    return table([wide, ctx.content - wide], [[left, contactLines(b, true)]]) + rule();
  }
  return left + contactLines(b, false) + rule();
}

function entries(list: Extract<Block, { type: 'section' }>['entries'], ctx: Ctx): string {
  const when = mm(36);
  return (list ?? []).map((e) => {
    const left = para(runs(e.dates), { style: 'Dates' }) + (e.org ? para(runs(e.org), { style: 'Org' }) : '');
    const right = para(runs(e.title), { style: 'EntryTitle', keepNext: true }) +
      (e.context ? para(runs(e.context), { style: 'Context' }) : '') +
      e.bullets.map((t) => para(runs(t), { style: 'Bullet', numId: 2 })).join('');
    return table([when, ctx.content - when], [[left, right]]);
  }).join('');
}

function columns(list: Extract<Block, { type: 'section' }>['columns'], ctx: Ctx): string {
  const cols = list ?? [];
  if (cols.length === 0) return '';
  const width = Math.floor(ctx.content / cols.length);
  const beside = ctx.doc.layout.columnDetail === 'beside';
  const cells = cols.map((c) => para(runs(c.heading), { style: 'ColHeading', keepNext: true }) + c.items.map((it) => {
    if (!it.sub) return para(runs(it.text), { style: 'ColItem' });
    if (beside) {
      return para(runs(it.text) + '<w:r><w:tab/></w:r>' + runs(it.sub, { colour: MUTED }),
        { style: 'ColItem', tabs: [{ pos: width - mm(4), align: 'right' }] });
    }
    return para(runs(it.text), { style: 'ColItem' }) + para(runs(it.sub), { style: 'Sub' });
  }).join(''));
  return table(cols.map(() => width), [cells]);
}

function section(b: Extract<Block, { type: 'section' }>, ctx: Ctx, brk: boolean): string {
  let out = para(runs(b.heading), { style: 'SectionHeading', breakBefore: brk, keepNext: true, border: RULE });
  if (b.kind === 'prose') out += (b.paragraphs ?? []).map((p) => para(runs(p), { style: 'Body' })).join('');
  if (b.kind === 'achievements') {
    out += (b.items ?? []).map((it) =>
      para(runs(it.lead, { bold: true }) + run(' ') + runs(it.text), { style: 'Bullet', numId: 1 })).join('');
  }
  if (b.kind === 'entries') out += entries(b.entries, ctx);
  if (b.kind === 'columns') out += columns(b.columns, ctx);
  if (b.kind === 'skills') out += para(runs((b.skills ?? []).join(' · ')), { style: 'Skills' });
  return out;
}

function block(b: Block, ctx: Ctx, n: { criterion: number }): string {
  const brk = b.pageBreak === true;
  switch (b.type) {
    case 'masthead':
      return masthead(b, ctx, brk);
    case 'docmast':
      return (b.kicker ? para(runs(b.kicker), { style: 'Creds', breakBefore: brk }) : '') +
        para(runs(b.title), { style: 'Name', breakBefore: brk && b.kicker === '' }) +
        (b.sub ? para(runs(b.sub), { style: 'Tagline' }) : '') +
        contactLines(b, ctx.doc.layout.contact === 'beside') + rule();
    case 'section':
      return section(b, ctx, brk);
    case 'opening':
      return b.paragraphs.map((p, i) => para(runs(p), { style: 'Body', breakBefore: brk && i === 0 })).join('');
    case 'criterion': {
      n.criterion += 1;
      return para(runs(criterionLabel(n.criterion, ctx.doc.numbering, b.heading)),
        { style: 'SectionHeading', breakBefore: brk, keepNext: true, border: RULE }) +
        b.paragraphs.map((p) => para(runs(p), { style: 'Body' })).join('');
    }
    case 'closing':
      return b.paragraphs.map((p, i) => para(runs(p), { style: 'Body', breakBefore: brk && i === 0 })).join('') +
        b.referees.map((r) =>
          para(runs(r.label, { bold: true, colour: INK }), { style: 'Referee', keepNext: true }) +
          para(runs(r.name, { bold: true }), { style: 'Referee' }) +
          (r.sub ? para(runs(r.sub), { style: 'Sub' }) : '')).join('');
    case 'letterhead':
      return para(runs(b.date), {
        style: 'LetterDate', breakBefore: brk,
        jc: ctx.doc.layout.letterDate === 'right' ? 'right' : 'left',
      }) +
        b.recipient.map((line) => para(runs(line), { style: 'Body' })).join('') +
        (b.subject ? para(runs(b.subject, { bold: true }), { style: 'Subject' }) : '');
    case 'signoff':
      return para(runs(b.closing), { style: 'Body', breakBefore: brk }) +
        para('', { style: 'Body' }) + para(runs(b.name, { bold: true }), { style: 'Body' });
  }
}

/* ------------------------------------------------------------------ */
/* The running header and footer                                        */
/* ------------------------------------------------------------------ */

/** PAGE and NUMPAGES as Word fields, each holding the value it shows before it recalculates. */
function slotRuns(template: string, doc: QDocument, date: string): string {
  const filled = template
    .replace(/\{name\}/g, documentName(doc)).replace(/\{title\}/g, doc.title).replace(/\{date\}/g, date);
  if (!filled.trim()) return '';
  return filled.split(/(\{page\}|\{pages\})/).filter((p) => p !== '').map((p) => {
    if (p === '{page}') return '<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple>';
    if (p === '{pages}') return '<w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple>';
    return run(p);
  }).join('');
}

/** One paragraph, three slots: left at the margin, centre and right on their own tab stops. */
function band(slots: Slots, doc: QDocument, date: string, content: number): string {
  const body = slotRuns(slots.left, doc, date) + '<w:r><w:tab/></w:r>' +
    slotRuns(slots.centre, doc, date) + '<w:r><w:tab/></w:r>' + slotRuns(slots.right, doc, date);
  return para(body, {
    style: 'Running',
    tabs: [{ pos: Math.round(content / 2), align: 'center' }, { pos: content, align: 'right' }],
  });
}

const hdr = (body: string): string => `${HEAD}<w:hdr ${W} ${R}>${body}</w:hdr>`;
const ftr = (body: string): string => `${HEAD}<w:ftr ${W} ${R}>${body}</w:ftr>`;

/* ------------------------------------------------------------------ */
/* Styles and numbering                                                 */
/* ------------------------------------------------------------------ */

interface StyleDef { id: string; name: string; run: RunStyle; before?: number; after?: number; line?: number; hanging?: number }

function styleXml(s: StyleDef): string {
  const spacing = `<w:spacing w:before="${s.before ?? 0}" w:after="${s.after ?? 0}" w:line="${s.line ?? 264}" w:lineRule="auto"/>`;
  const ind = s.hanging ? `<w:ind w:left="${s.hanging}" w:hanging="${s.hanging}"/>` : '';
  return `<w:style w:type="paragraph" w:styleId="${s.id}"><w:name w:val="${esc(s.name)}"/><w:basedOn w:val="Normal"/><w:qFormat/>` +
    `<w:pPr>${spacing}${ind}</w:pPr>${rPr(s.run)}</w:style>`;
}

/**
 * The print design, as far as Word carries it: the same families, the same relative sizes, the
 * same accent, the same muted grey on a detail line.
 */
function styles(design: Design): string {
  const body = family(design.bodyFont);
  const label = family(design.labelFont);
  const accent = hex(design.accent);
  const size = (factor: number): number => hp(design.baseSize * factor);
  const list: StyleDef[] = [
    { id: 'Name', name: 'Name', run: { font: label, size: size(2.4), bold: true, colour: INK, track: -8 }, after: 44, line: 240 },
    { id: 'Creds', name: 'Credentials', run: { font: label, size: size(0.8), bold: true, colour: accent, caps: true, track: 24 }, after: 60 },
    { id: 'Tagline', name: 'Tagline', run: { font: body, size: size(1.04), colour: INK_2 }, after: 40 },
    { id: 'Contact', name: 'Contact', run: { font: label, size: size(0.84), colour: MUTED }, line: 240 },
    { id: 'Rule', name: 'Rule', run: { size: 8 }, after: 120 },
    { id: 'SectionHeading', name: 'heading 1', run: { font: label, size: size(0.76), bold: true, colour: accent, caps: true, track: 28 }, before: 200, after: 90 },
    { id: 'Body', name: 'Body', run: { font: body, size: size(0.98), colour: INK }, after: 100 },
    { id: 'Bullet', name: 'Bullet', run: { font: body, size: size(0.92), colour: INK }, after: 40, hanging: 200 },
    { id: 'Skills', name: 'Skills', run: { font: body, size: size(0.92), colour: INK }, after: 80 },
    { id: 'Dates', name: 'Dates', run: { font: label, size: size(0.84), bold: true, colour: INK }, line: 240 },
    { id: 'Org', name: 'Organisation', run: { font: label, size: size(0.79), colour: MUTED }, before: 40, after: 80, line: 240 },
    { id: 'EntryTitle', name: 'heading 2', run: { font: label, size: size(1), bold: true, colour: INK }, after: 40, line: 240 },
    { id: 'Context', name: 'Context', run: { font: body, size: size(0.92), italic: true, colour: INK_2 }, after: 60 },
    { id: 'ColHeading', name: 'heading 3', run: { font: label, size: size(0.82), bold: true, colour: INK }, after: 50, line: 240 },
    { id: 'ColItem', name: 'Column item', run: { font: body, size: size(0.86), colour: INK }, after: 40, line: 240 },
    { id: 'Sub', name: 'Detail', run: { font: label, size: size(0.77), colour: MUTED }, after: 60, line: 240 },
    { id: 'Referee', name: 'Referee', run: { font: body, size: size(0.86), colour: INK }, line: 240 },
    { id: 'LetterDate', name: 'Letter date', run: { font: label, size: size(0.86), colour: MUTED }, after: 160 },
    { id: 'Subject', name: 'Subject', run: { font: body, size: size(0.98), colour: INK }, before: 120, after: 120 },
    { id: 'Running', name: 'Running head', run: { font: label, size: hp(7.6), colour: MUTED, track: 4 }, line: 240 },
  ];
  return `${HEAD}<w:styles ${W}>` +
    `<w:docDefaults><w:rPrDefault>${rPr({ font: body, size: hp(design.baseSize), colour: INK })}</w:rPrDefault>` +
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    list.map(styleXml).join('') + '</w:styles>';
}

/** Two dash lists, because the design marks a bullet with a rule, not a dot. */
function numbering(design: Design): string {
  const level = (colour: string): string =>
    '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="–"/><w:lvlJc w:val="left"/>' +
    '<w:pPr><w:ind w:left="200" w:hanging="200"/></w:pPr>' +
    `<w:rPr><w:color w:val="${colour}"/></w:rPr></w:lvl>`;
  return `${HEAD}<w:numbering ${W}>` +
    `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>${level(hex(design.accent))}</w:abstractNum>` +
    `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/>${level(RULE_STRONG)}</w:abstractNum>` +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>';
}

/* ------------------------------------------------------------------ */
/* The file                                                             */
/* ------------------------------------------------------------------ */

const REL_NS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function contentTypes(): string {
  const override = (part: string, kind: string): string =>
    `<Override PartName="${part}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}+xml"/>`;
  return `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    override('/word/document.xml', 'document.main') +
    override('/word/styles.xml', 'styles') +
    override('/word/numbering.xml', 'numbering') +
    override('/word/header1.xml', 'header') + override('/word/header2.xml', 'header') +
    override('/word/footer1.xml', 'footer') + override('/word/footer2.xml', 'footer') +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '</Types>';
}

/** One .docx for one document, ready to upload or to read on a panel's screen. */
export function toDocx(doc: QDocument, design: Design, date: string): Uint8Array {
  const content = A4_WIDTH - 2 * mm(design.marginSide);
  const ctx: Ctx = { doc, content };
  // One counter for the whole document: the criteria are numbered in the order they are read.
  const n = { criterion: 0 };
  const body = doc.blocks.map((b) => block(b, ctx, n)).join('');

  const refs = '<w:headerReference w:type="first" r:id="rId4"/><w:footerReference w:type="first" r:id="rId5"/>' +
    '<w:headerReference w:type="default" r:id="rId6"/><w:footerReference w:type="default" r:id="rId7"/>';
  // The band sits inside the margin, as it does on the sheet, not against the page edge.
  const fromEdge = mm(design.marginTop * 0.42);
  const sect = `<w:sectPr>${refs}<w:pgSz w:w="${A4_WIDTH}" w:h="${A4_HEIGHT}"/>` +
    `<w:pgMar w:top="${mm(design.marginTop)}" w:right="${mm(design.marginSide)}" w:bottom="${mm(design.marginTop)}"` +
    ` w:left="${mm(design.marginSide)}" w:header="${fromEdge}" w:footer="${fromEdge}" w:gutter="0"/>` +
    '<w:titlePg/><w:docGrid w:linePitch="360"/></w:sectPr>';

  // titlePg is always set, so page one is always the author's choice: the running band when they
  // asked for it on the first page, and nothing when the masthead carries that page instead.
  const head = band(doc.running.header, doc, date, content);
  const foot = band(doc.running.footer, doc, date, content);
  const blank = para('', { style: 'Running' });
  const first = doc.running.firstPage;

  return zip([
    file('[Content_Types].xml', contentTypes()),
    file('_rels/.rels', `${HEAD}<Relationships ${REL_NS}>` +
      `<Relationship Id="rId1" Type="${OFFICE}/officeDocument" Target="word/document.xml"/>` +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"' +
      ' Target="docProps/core.xml"/></Relationships>'),
    file('word/_rels/document.xml.rels', `${HEAD}<Relationships ${REL_NS}>` +
      `<Relationship Id="rId2" Type="${OFFICE}/styles" Target="styles.xml"/>` +
      `<Relationship Id="rId3" Type="${OFFICE}/numbering" Target="numbering.xml"/>` +
      `<Relationship Id="rId4" Type="${OFFICE}/header" Target="header1.xml"/>` +
      `<Relationship Id="rId5" Type="${OFFICE}/footer" Target="footer1.xml"/>` +
      `<Relationship Id="rId6" Type="${OFFICE}/header" Target="header2.xml"/>` +
      `<Relationship Id="rId7" Type="${OFFICE}/footer" Target="footer2.xml"/></Relationships>`),
    file('word/document.xml', `${HEAD}<w:document ${W} ${R}><w:body>${body}${sect}</w:body></w:document>`),
    file('word/styles.xml', styles(design)),
    file('word/numbering.xml', numbering(design)),
    file('word/header1.xml', hdr(first ? head : blank)),
    file('word/footer1.xml', ftr(first ? foot : blank)),
    file('word/header2.xml', hdr(head)),
    file('word/footer2.xml', ftr(foot)),
    file('docProps/core.xml', `${HEAD}<cp:coreProperties` +
      ' xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"' +
      ' xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      `<dc:title>${esc(doc.title)}</dc:title><dc:creator>${esc(documentName(doc))}</dc:creator></cp:coreProperties>`),
  ]);
}

/** The file name the browser saves, matching the one Export PDF writes. */
export function docxFileName(doc: QDocument): string {
  const name = (documentName(doc) || doc.title).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  return `${name || 'document'}-${doc.kind}.docx`;
}
