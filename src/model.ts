/**
 * The pure model: types, templates, text helpers, migration, print rules and exports.
 * Nothing in this module touches the DOM, so Vitest runs it in Node.
 */

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type DocKind = 'cv' | 'criteria' | 'letter' | 'blank';
export type Numbering = 'both' | 'number' | 'label' | 'none';
export type SectionKind = 'prose' | 'achievements' | 'entries' | 'columns' | 'skills';

export interface Slots { left: string; centre: string; right: string }
export interface Running { header: Slots; footer: Slots; firstPage: boolean }

export interface Design {
  scheme: string;
  accent: string;
  bodyFont: string;
  labelFont: string;
  baseSize: number;
  marginTop: number;
  marginSide: number;
  density: number;
}

interface BlockBase { pageBreak?: boolean }
export interface Masthead extends BlockBase { type: 'masthead'; name: string; creds: string; tagline: string; contact: string[] }
export interface DocMast extends BlockBase { type: 'docmast'; kicker: string; title: string; sub: string; contact: string[] }
export interface Achievement { lead: string; text: string }
export interface Entry { dates: string; org: string; title: string; context: string; bullets: string[] }
export interface ColumnItem { text: string; sub: string }
export interface Column { heading: string; items: ColumnItem[] }
export interface Section extends BlockBase {
  type: 'section';
  kind: SectionKind;
  heading: string;
  paragraphs?: string[];
  items?: Achievement[];
  entries?: Entry[];
  columns?: Column[];
  skills?: string[];
}
export interface Paragraphs extends BlockBase { type: 'opening'; paragraphs: string[] }
export interface Criterion extends BlockBase { type: 'criterion'; heading: string; paragraphs: string[] }
export interface Referee { label: string; name: string; sub: string }
export interface Closing extends BlockBase { type: 'closing'; paragraphs: string[]; referees: Referee[] }
export interface Letterhead extends BlockBase { type: 'letterhead'; date: string; recipient: string[]; subject: string }
export interface Signoff extends BlockBase { type: 'signoff'; closing: string; name: string }

export type Block = Masthead | DocMast | Section | Paragraphs | Criterion | Closing | Letterhead | Signoff;
export type BlockType = Block['type'];

export interface QDocument {
  id: string;
  title: string;
  kind: DocKind;
  numbering: Numbering;
  wordLimit: number | null;
  blockWordLimit: number | null;
  running: Running;
  blocks: Block[];
}

export interface Workspace {
  format: 'quire/1';
  design: Design;
  documents: QDocument[];
}

export const BLOCK_TYPES: readonly BlockType[] = ['masthead', 'docmast', 'section', 'opening', 'criterion', 'closing', 'letterhead', 'signoff'];
export const SECTION_KINDS: readonly SectionKind[] = ['prose', 'achievements', 'entries', 'columns', 'skills'];
export const TEMPLATE_KINDS: readonly DocKind[] = ['cv', 'criteria', 'letter', 'blank'];

/** What the "Add section" picker offers. Section kinds first, then the other block types. */
export const ADDABLE: readonly { value: string; label: string; group: string }[] = [
  { value: 'prose', label: 'Text', group: 'Sections' },
  { value: 'achievements', label: 'Achievements', group: 'Sections' },
  { value: 'entries', label: 'Career entries', group: 'Sections' },
  { value: 'columns', label: 'Two columns', group: 'Sections' },
  { value: 'skills', label: 'Skills list', group: 'Sections' },
  { value: 'paragraphs', label: 'Paragraphs, no heading', group: 'Blocks' },
  { value: 'criterion', label: 'Criterion', group: 'Blocks' },
  { value: 'closing', label: 'Closing and referees', group: 'Blocks' },
  { value: 'letterhead', label: 'Letter address and date', group: 'Blocks' },
  { value: 'signoff', label: 'Sign-off', group: 'Blocks' },
];

/* ------------------------------------------------------------------ */
/* Design                                                               */
/* ------------------------------------------------------------------ */

export interface Scheme { id: string; label: string; accent: string }
export const SCHEMES: readonly Scheme[] = [
  { id: 'eucalyptus', label: 'Eucalyptus', accent: '#1f5c4d' },
  { id: 'slate', label: 'Slate', accent: '#2b4c7e' },
  { id: 'oxblood', label: 'Oxblood', accent: '#7a2e2e' },
  { id: 'charcoal', label: 'Charcoal', accent: '#333a40' },
  { id: 'ochre', label: 'Ochre', accent: '#8a5a12' },
  { id: 'plum', label: 'Plum', accent: '#5b3a6e' },
];

export interface FontChoice { id: string; label: string; stack: string }
export const BODY_FONTS: readonly FontChoice[] = [
  { id: 'XCharter', label: 'Charter', stack: '"XCharter", "Source Serif 4", Charter, Georgia, serif' },
  { id: 'Source Serif 4', label: 'Source Serif', stack: '"Source Serif 4", Charter, Georgia, serif' },
  { id: 'Georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'Inter', label: 'Inter (sans)', stack: '"Inter", system-ui, sans-serif' },
  { id: 'system-ui', label: 'System sans', stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
];
export const LABEL_FONTS: readonly FontChoice[] = [
  { id: 'Inter', label: 'Inter', stack: '"Inter", system-ui, sans-serif' },
  { id: 'system-ui', label: 'System sans', stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  { id: 'XCharter', label: 'Charter (match body)', stack: '"XCharter", "Source Serif 4", Charter, Georgia, serif' },
];
export const BASE_SIZES: readonly number[] = [9, 9.5, 10, 10.5, 11];

export function fontStack(list: readonly FontChoice[], id: string): string {
  return (list.find((f) => f.id === id) ?? list[0]!).stack;
}

export function defaultDesign(): Design {
  return {
    scheme: 'eucalyptus',
    accent: SCHEMES[0]!.accent,
    bodyFont: 'XCharter',
    labelFont: 'Inter',
    baseSize: 10,
    marginTop: 14,
    marginSide: 17,
    density: 1,
  };
}

export function defaultRunning(): Running {
  return { header: { left: '', centre: '', right: '' }, footer: { left: '', centre: '', right: '' }, firstPage: false };
}

/* ------------------------------------------------------------------ */
/* Paths                                                                */
/* ------------------------------------------------------------------ */

export type Path = (string | number)[];

export function get(obj: unknown, path: Path): unknown {
  return path.reduce<unknown>((o, k) => (o as Record<string | number, unknown>)[k], obj);
}
export function set(obj: unknown, path: Path, value: unknown): void {
  const parent = get(obj, path.slice(0, -1)) as Record<string | number, unknown>;
  parent[path[path.length - 1]!] = value;
}
export const pstr = (path: Path): string => path.join('.');
export const pparse = (s: string): Path => s.split('.').map((k) => (/^\d+$/.test(k) ? Number(k) : k));

/* ------------------------------------------------------------------ */
/* Inline text                                                          */
/* ------------------------------------------------------------------ */

export type TokenKind = 'text' | 'bold' | 'italic' | 'flag';
export interface Token { kind: TokenKind; text: string }

const INLINE = /(\[\[[\s\S]*?\]\]|\*\*[^*\n]+?\*\*|(?<![\w])_[^_\n]+?_(?![\w]))/g;

/** Split model text into plain, bold, italic and flag runs. Newlines stay inside text runs. */
export function tokenise(text: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const s = m[0];
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) });
    if (s.startsWith('[[')) out.push({ kind: 'flag', text: s.slice(2, -2) });
    else if (s.startsWith('**')) out.push({ kind: 'bold', text: s.slice(2, -2) });
    else out.push({ kind: 'italic', text: s.slice(1, -1) });
    last = at + s.length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

/** Words that will print: markers dropped, flag text excluded. */
export function countWords(text: string): number {
  const plain = tokenise(text).filter((t) => t.kind !== 'flag').map((t) => t.text).join(' ');
  return plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const sum = (xs: readonly string[]): number => xs.reduce((n, s) => n + countWords(s), 0);

/** Words in the body of a block. Headings the panel wrote and mastheads do not count. */
export function blockWords(b: Block): number {
  switch (b.type) {
    case 'masthead':
    case 'docmast':
      return 0;
    case 'section':
      switch (b.kind) {
        case 'prose': return sum(b.paragraphs ?? []);
        case 'achievements': return (b.items ?? []).reduce((n, it) => n + countWords(it.lead) + countWords(it.text), 0);
        case 'entries': return (b.entries ?? []).reduce((n, e) => n + countWords(e.dates) + countWords(e.org) + countWords(e.title) + countWords(e.context) + sum(e.bullets), 0);
        case 'columns': return (b.columns ?? []).reduce((n, c) => n + countWords(c.heading) + c.items.reduce((m, it) => m + countWords(it.text) + countWords(it.sub), 0), 0);
        case 'skills': return sum(b.skills ?? []);
      }
      return 0;
    case 'opening':
    case 'criterion':
      return sum(b.paragraphs);
    case 'closing':
      return sum(b.paragraphs) + b.referees.reduce((n, r) => n + countWords(r.name) + countWords(r.sub), 0);
    case 'letterhead':
      return countWords(b.date) + sum(b.recipient) + countWords(b.subject);
    case 'signoff':
      return countWords(b.closing) + countWords(b.name);
  }
}

export const documentWords = (doc: QDocument): number => doc.blocks.reduce((n, b) => n + blockWords(b), 0);

/** Blocks whose word count is shown in the margin. */
export function countsShown(b: Block): boolean {
  return b.type === 'criterion' || b.type === 'opening' || (b.type === 'section' && b.kind === 'prose');
}

/* ------------------------------------------------------------------ */
/* Templates                                                            */
/* ------------------------------------------------------------------ */

export function newBlock(type: BlockType, kind: SectionKind = 'prose'): Block {
  switch (type) {
    case 'masthead': return { type, name: 'Your name', creds: 'Post-nominals', tagline: 'One line that says what you are and what you bring.', contact: ['City', 'Phone', 'Email'] };
    case 'docmast': return { type, kicker: 'Application', title: 'Role title', sub: 'Position number and organisation', contact: ['Your name', 'Phone', 'Email'] };
    case 'section': return newSection(kind);
    case 'opening': return { type, paragraphs: [''] };
    case 'criterion': return { type, heading: 'Criterion wording, as the panel wrote it.', paragraphs: [''] };
    case 'closing': return { type, paragraphs: ['I would welcome the opportunity to discuss the role with the panel.'], referees: [{ label: 'Referee', name: 'Name', sub: 'Title, organisation\nPhone · email' }] };
    case 'letterhead': return { type, date: '', recipient: ['Recipient name', 'Title', 'Organisation'], subject: 'Application for [role], position [number]' };
    case 'signoff': return { type, closing: 'Yours sincerely', name: 'Your name' };
  }
}

export function newSection(kind: SectionKind): Section {
  switch (kind) {
    case 'prose': return { type: 'section', kind, heading: 'Profile', paragraphs: [''] };
    case 'achievements': return { type: 'section', kind, heading: 'Selected achievements', items: [{ lead: 'Lead phrase.', text: 'What you did and what it produced.' }] };
    case 'entries': return { type: 'section', kind, heading: 'Career history', entries: [newEntry()] };
    case 'columns': return { type: 'section', kind, heading: 'Qualifications and registrations', columns: [{ heading: 'Qualifications', items: [{ text: '', sub: '' }] }, { heading: 'Registrations', items: [{ text: '', sub: '' }] }] };
    case 'skills': return { type: 'section', kind, heading: 'Skills', skills: ['Skill', 'Another skill'] };
  }
}

export const newEntry = (): Entry => ({ dates: 'Mon YYYY – Mon YYYY', org: 'Organisation\nCity', title: 'Role title', context: '', bullets: [''] });
export const newAchievement = (): Achievement => ({ lead: 'Lead phrase.', text: '' });
export const newColumn = (): Column => ({ heading: 'Heading', items: [{ text: '', sub: '' }] });
export const newColumnItem = (): ColumnItem => ({ text: '', sub: '' });
export const newReferee = (): Referee => ({ label: 'Referee', name: 'Name', sub: 'Title, organisation\nPhone · email' });

/** Map an "Add section" picker value onto a block. */
export function blockForPicker(value: string): Block {
  if ((SECTION_KINDS as readonly string[]).includes(value)) return newSection(value as SectionKind);
  if (value === 'paragraphs') return newBlock('opening');
  return newBlock(value as BlockType);
}

export function newDocument(kind: DocKind, id?: string): QDocument {
  const base = { id: id ?? uniqueId(kind), kind, numbering: 'both' as Numbering, wordLimit: null, blockWordLimit: null, running: defaultRunning() };
  switch (kind) {
    case 'cv':
      return { ...base, title: 'Curriculum vitae', blocks: [newBlock('masthead'), newSection('prose'), newSection('achievements'), newSection('entries'), newSection('columns')] };
    case 'criteria':
      return { ...base, title: 'Response to selection criteria', blocks: [newBlock('docmast'), newBlock('opening'), newBlock('criterion'), newBlock('criterion'), newBlock('criterion'), newBlock('closing')] };
    case 'letter':
      return { ...base, title: 'Cover letter', blocks: [{ ...newBlock('docmast'), kicker: '' } as Block, newBlock('letterhead'), { type: 'opening', paragraphs: ['Dear [name],', ''] }, newBlock('signoff')] };
    case 'blank':
      return { ...base, title: 'Untitled document', blocks: [newBlock('docmast')] };
  }
}

export function uniqueId(prefix: string, taken: readonly string[] = []): string {
  let id = prefix;
  let n = 2;
  while (taken.includes(id)) id = `${prefix}-${n++}`;
  return id;
}

/* ------------------------------------------------------------------ */
/* Migration and validation                                             */
/* ------------------------------------------------------------------ */

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

function inferKind(doc: Raw): DocKind {
  const blocks = Array.isArray(doc.blocks) ? (doc.blocks as Raw[]) : [];
  if (blocks.some((b) => b.type === 'letterhead' || b.type === 'signoff')) return 'letter';
  if (blocks.some((b) => b.type === 'criterion')) return 'criteria';
  if (blocks[0]?.type === 'masthead') return 'cv';
  return 'blank';
}

function completeDocument(raw: Raw, taken: string[]): QDocument {
  const kind = (TEMPLATE_KINDS as readonly string[]).includes(String(raw.kind)) ? (raw.kind as DocKind) : inferKind(raw);
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uniqueId(kind, taken);
  const running = isObj(raw.running) ? (raw.running as Partial<Running>) : {};
  const slots = (s: unknown): Slots => ({ left: '', centre: '', right: '', ...(isObj(s) ? (s as Partial<Slots>) : {}) });
  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled document',
    kind,
    numbering: (['both', 'number', 'label', 'none'] as const).includes(raw.numbering as Numbering) ? (raw.numbering as Numbering) : 'both',
    wordLimit: typeof raw.wordLimit === 'number' ? raw.wordLimit : null,
    blockWordLimit: typeof raw.blockWordLimit === 'number' ? raw.blockWordLimit : null,
    running: { header: slots(running.header), footer: slots(running.footer), firstPage: typeof running.firstPage === 'boolean' ? running.firstPage : false },
    blocks: Array.isArray(raw.blocks) ? (raw.blocks as Block[]) : [],
  };
}

/**
 * Accept a workspace, a first-generation two-document object ({cv, criteria}) or a single
 * first-generation document, and return a complete workspace.
 */
export function migrate(input: unknown): Workspace {
  if (!isObj(input)) throw new Error('Not a Quire file: expected an object');
  let docs: Raw[];
  if (input.format === 'quire/1' && Array.isArray(input.documents)) docs = input.documents as Raw[];
  else if (Array.isArray(input.blocks)) docs = [input];
  else {
    const values = Object.values(input).filter((v) => isObj(v) && Array.isArray((v as Raw).blocks)) as Raw[];
    if (values.length === 0) throw new Error('Not a Quire file: no documents found');
    docs = values;
  }
  const taken: string[] = [];
  const documents = docs.map((d) => { const doc = completeDocument(d, taken); taken.push(doc.id); return doc; });
  const design = { ...defaultDesign(), ...(isObj(input.design) ? (input.design as Partial<Design>) : {}) };
  const ws: Workspace = { format: 'quire/1', design, documents };
  validateWorkspace(ws);
  return ws;
}

export function validateWorkspace(ws: unknown): asserts ws is Workspace {
  if (!isObj(ws) || !Array.isArray(ws.documents)) throw new Error('Not a workspace: documents missing');
  const ids = new Set<string>();
  for (const d of ws.documents as unknown[]) {
    if (!isObj(d) || typeof d.id !== 'string') throw new Error('A document has no id');
    if (ids.has(d.id)) throw new Error(`duplicate document id: ${d.id}`);
    ids.add(d.id);
    if (!Array.isArray(d.blocks)) throw new Error(`document ${d.id} has no blocks array`);
    for (const b of d.blocks as unknown[]) {
      if (!isObj(b) || !(BLOCK_TYPES as readonly unknown[]).includes(b.type)) throw new Error(`unknown block type in ${d.id}: ${isObj(b) ? String(b.type) : typeof b}`);
      if (b.type === 'section' && !(SECTION_KINDS as readonly unknown[]).includes(b.kind)) throw new Error(`unknown section kind in ${d.id}: ${String(b.kind)}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Print: @page rule with running header and footer                    */
/* ------------------------------------------------------------------ */

export function cssString(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"';
}

export function documentName(doc: QDocument): string {
  const first = doc.blocks[0];
  if (first?.type === 'masthead') return first.name;
  if (first?.type === 'docmast') return first.contact[0] ?? '';
  return '';
}

function slotContent(template: string, doc: QDocument, ctx: { date: string }): string | null {
  const filled = template.replace(/\{name\}/g, documentName(doc)).replace(/\{title\}/g, doc.title).replace(/\{date\}/g, ctx.date);
  if (!filled.trim()) return null;
  const parts = filled.split(/(\{page\}|\{pages\})/).filter((p) => p !== '');
  return parts.map((p) => (p === '{page}' ? 'counter(page)' : p === '{pages}' ? 'counter(pages)' : cssString(p))).join(' ');
}

const SLOT_NAMES: readonly [keyof Slots, string, string][] = [
  ['left', '@top-left', '@bottom-left'],
  ['centre', '@top-center', '@bottom-center'],
  ['right', '@top-right', '@bottom-right'],
];

export function pageRuleCSS(design: Design, doc: QDocument | undefined, ctx: { date: string }): string {
  const box = (name: string, content: string): string =>
    `  ${name} { content: ${content}; font-family: ${fontStack(LABEL_FONTS, design.labelFont)}; font-size: 7.6pt; color: #6a7178; letter-spacing: 0.02em; }\n`;
  let boxes = '';
  const used: string[] = [];
  if (doc) {
    for (const [slot, top, bottom] of SLOT_NAMES) {
      const h = slotContent(doc.running.header[slot], doc, ctx);
      if (h) { boxes += box(top, h); used.push(top); }
      const f = slotContent(doc.running.footer[slot], doc, ctx);
      if (f) { boxes += box(bottom, f); used.push(bottom); }
    }
  }
  const m = `${design.marginTop}mm ${design.marginSide}mm ${design.marginTop}mm ${design.marginSide}mm`;
  let css = `@page {\n  size: A4;\n  margin: ${m};\n${boxes}}\n`;
  if (doc && !doc.running.firstPage && used.length) {
    css += `@page :first {\n${used.map((u) => `  ${u} { content: none; }\n`).join('')}}\n`;
  }
  return css;
}

/* ------------------------------------------------------------------ */
/* Exports: plain text and Markdown                                     */
/* ------------------------------------------------------------------ */

function inline(text: string, mode: 'plain' | 'md'): string {
  return tokenise(text).map((t) => {
    if (t.kind === 'flag') return mode === 'plain' ? `[${t.text}]` : `[[${t.text}]]`;
    if (t.kind === 'bold') return mode === 'plain' ? t.text : `**${t.text}**`;
    if (t.kind === 'italic') return mode === 'plain' ? t.text : `_${t.text}_`;
    return t.text;
  }).join('');
}

function criterionLabel(n: number, numbering: Numbering, heading: string): string {
  switch (numbering) {
    case 'both': return `Criterion ${n}. ${heading}`;
    case 'number': return `${n}. ${heading}`;
    case 'label': return `Criterion. ${heading}`;
    case 'none': return heading;
  }
}

export function toPlainText(doc: QDocument): string {
  return render(doc, 'plain');
}
export function toMarkdown(doc: QDocument): string {
  return render(doc, 'md');
}

function render(doc: QDocument, mode: 'plain' | 'md'): string {
  const out: string[] = [];
  const h1 = (s: string): string => (mode === 'md' ? `# ${s}` : s.toUpperCase());
  const h2 = (s: string): string => (mode === 'md' ? `## ${s}` : s);
  const h3 = (s: string): string => (mode === 'md' ? `### ${s}` : s);
  const li = (s: string): string => `- ${inline(s, mode)}`;
  let n = 0;
  for (const b of doc.blocks) {
    switch (b.type) {
      case 'masthead':
        out.push(h1(b.name), b.creds, inline(b.tagline, mode), b.contact.join(' · '), '');
        break;
      case 'docmast':
        out.push(b.kicker, h1(b.title), b.sub, b.contact.join(' · '), '');
        break;
      case 'section':
        out.push(h2(b.heading));
        if (b.kind === 'prose') out.push(...(b.paragraphs ?? []).map((p) => inline(p, mode)));
        if (b.kind === 'achievements') out.push(...(b.items ?? []).map((it) => `- ${mode === 'md' ? `**${it.lead}**` : it.lead} ${inline(it.text, mode)}`));
        if (b.kind === 'entries') for (const e of b.entries ?? []) {
          out.push(h3(`${e.title}`), `${e.dates} · ${e.org.replace(/\n/g, ', ')}`);
          if (e.context) out.push(inline(e.context, mode));
          out.push(...e.bullets.map(li));
          out.push('');
        }
        if (b.kind === 'columns') for (const c of b.columns ?? []) { out.push(h3(c.heading), ...c.items.map((it) => li(it.sub ? `${it.text} (${it.sub})` : it.text))); }
        if (b.kind === 'skills') out.push((b.skills ?? []).join(' · '));
        out.push('');
        break;
      case 'opening':
        out.push(...b.paragraphs.map((p) => inline(p, mode)), '');
        break;
      case 'criterion':
        n += 1;
        out.push(h2(mode === 'md' ? `${n}. ${b.heading}` : criterionLabel(n, doc.numbering, b.heading)));
        out.push(...b.paragraphs.map((p) => inline(p, mode)), '');
        break;
      case 'closing':
        out.push(...b.paragraphs.map((p) => inline(p, mode)));
        for (const r of b.referees) out.push(`${r.label}: ${r.name}. ${r.sub.replace(/\n/g, ', ')}`);
        out.push('');
        break;
      case 'letterhead':
        out.push(b.date, ...b.recipient, '', b.subject, '');
        break;
      case 'signoff':
        out.push(b.closing, '', b.name, '');
        break;
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ------------------------------------------------------------------ */
/* Dates                                                                */
/* ------------------------------------------------------------------ */

export function formatDateAU(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}
