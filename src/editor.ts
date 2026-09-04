/**
 * The editor: state, storage, history, events, panels and the structure rail.
 * Rendering of the document itself lives in render.ts; the pure model in model.ts.
 */
import { blockIconName, icon, type IconName } from './icons';
import {
  ADDABLE, BASE_SIZES, BODY_FONTS, LABEL_FONTS, SCHEMES, TEMPLATE_KINDS,
  blockForPicker, blockWords, defaultDesign, documentName, documentWords, fontStack, formatDateAU,
  get, migrate, newAchievement, newColumn, newColumnItem, newDocument, newEntry, newReferee,
  pageRuleCSS, pparse, pstr, set, toMarkdown, toPlainText, uniqueId, validateWorkspace,
  type Block, type Design, type DocKind, type Numbering, type QDocument, type Workspace,
} from './model';
import { h, renderDocument } from './render';
import { caretAtStart, fill, flagAtSelection, flagSelection, placeCaret, readText, unflag } from './text';
import { applicable, matchCommands, type Command, type CommandContext } from './commands';

export interface State { workspace: Workspace; activeId: string }
interface Version { at: string; label: string; workspace: Workspace }

/** The scripting and test surface exposed as window.Quire. */
export interface QuireApi {
  readText(node: Node): string;
  fill(el: HTMLElement, text: string): void;
  exportJSON(): string;
  importJSON(text: string): void;
  toPlainText(doc: QDocument): string;
  toMarkdown(doc: QDocument): string;
  validateWorkspace(ws: unknown): void;
  render(): void;
  readonly state: State;
}

const SECTION_KIND_VALUES = new Set<string>(['prose', 'achievements', 'entries', 'columns', 'skills']);
/** The Quire mark: a sheet with the accent bar and two hairlines, the document's own first viewport in miniature. */
const MARK_SVG = '<svg class="mark" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1"><path d="M4 20V7.5a3.5 3.5 0 0 1 3.5-3.5H20v13"/><path d="M8 20V11a3 3 0 0 1 3-3h9"/><path d="M12 20v-5a2.5 2.5 0 0 1 2.5-2.5H20"/><path d="M4 20h16"/></svg>';
const STORE = `quire:${location.pathname}`;
const VERSIONS = `quire:versions:${location.pathname}`;
const PAGE_MM = 297;
const MM = 96 / 25.4;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element ${sel}`);
  return el;
};

export class Editor {
  private state: State;
  private readonly seed: Workspace;
  private past: State[] = [];
  private future: State[] = [];
  private textEditPending = false;
  private saveTimer = 0;
  private statusTimer = 0;
  private flagCursor = -1;
  private openPanelId: string | null = null;
  private panelOpener: HTMLElement | null = null;
  private drag: { list: string; index: number } | null = null;
  private savedRange: Range | null = null;
  private bubbleTimer = 0;
  private paletteItems: Command[] = [];
  private paletteIndex = 0;

  private readonly sheet = $('#sheet');
  private readonly rail = $('#rail');
  private readonly pageRule = $<HTMLStyleElement>('#page-rule');

  constructor(seed: Workspace) {
    this.seed = seed;
    this.state = this.load() ?? { workspace: clone(seed), activeId: seed.documents[0]?.id ?? '' };
    const hashDoc = decodeURIComponent(location.hash.slice(1));
    if (hashDoc && this.state.workspace.documents.some((d) => d.id === hashDoc)) this.state.activeId = hashDoc;
    this.bind();
  }

  /* ------------------------------------------------------------------ */
  /* State, storage and history                                          */
  /* ------------------------------------------------------------------ */

  get workspace(): Workspace { return this.state.workspace; }
  get doc(): QDocument | undefined { return this.state.workspace.documents.find((d) => d.id === this.state.activeId); }

  private load(): State | null {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { workspace?: unknown; activeId?: unknown };
      const workspace = migrate(parsed.workspace);
      const activeId = typeof parsed.activeId === 'string' && workspace.documents.some((d) => d.id === parsed.activeId) ? parsed.activeId : workspace.documents[0]?.id ?? '';
      return { workspace, activeId };
    } catch { return null; }
  }
  private save(): void {
    try { localStorage.setItem(STORE, JSON.stringify(this.state)); } catch { /* storage unavailable: edits live for the session only */ }
  }
  private saveSoon(): void { clearTimeout(this.saveTimer); this.saveTimer = window.setTimeout(() => this.save(), 150); }

  private snapshot(): void {
    this.past.push(clone(this.state));
    if (this.past.length > 80) this.past.shift();
    this.future = [];
    this.updateHistoryButtons();
  }
  undo(): void {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(clone(this.state));
    this.state = prev;
    this.save(); this.render();
  }
  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(clone(this.state));
    this.state = next;
    this.save(); this.render();
  }
  private updateHistoryButtons(): void {
    $<HTMLButtonElement>('#undo').disabled = this.past.length === 0;
    $<HTMLButtonElement>('#redo').disabled = this.future.length === 0;
  }

  /** Commit a structural change: snapshot first, mutate, save, re-render. */
  private commit(mutate: () => void): void {
    this.snapshot();
    mutate();
    this.save();
    this.render();
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  render(): void {
    const ws = this.state.workspace;
    const doc = this.doc;
    this.applyDesign();
    this.renderTabs();
    this.renderPicker();
    this.sheet.innerHTML = '';
    this.sheet.classList.toggle('empty', !doc);
    if (doc) this.sheet.append(renderDocument(doc));
    else this.sheet.append(this.emptyState());
    this.renderRail();
    document.title = doc ? `${doc.title} · ${documentName(doc) || 'Quire'}` : 'Quire';
    this.updateHistoryButtons();
    this.updateStatus();
    if (this.openPanelId) this.refreshPanel();
    void ws;
  }

  private applyDesign(): void {
    const d = this.state.workspace.design;
    const root = document.documentElement.style;
    root.setProperty('--accent', d.accent);
    root.setProperty('--font-body', fontStack(BODY_FONTS, d.bodyFont));
    root.setProperty('--font-label', fontStack(LABEL_FONTS, d.labelFont));
    root.setProperty('--base', `${d.baseSize}pt`);
    root.setProperty('--density', String(d.density));
    root.setProperty('--m-top', `${d.marginTop}mm`);
    root.setProperty('--m-side', `${d.marginSide}mm`);
    this.pageRule.textContent = pageRuleCSS(d, this.doc, { date: formatDateAU(new Date()) });
    this.updateFavicon(d.accent);
  }
  /** The Quire mark on its own indigo tile. The brand colour is fixed; the document scheme is the author's. */
  private updateFavicon(_accent: string): void {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#2f47b8"/><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"><path d="M8 24V11.5A3.5 3.5 0 0 1 11.5 8H24v13"/><path d="M12.5 24v-9a3 3 0 0 1 3-3H24"/><path d="M17 24v-4.5a2.5 2.5 0 0 1 2.5-2.5H24"/><path d="M8 24h16"/></g></svg>`;
    const link = document.getElementById('favicon');
    if (link instanceof HTMLLinkElement) link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  private renderTabs(): void {
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    for (const d of this.state.workspace.documents) {
      const t = h('button', 'tab', d.title);
      t.type = 'button';
      t.role = 'tab';
      t.dataset.doc = d.id;
      t.setAttribute('aria-selected', String(d.id === this.state.activeId));
      tabs.append(t);
    }
  }

  private renderPicker(): void {
    const sel = $<HTMLSelectElement>('#add-section');
    sel.innerHTML = '';
    sel.append(new Option('Add a section…', ''));
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const a of ADDABLE) {
      let g = groups.get(a.group);
      if (!g) { g = document.createElement('optgroup'); g.label = a.group; groups.set(a.group, g); sel.append(g); }
      g.append(new Option(a.label, a.value));
    }
    sel.disabled = !this.doc;
  }

  private emptyState(): HTMLElement {
    const box = h('div', 'start');
    const mark = document.createElement('template');
    mark.innerHTML = `${MARK_SVG}`;
    box.append(mark.content.firstElementChild!, h('h2', null, 'Start a document'), h('p', null, 'Pick a template. Everything in it can be changed, moved or removed.'));
    const row = h('div', 'start-row');
    for (const kind of TEMPLATE_KINDS) {
      const b = h('button', 'start-btn', this.templateLabel(kind));
      b.type = 'button';
      b.dataset.template = kind;
      row.append(b);
    }
    box.append(row);
    return box;
  }
  private templateLabel(kind: DocKind): string {
    return { cv: 'Curriculum vitae', criteria: 'Criteria response', letter: 'Cover letter', blank: 'Blank' }[kind];
  }

  /* ---------- Structure rail ---------- */

  private renderRail(): void {
    const doc = this.doc;
    this.rail.innerHTML = '';
    if (!doc) return;
    const words = documentWords(doc);
    const meta = doc.wordLimit ? `${words.toLocaleString('en-AU')} of ${doc.wordLimit.toLocaleString('en-AU')} words` : `${words.toLocaleString('en-AU')} words`;
    this.rail.append(h('div', 'rail-doc', h('div', 'rail-doc-title', doc.title), h('div', 'rail-doc-meta', `${doc.blocks.length - 1} ${doc.blocks.length === 2 ? 'block' : 'blocks'} · ${meta}`)));
    this.rail.append(h('div', 'rail-head', h('span', null, 'Structure'), h('span', 'rail-hint', 'Drag to reorder')));
    const list = h('ol', 'rail-list');
    list.setAttribute('aria-label', 'Document structure');
    doc.blocks.forEach((b, i) => {
      if (b.pageBreak) list.append(h('li', 'rail-break', 'New page'));
      const row = h('li', 'rail-row');
      row.dataset.index = String(i);
      row.draggable = i > 0;
      const grip = h('span', 'rail-grip', icon('grip'));
      const type = h('span', 'rail-type', icon(blockIconName(b.type, b.type === 'section' ? b.kind : undefined)));
      type.title = this.blockTypeLabel(b);
      const title = h('button', 'rail-title', h('span', 't', this.blockTitle(b, i, doc)), i === 0 ? null : h('span', 'n', String(blockWords(b))));
      title.type = 'button';
      title.dataset.act = 'goto';
      title.title = 'Go to this block';
      const ctl = h('span', 'rail-ctl');
      const mk = (act: string, name: IconName, label: string, disabled = false): HTMLButtonElement => {
        const btn = h('button', null, icon(name));
        btn.type = 'button'; btn.dataset.act = act; btn.title = label; btn.setAttribute('aria-label', label); btn.disabled = disabled;
        return btn;
      };
      const pb = mk('pagebreak', 'arrowLineDown', b.pageBreak ? 'Remove the page break before this block' : 'Start this block on a new page', i === 0);
      if (b.pageBreak) pb.classList.add('on');
      ctl.append(
        mk('up', 'arrowUp', 'Move up', i <= 1),
        mk('down', 'arrowDown', 'Move down', i === 0 || i === doc.blocks.length - 1),
        pb,
        mk('remove', 'x', 'Remove', i === 0),
      );
      row.append(grip, type, title, ctl);
      list.append(row);
    });
    this.rail.append(list, this.railAdd());
  }
  private railAdd(): HTMLElement {
    const wrap = h('div', 'rail-add menu-anchor');
    const btn = h('button', null, icon('plus'), 'Add a section');
    btn.type = 'button'; btn.id = 'rail-add'; btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
    const menu = h('div', 'menu');
    menu.id = 'menu-add-section'; menu.role = 'menu'; menu.hidden = true;
    let group = '';
    for (const a of ADDABLE) {
      if (a.group !== group) { group = a.group; menu.append(h('div', 'menu-group', group)); }
      const item = h('button', 'with-icon', icon(blockIconName(a.value === 'paragraphs' ? 'opening' : (SECTION_KIND_VALUES.has(a.value) ? 'section' : a.value), a.value)), a.label);
      item.type = 'button'; item.role = 'menuitem'; item.dataset.add = a.value;
      menu.append(item);
    }
    btn.addEventListener('click', () => this.toggleMenu('menu-add-section', btn));
    menu.addEventListener('click', (e) => {
      const it = (e.target as HTMLElement).closest<HTMLElement>('[data-add]');
      if (!it?.dataset.add) return;
      this.hideMenus();
      this.addBlock(it.dataset.add);
    });
    wrap.append(btn, menu);
    return wrap;
  }
  private blockTypeLabel(b: Block): string {
    if (b.type === 'section') return { prose: 'Text section', achievements: 'Achievements', entries: 'Career entries', columns: 'Two columns', skills: 'Skills list' }[b.kind];
    return { masthead: 'Masthead', docmast: 'Title block', opening: 'Paragraphs', criterion: 'Criterion', closing: 'Closing and referees', letterhead: 'Address and date', signoff: 'Sign-off' }[b.type];
  }
  private blockTitle(b: Block, i: number, doc: QDocument): string {
    switch (b.type) {
      case 'masthead': return b.name || 'Masthead';
      case 'docmast': return b.title || 'Title';
      case 'section': return b.heading || 'Section';
      case 'opening': return 'Paragraphs';
      case 'criterion': return `Criterion ${doc.blocks.slice(0, i + 1).filter((x) => x.type === 'criterion').length}`;
      case 'closing': return 'Closing and referees';
      case 'letterhead': return 'Address and date';
      case 'signoff': return 'Sign-off';
    }
  }

  /* ---------- Status ---------- */

  private updateStatus(): void {
    const doc = this.doc;
    this.sheet.querySelectorAll('.guide').forEach((g) => g.remove());
    const cs = getComputedStyle(this.sheet);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    const d = this.state.workspace.design;
    const pageContent = (PAGE_MM - 2 * d.marginTop) * MM;
    const contentPx = this.sheet.scrollHeight - padTop - padBottom;
    const pages = doc ? Math.max(1, contentPx / pageContent) : 0;
    $('#pages').textContent = doc ? (pages < 1.05 ? 'About 1 page' : `About ${pages.toFixed(1)} pages`) : '';

    const words = doc ? documentWords(doc) : 0;
    const wordsEl = $('#words');
    wordsEl.textContent = doc ? (doc.wordLimit ? `${words.toLocaleString('en-AU')} / ${doc.wordLimit.toLocaleString('en-AU')} words` : `${words.toLocaleString('en-AU')} words`) : '';
    wordsEl.classList.toggle('over', !!doc?.wordLimit && words > doc.wordLimit);

    const flags = this.sheet.querySelectorAll('.flag').length;
    const flagsEl = $<HTMLButtonElement>('#flags');
    flagsEl.textContent = flags ? `${flags} ${flags === 1 ? 'flag' : 'flags'}` : 'No flags';
    flagsEl.classList.toggle('warn', flags > 0);
    flagsEl.disabled = flags === 0;
    flagsEl.title = flags ? 'Go to the next flag' : 'Nothing is flagged for confirmation';

    if (doc && !matchMedia('print').matches) {
      for (let k = 1; k < Math.ceil(pages); k++) {
        const g = h('div', 'guide', h('span', null, `Page ${k + 1} starts about here`));
        g.style.top = `${padTop + k * pageContent}px`;
        this.sheet.append(g);
      }
    }
  }
  private updateStatusSoon(): void { clearTimeout(this.statusTimer); this.statusTimer = window.setTimeout(() => this.updateStatus(), 200); }

  /* ------------------------------------------------------------------ */
  /* Structural operations                                               */
  /* ------------------------------------------------------------------ */

  private listAt(listPath: string): unknown[] { return get(this.doc, pparse(listPath)) as unknown[]; }

  private insertAt(listPath: string, index: number, value: unknown): void {
    this.commit(() => this.listAt(listPath).splice(index, 0, value));
    this.focusNew(listPath, index);
  }
  private focusNew(listPath: string, index: number): void {
    const item = this.listAt(listPath)[index];
    const base = pparse(listPath).concat(index);
    const field = typeof item === 'string' ? null
      : item && typeof item === 'object' && 'lead' in item ? 'lead'
      : item && typeof item === 'object' && 'dates' in item ? 'title'
      : item && typeof item === 'object' && 'items' in item ? 'heading'
      : item && typeof item === 'object' && 'text' in item ? 'text'
      : item && typeof item === 'object' && 'name' in item ? 'name'
      : item && typeof item === 'object' && 'heading' in item ? 'heading' : null;
    const el = this.sheet.querySelector<HTMLElement>(`[data-path="${pstr(field ? base.concat(field) : base)}"]`);
    if (el) { placeCaret(el, false); el.scrollIntoView({ block: 'nearest' }); }
  }
  private removeAt(listPath: string, index: number): void {
    const list = this.listAt(listPath);
    if (listPath === 'blocks' && index === 0) { this.notify('The masthead stays. Edit its text instead.'); return; }
    if (listPath === 'blocks') {
      const b = list[index] as Block;
      const words = blockWords(b);
      if (words > 12 && !confirm(`Remove this block and its ${words} words? Undo brings it back.`)) return;
    }
    this.commit(() => list.splice(index, 1));
    const prev = this.listAt(listPath)[index - 1];
    if (typeof prev === 'string') {
      const el = this.sheet.querySelector<HTMLElement>(`[data-path="${pstr(pparse(listPath).concat(index - 1))}"]`);
      if (el) placeCaret(el, true);
    }
  }
  private move(listPath: string, index: number, to: number): void {
    const list = this.listAt(listPath);
    if (to < 0 || to >= list.length || to === index) return;
    if (listPath === 'blocks' && (to === 0 || index === 0)) return;
    this.commit(() => { const [item] = list.splice(index, 1); list.splice(to, 0, item); });
    const moved = this.sheet.querySelector<HTMLElement>(`[data-list="${listPath}"][data-index="${to}"]`)?.parentElement;
    moved?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    moved?.classList.add('moved');
    window.setTimeout(() => moved?.classList.remove('moved'), 600);
  }
  private togglePageBreak(index: number): void {
    const doc = this.doc;
    if (!doc || index === 0) return;
    this.commit(() => { const b = doc.blocks[index]; if (b) b.pageBreak = !b.pageBreak; });
  }

  private makeItem(kind: string, listPath: string): unknown {
    switch (kind) {
      case 'paragraph': case 'bullet': case 'skill': case 'line': return '';
      case 'achievement': return newAchievement();
      case 'entry': return newEntry();
      case 'column': return newColumn();
      case 'colitem': return newColumnItem();
      case 'referee': return newReferee();
      default: throw new Error(`unknown item kind ${kind} for ${listPath}`);
    }
  }

  addBlock(pickerValue: string): void {
    const doc = this.doc;
    if (!doc) return;
    const block = blockForPicker(pickerValue);
    const closing = doc.blocks.findIndex((b) => b.type === 'closing' || b.type === 'signoff');
    const at = closing === -1 ? doc.blocks.length : closing;
    this.commit(() => doc.blocks.splice(at, 0, block));
    const el = this.sheet.querySelector<HTMLElement>(`[data-list="blocks"][data-index="${at}"]`)?.parentElement;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const first = el?.querySelector<HTMLElement>('[contenteditable]');
    if (first) placeCaret(first, false);
  }

  /* ---------- Documents ---------- */

  addDocument(kind: DocKind): void {
    const ids = this.state.workspace.documents.map((d) => d.id);
    const doc = newDocument(kind, uniqueId(kind, ids));
    if (kind !== 'blank') this.carryIdentity(doc);
    this.commit(() => { this.state.workspace.documents.push(doc); this.state.activeId = doc.id; });
    this.setHash();
  }
  /** A new document borrows the name and contact lines the workspace already knows. */
  private carryIdentity(doc: QDocument): void {
    const isHead = (b: Block | undefined): b is Extract<Block, { type: 'masthead' | 'docmast' }> => b?.type === 'masthead' || b?.type === 'docmast';
    const source = this.state.workspace.documents.map((d) => d.blocks[0]).find(isHead);
    const first = doc.blocks[0];
    if (!source || !first) return;
    const name = source.type === 'masthead' ? source.name : source.contact[0] ?? '';
    const contact = source.type === 'masthead' ? [name, ...source.contact] : source.contact;
    if (first.type === 'masthead' && source.type === 'masthead') { first.name = source.name; first.creds = source.creds; first.contact = [...source.contact]; }
    if (first.type === 'docmast') first.contact = [...contact];
    const sig = doc.blocks.find((b) => b.type === 'signoff');
    if (sig && sig.type === 'signoff' && name) sig.name = name;
  }
  private setActive(id: string): void {
    if (!this.state.workspace.documents.some((d) => d.id === id)) return;
    this.state.activeId = id;
    this.past = []; this.future = [];
    this.save(); this.setHash(); this.render();
  }
  private setHash(): void { history.replaceState(null, '', `#${encodeURIComponent(this.state.activeId)}`); }
  private duplicateDocument(): void {
    const doc = this.doc;
    if (!doc) return;
    const copy = clone(doc);
    copy.id = uniqueId(doc.id, this.state.workspace.documents.map((d) => d.id));
    copy.title = `${doc.title} (copy)`;
    const at = this.state.workspace.documents.indexOf(doc) + 1;
    this.commit(() => { this.state.workspace.documents.splice(at, 0, copy); this.state.activeId = copy.id; });
    this.setHash();
  }
  private deleteDocument(): void {
    const doc = this.doc;
    if (!doc) return;
    if (!confirm(`Delete "${doc.title}"? Undo brings it back until you leave the page; a saved version keeps it for good.`)) return;
    const docs = this.state.workspace.documents;
    const at = docs.indexOf(doc);
    this.commit(() => { docs.splice(at, 1); this.state.activeId = (docs[at] ?? docs[at - 1])?.id ?? ''; });
    this.setHash();
  }
  private moveDocument(delta: number): void {
    const docs = this.state.workspace.documents;
    const at = docs.findIndex((d) => d.id === this.state.activeId);
    const to = at + delta;
    if (at === -1 || to < 0 || to >= docs.length) return;
    this.commit(() => { const [d] = docs.splice(at, 1); if (d) docs.splice(to, 0, d); });
  }

  /* ---------- Files, versions, reset ---------- */

  exportJSON(): string { return JSON.stringify(this.state.workspace, null, 1); }
  importJSON(text: string): void {
    const ws = migrate(JSON.parse(text) as unknown);
    this.pushVersion('Before opening a file');
    this.commit(() => { this.state.workspace = ws; this.state.activeId = ws.documents[0]?.id ?? ''; });
    this.setHash();
  }
  private saveFile(): void {
    const stamp = new Date().toISOString().slice(0, 10);
    const name = documentName(this.doc ?? this.state.workspace.documents[0] ?? newDocument('blank')).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'workspace';
    const blob = new Blob([this.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-${stamp}.quire.json`;
    document.body.append(a);
    a.click();
    window.setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    this.notify('Saved. Keep the file with the application it belongs to.');
  }
  private async openFile(file: File): Promise<void> {
    try { this.importJSON(await file.text()); this.notify(`Opened ${file.name}.`); }
    catch (err) { this.notify(`Could not open ${file.name}: ${err instanceof Error ? err.message : String(err)}`, true); }
  }
  /** Load a workspace from ?open=. XMLHttpRequest, not fetch: Chromium lets XHR read file:// when started with --allow-file-access-from-files, which is how a headless build renders an application's own file. */
  async openFromURL(url: string): Promise<void> {
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = () => (xhr.status === 200 || xhr.status === 0 ? resolve(xhr.responseText) : reject(new Error(`${xhr.status} ${xhr.statusText}`)));
        xhr.onerror = () => reject(new Error('the file could not be read from this address'));
        xhr.send();
      });
      const ws = migrate(JSON.parse(text) as unknown);
      this.state = { workspace: ws, activeId: ws.documents[0]?.id ?? '' };
      const hashDoc = decodeURIComponent(location.hash.slice(1));
      if (hashDoc && ws.documents.some((d) => d.id === hashDoc)) this.state.activeId = hashDoc;
      this.render();
    } catch (err) {
      this.notify(`Could not open ${url}: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  }
  private reset(): void {
    if (!confirm('Replace everything with the sample workspace? Save a file first if you want to keep your work.')) return;
    this.pushVersion('Before reset');
    this.commit(() => { this.state.workspace = clone(this.seed); this.state.activeId = this.seed.documents[0]?.id ?? ''; });
    this.setHash();
  }

  private versions(): Version[] {
    try { return JSON.parse(localStorage.getItem(VERSIONS) ?? '[]') as Version[]; } catch { return []; }
  }
  private pushVersion(label: string): void {
    const list = this.versions();
    list.unshift({ at: new Date().toISOString(), label, workspace: clone(this.state.workspace) });
    try { localStorage.setItem(VERSIONS, JSON.stringify(list.slice(0, 15))); } catch { /* storage full or blocked */ }
  }
  private restoreVersion(index: number): void {
    const v = this.versions()[index];
    if (!v) return;
    if (!confirm(`Restore the version saved ${this.when(v.at)}? Your current text is kept as a version too.`)) return;
    this.pushVersion('Before restore');
    const ws = migrate(v.workspace);
    this.commit(() => { this.state.workspace = ws; if (!ws.documents.some((d) => d.id === this.state.activeId)) this.state.activeId = ws.documents[0]?.id ?? ''; });
  }
  private when(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} at ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
  }

  /* ------------------------------------------------------------------ */
  /* Panels                                                              */
  /* ------------------------------------------------------------------ */

  private openPanel(id: string, opener: HTMLElement): void {
    if (this.openPanelId === id) { this.closePanels(); return; }
    this.closePanels();
    this.openPanelId = id;
    this.panelOpener = opener;
    opener.setAttribute('aria-expanded', 'true');
    this.refreshPanel();
    const panel = $(`#${id}`);
    const r = opener.getBoundingClientRect();
    panel.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - panel.offsetWidth - 12))}px`;
    panel.querySelector<HTMLElement>('input, select, button:not(.panel-close)')?.focus();
  }
  private closePanels(): void {
    $('#shortcuts').hidden = true;
    if (!this.openPanelId) return;
    $(`#${this.openPanelId}`).hidden = true;
    this.panelOpener?.setAttribute('aria-expanded', 'false');
    this.panelOpener?.focus();
    this.openPanelId = null;
    this.panelOpener = null;
  }
  private toggleMenu(id: string, opener: HTMLElement): void {
    const menu = $(`#${id}`);
    const willOpen = menu.hidden;
    this.closePanels();
    this.hideMenus();
    menu.hidden = !willOpen;
    opener.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) menu.querySelector<HTMLElement>('button, [tabindex]')?.focus();
  }
  private hideMenus(): void {
    document.querySelectorAll<HTMLElement>('.menu').forEach((m) => { m.hidden = true; });
    document.querySelectorAll<HTMLElement>('[aria-haspopup="menu"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  private refreshPanel(): void {
    const id = this.openPanelId;
    if (!id) return;
    const panel = $(`#${id}`);
    const body = panel.querySelector<HTMLElement>('.panel-body');
    if (!body) return;
    body.innerHTML = '';
    switch (id) {
      case 'panel-design': body.append(...this.designPanel()); break;
      case 'panel-running': body.append(...this.runningPanel()); break;
      case 'panel-doc': body.append(...this.docPanel()); break;
      case 'panel-versions': body.append(...this.versionsPanel()); break;
    }
    panel.hidden = false;
  }

  private field(label: string, control: HTMLElement, hint = ''): HTMLElement {
    const id = control.id || `f-${Math.random().toString(36).slice(2, 8)}`;
    control.id = id;
    const lab = h('label', 'f-label', label);
    lab.htmlFor = id;
    const wrap = h('div', 'field', lab, control);
    if (hint) wrap.append(h('p', 'f-hint', hint));
    return wrap;
  }
  private select(id: string, options: { value: string; label: string }[], value: string, onChange: (v: string) => void): HTMLSelectElement {
    const s = h('select');
    s.id = id;
    for (const o of options) s.append(new Option(o.label, o.value, false, o.value === value));
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  private input(id: string, value: string, onChange: (v: string) => void, attrs: Partial<HTMLInputElement> = {}): HTMLInputElement {
    const i = h('input');
    i.id = id;
    Object.assign(i, attrs);
    i.value = value;
    i.addEventListener('change', () => onChange(i.value));
    return i;
  }
  private setDesign(patch: Partial<Design>): void {
    this.commit(() => Object.assign(this.state.workspace.design, patch));
  }

  private designPanel(): HTMLElement[] {
    const d = this.state.workspace.design;
    const swatches = h('div', 'swatches');
    for (const s of SCHEMES) {
      const b = h('button', 'swatch' + (d.scheme === s.id ? ' on' : ''));
      b.type = 'button';
      b.style.setProperty('--sw', s.accent);
      b.title = s.label;
      b.setAttribute('aria-label', `${s.label} scheme`);
      b.setAttribute('aria-pressed', String(d.scheme === s.id));
      b.addEventListener('click', () => this.setDesign({ scheme: s.id, accent: s.accent }));
      swatches.append(b);
    }
    const custom = this.input('design-accent', d.accent, (v) => this.setDesign({ scheme: 'custom', accent: v }), { type: 'color' });
    custom.title = 'Custom accent';
    custom.setAttribute('aria-label', 'Custom accent colour');
    swatches.append(custom);
    const scheme = this.select('design-scheme', [...SCHEMES.map((s) => ({ value: s.id, label: s.label })), { value: 'custom', label: 'Custom' }], d.scheme, (v) => {
      const s = SCHEMES.find((x) => x.id === v);
      this.setDesign(s ? { scheme: s.id, accent: s.accent } : { scheme: 'custom' });
    });
    const reset = h('button', 'link', 'Restore defaults');
    reset.type = 'button'; reset.id = 'design-reset';
    reset.addEventListener('click', () => this.commit(() => { this.state.workspace.design = defaultDesign(); }));
    return [
      this.field('Colour scheme', h('div', 'scheme-row', swatches, scheme)),
      h('div', 'field-row',
        this.field('Body type', this.select('design-body-font', BODY_FONTS.map((f) => ({ value: f.id, label: f.label })), d.bodyFont, (v) => this.setDesign({ bodyFont: v }))),
        this.field('Labels', this.select('design-label-font', LABEL_FONTS.map((f) => ({ value: f.id, label: f.label })), d.labelFont, (v) => this.setDesign({ labelFont: v })))),
      h('div', 'field-row',
        this.field('Type size', this.select('design-size', BASE_SIZES.map((n) => ({ value: String(n), label: `${n} pt` })), String(d.baseSize), (v) => this.setDesign({ baseSize: Number(v) }))),
        this.field('Spacing', this.select('design-density', [{ value: '0.85', label: 'Compact' }, { value: '1', label: 'Standard' }, { value: '1.2', label: 'Open' }], String(d.density), (v) => this.setDesign({ density: Number(v) })))),
      h('div', 'field-row',
        this.field('Top and bottom margin', this.input('design-margin-top', String(d.marginTop), (v) => this.setDesign({ marginTop: this.clampNum(v, 8, 30, 14) }), { type: 'number', min: '8', max: '30', step: '1' }), 'mm'),
        this.field('Side margins', this.input('design-margin-side', String(d.marginSide), (v) => this.setDesign({ marginSide: this.clampNum(v, 10, 35, 17) }), { type: 'number', min: '10', max: '35', step: '1' }), 'mm')),
      h('div', 'panel-foot', reset),
    ];
  }
  private clampNum(v: string, min: number, max: number, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  private runningPanel(): HTMLElement[] {
    const doc = this.doc;
    if (!doc) return [h('p', 'f-hint', 'Open a document first.')];
    const slot = (zone: 'header' | 'footer', key: 'left' | 'centre' | 'right'): HTMLElement =>
      this.field(key === 'left' ? 'Left' : key === 'centre' ? 'Centre' : 'Right',
        this.input(`run-${zone}-${key}`, doc.running[zone][key], (v) => this.commit(() => { doc.running[zone][key] = v; }), { placeholder: key === 'centre' && zone === 'footer' ? 'Page {page} of {pages}' : '' }));
    const first = this.input('run-first', '', () => undefined, { type: 'checkbox' });
    first.checked = doc.running.firstPage;
    first.addEventListener('change', () => this.commit(() => { doc.running.firstPage = first.checked; }));
    const firstLab = h('label', 'check', first, ' Show on the first page too');
    firstLab.htmlFor = 'run-first';
    return [
      h('p', 'f-hint', 'Runs along the top and bottom of every printed page. Use {page}, {pages}, {name}, {title} and {date}.'),
      h('h3', 'panel-sub', 'Header'),
      h('div', 'field-row three', slot('header', 'left'), slot('header', 'centre'), slot('header', 'right')),
      h('h3', 'panel-sub', 'Footer'),
      h('div', 'field-row three', slot('footer', 'left'), slot('footer', 'centre'), slot('footer', 'right')),
      h('div', 'field', firstLab),
    ];
  }

  private docPanel(): HTMLElement[] {
    const doc = this.doc;
    if (!doc) return [h('p', 'f-hint', 'Open a document first.')];
    const docs = this.state.workspace.documents;
    const at = docs.indexOf(doc);
    const numbering: { value: Numbering; label: string }[] = [
      { value: 'both', label: 'Number and label' }, { value: 'number', label: 'Number only' }, { value: 'label', label: 'Label only' }, { value: 'none', label: 'None' },
    ];
    const limit = (id: string, value: number | null, apply: (n: number | null) => void): HTMLInputElement =>
      this.input(id, value == null ? '' : String(value), (v) => { const n = Number(v); apply(v.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : Math.round(n)); }, { type: 'number', min: '0', step: '10', placeholder: 'None' });
    const btn = (id: string, label: string, name: IconName, onClick: () => void, disabled = false): HTMLButtonElement => {
      const b = h('button', 'panel-btn', icon(name), ` ${label}`);
      b.type = 'button'; b.id = id; b.disabled = disabled;
      b.addEventListener('click', onClick);
      return b;
    };
    return [
      this.field('Title', this.input('doc-title', doc.title, (v) => this.commit(() => { doc.title = v.trim() || 'Untitled document'; }))),
      h('div', 'field-row',
        this.field('Word limit, whole document', limit('doc-word-limit', doc.wordLimit, (n) => this.commit(() => { doc.wordLimit = n; }))),
        this.field('Word limit, each criterion', limit('doc-block-limit', doc.blockWordLimit, (n) => this.commit(() => { doc.blockWordLimit = n; })))),
      this.field('Criterion numbering', this.select('doc-numbering', numbering, doc.numbering, (v) => this.commit(() => { doc.numbering = v as Numbering; }))),
      h('h3', 'panel-sub', 'Copy for a portal'),
      h('div', 'btn-row',
        btn('doc-copy-text', 'Copy as plain text', 'copy', () => this.copy(toPlainText(doc), 'Plain text copied.')),
        btn('doc-copy-md', 'Copy as Markdown', 'copy', () => this.copy(toMarkdown(doc), 'Markdown copied.'))),
      h('h3', 'panel-sub', 'This document'),
      h('div', 'btn-row',
        btn('doc-left', 'Move left', 'caretLeft', () => this.moveDocument(-1), at <= 0),
        btn('doc-right', 'Move right', 'caretRight', () => this.moveDocument(1), at >= docs.length - 1),
        btn('doc-duplicate', 'Duplicate', 'copy', () => { this.closePanels(); this.duplicateDocument(); }),
        btn('doc-delete', 'Delete', 'trash', () => { const p = this.openPanelId; this.deleteDocument(); if (this.doc && p) this.closePanels(); })),
    ];
  }
  private copy(text: string, done: string): void {
    navigator.clipboard?.writeText(text).then(() => this.notify(done), () => this.notify('The browser refused clipboard access. Save a file instead.', true));
  }

  private versionsPanel(): HTMLElement[] {
    const list = this.versions();
    const save = h('button', 'panel-btn primary', icon('save'), ' Save a version now');
    save.type = 'button'; save.id = 'version-save';
    save.addEventListener('click', () => { this.pushVersion('Saved by you'); this.refreshPanel(); });
    const rows = h('ol', 'versions');
    list.forEach((v, i) => {
      const restore = h('button', 'version-restore', 'Restore');
      restore.type = 'button';
      restore.addEventListener('click', () => this.restoreVersion(i));
      rows.append(h('li', null, h('span', 'v-when', this.when(v.at)), h('span', 'v-label', `${v.label} · ${v.workspace.documents.length} ${v.workspace.documents.length === 1 ? 'document' : 'documents'}`), restore));
    });
    return [
      h('p', 'f-hint', 'Versions live in this browser, for this file. Save a file to keep work anywhere else.'),
      save,
      list.length ? rows : h('p', 'f-hint', 'No versions yet.'),
    ];
  }

  /* ------------------------------------------------------------------ */
  /* Notifications                                                       */
  /* ------------------------------------------------------------------ */

  private notify(message: string, isError = false): void {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.hidden = false;
    clearTimeout(Number(toast.dataset.timer));
    toast.dataset.timer = String(window.setTimeout(() => { toast.hidden = true; }, isError ? 6000 : 2600));
  }

  /* ------------------------------------------------------------------ */
  /* Flags                                                               */
  /* ------------------------------------------------------------------ */

  private nextFlag(): void {
    const flags = [...this.sheet.querySelectorAll<HTMLElement>('.flag')];
    if (!flags.length) return;
    this.flagCursor = (this.flagCursor + 1) % flags.length;
    const flag = flags[this.flagCursor];
    const host = flag?.closest<HTMLElement>('[contenteditable]');
    if (!flag || !host) return;
    host.focus();
    const range = document.createRange();
    range.selectNodeContents(flag);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    flag.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  private bind(): void {
    const sheet = this.sheet;

    sheet.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset?.path) this.textEditPending = true;
      this.markCurrent(target.closest<HTMLElement>('.blk:has(> .ctl[data-list="blocks"])'));
    });
    sheet.addEventListener('input', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-path]');
      if (!el || !this.doc) return;
      if (this.textEditPending) { this.snapshot(); this.textEditPending = false; }
      set(this.doc, pparse(el.dataset.path!), readText(el));
      this.saveSoon();
      this.updateStatusSoon();
      this.updateBadgeFor(el);
    });
    sheet.addEventListener('paste', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[contenteditable]');
      if (!el) return;
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const single = el.dataset.kind === 'single';
      document.execCommand('insertText', false, single ? text.replace(/\s*\n\s*/g, ' ') : text);
    });
    sheet.addEventListener('keydown', (e) => this.onSheetKey(e));
    sheet.addEventListener('click', (e) => this.onSheetClick(e));

    this.rail.addEventListener('click', (e) => this.onRailClick(e));
    this.rail.addEventListener('dragstart', (e) => this.onDragStart(e));
    this.rail.addEventListener('dragover', (e) => this.onDragOver(e));
    this.rail.addEventListener('dragleave', () => this.clearDropMarks());
    this.rail.addEventListener('drop', (e) => this.onDrop(e));
    this.rail.addEventListener('dragend', () => { this.drag = null; this.clearDropMarks(); });

    $('#tabs').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('.tab');
      if (t?.dataset.doc) this.setActive(t.dataset.doc);
    });
    $('#add-doc').addEventListener('click', (e) => this.toggleMenu('menu-add-doc', e.currentTarget as HTMLElement));
    $('#menu-add-doc').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-template]');
      if (!b) return;
      $('#menu-add-doc').hidden = true;
      this.addDocument(b.dataset.template as DocKind);
    });
    $<HTMLSelectElement>('#add-section').addEventListener('change', (e) => {
      const sel = e.currentTarget as HTMLSelectElement;
      const v = sel.value;
      sel.value = '';
      if (v) this.addBlock(v);
    });
    $('#undo').addEventListener('click', () => this.undo());
    $('#redo').addEventListener('click', () => this.redo());
    $('#design').addEventListener('click', (e) => this.openPanel('panel-design', e.currentTarget as HTMLElement));
    $('#running').addEventListener('click', (e) => this.openPanel('panel-running', e.currentTarget as HTMLElement));
    $('#doc-menu').addEventListener('click', (e) => this.openPanel('panel-doc', e.currentTarget as HTMLElement));
    $('#file').addEventListener('click', (e) => this.toggleMenu('menu-file', e.currentTarget as HTMLElement));
    $('#versions').addEventListener('click', () => { this.hideMenus(); this.openPanel('panel-versions', $('#file')); });
    $('#open-label').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#open-file').click(); } });
    $('#save').addEventListener('click', () => { this.hideMenus(); this.saveFile(); });
    $<HTMLInputElement>('#open-file').addEventListener('change', (e) => {
      const input = e.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (file) void this.openFile(file);
      input.value = '';
    });
    $('#reset').addEventListener('click', () => { this.hideMenus(); this.reset(); });
    $('#print').addEventListener('click', () => this.print());
    $('#flags').addEventListener('click', () => this.nextFlag());
    $('#help').addEventListener('click', () => { const s = $('#shortcuts'); const open = s.hidden; this.closePanels(); this.hideMenus(); s.hidden = !open; });
    $('#rail-toggle').addEventListener('click', (e) => {
      const on = document.body.classList.toggle('rail-hidden');
      (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(!on));
      try { localStorage.setItem('quire:rail', on ? 'hidden' : 'shown'); } catch { /* fine */ }
    });
    if (localStorage.getItem('quire:rail') === 'hidden') { document.body.classList.add('rail-hidden'); $('#rail-toggle').setAttribute('aria-pressed', 'false'); }
    document.querySelectorAll<HTMLElement>('.panel-close').forEach((b) => b.addEventListener('click', () => this.closePanels()));

    document.addEventListener('click', (e) => {
      /* The composed path is fixed at dispatch, so a control that re-rendered its own panel
         during the click still counts as inside it. */
      const path = e.composedPath().filter((n): n is HTMLElement => n instanceof HTMLElement);
      const inside = (test: (el: HTMLElement) => boolean): boolean => path.some(test);
      if (this.openPanelId && !inside((el) => el.classList.contains('panel') || el.classList.contains('toolbar'))) this.closePanels();
      if (!inside((el) => el.classList.contains('menu') || el.getAttribute('aria-haspopup') === 'menu')) this.hideMenus();
      if (!$('#shortcuts').hidden && !inside((el) => el.id === 'shortcuts' || el.id === 'help')) $('#shortcuts').hidden = true;
      if (!$('#palette').hidden && !inside((el) => el.id === 'palette')) this.closePalette();
    });
    document.addEventListener('keydown', (e) => this.onGlobalKey(e));
    sheet.addEventListener('contextmenu', (e) => this.openContextMenu(e));
    document.addEventListener('selectionchange', () => { clearTimeout(this.bubbleTimer); this.bubbleTimer = window.setTimeout(() => this.updateBubble(), 80); });
    $('#bubble').addEventListener('mousedown', (e) => e.preventDefault());   /* keep the text selection */
    $('#bubble').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-command]');
      const c = b && this.commands().find((x) => x.id === b.dataset.command);
      if (!c) return;
      this.saveSelection();
      c.run();
      $('#bubble').hidden = true;
    });
    const paletteInput = $<HTMLInputElement>('#palette-input');
    paletteInput.addEventListener('input', () => this.renderPalette(paletteInput.value));
    paletteInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.setPaletteIndex(this.paletteIndex + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.setPaletteIndex(this.paletteIndex - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.runPalette(this.paletteIndex); }
    });
    window.addEventListener('beforeprint', () => this.sheet.querySelectorAll('.guide').forEach((g) => g.remove()));
    window.addEventListener('afterprint', () => this.updateStatus());
    window.addEventListener('hashchange', () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id !== this.state.activeId) this.setActive(id);
    });
    window.addEventListener('resize', () => this.updateStatusSoon());
    sheet.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.start-btn');
      if (b?.dataset.template) this.addDocument(b.dataset.template as DocKind);
    });
  }

  private markCurrent(block: HTMLElement | null): void {
    this.sheet.querySelectorAll('.current-block').forEach((b) => b.classList.remove('current-block'));
    this.rail.querySelectorAll('.rail-row.current').forEach((r) => r.classList.remove('current'));
    if (!block) return;
    block.classList.add('current-block');
    const index = block.querySelector<HTMLElement>(':scope > .ctl[data-list="blocks"]')?.dataset.index;
    const row = this.rail.querySelector<HTMLElement>(`.rail-row[data-index="${index}"]`);
    row?.classList.add('current');
    row?.scrollIntoView({ block: 'nearest' });
  }

  private updateBadgeFor(el: HTMLElement): void {
    const block = el.closest<HTMLElement>('.blk:is(section, .opening)');
    const badge = block?.querySelector<HTMLElement>(':scope > .wc');
    const doc = this.doc;
    if (!block || !badge || !doc) return;
    const index = Number(block.querySelector<HTMLElement>(':scope > .ctl[data-list="blocks"]')?.dataset.index);
    const b = doc.blocks[index];
    if (!b) return;
    const n = blockWords(b);
    const limit = b.type === 'criterion' ? doc.blockWordLimit : null;
    badge.textContent = limit ? `${n} / ${limit}` : `${n} ${n === 1 ? 'word' : 'words'}`;
    badge.classList.toggle('over', !!limit && n > limit);
    const row = this.rail.querySelector<HTMLElement>(`.rail-row[data-index="${index}"] .rail-title .n`);
    if (row) row.textContent = String(n);
  }

  private onSheetKey(e: KeyboardEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-path]');
    if (!el || !this.doc) return;
    const kind = el.dataset.kind;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && !e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold'); return; }
    if (mod && !e.altKey && e.key.toLowerCase() === 'i') { e.preventDefault(); document.execCommand('italic'); return; }
    if (mod && e.key.toLowerCase() === 'u') { e.preventDefault(); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); this.savedRange = null; this.flag(); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      this.moveFrom(el, e.key === 'ArrowUp' ? -1 : 1, e.shiftKey);
      return;
    }

    if (e.key === 'Enter') {
      if (kind === 'lines') { if (!e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); } return; }
      e.preventDefault();
      if (kind === 'item') this.addItemAfter(el);
      return;
    }
    if (e.key === 'Backspace' && kind === 'item' && readText(el).trim() === '' && caretAtStart(el)) {
      const path = pparse(el.dataset.path!);
      const isField = typeof path[path.length - 1] === 'string';
      const listPath = isField ? path.slice(0, -2) : path.slice(0, -1);
      const index = (isField ? path[path.length - 2] : path[path.length - 1]) as number;
      const list = get(this.doc, listPath) as unknown[];
      if (list.length <= 1) return;
      const item = list[index];
      if (typeof item !== 'string' && Object.entries(item as Record<string, string>).some(([k, v]) => k !== 'label' && v.trim())) return;
      e.preventDefault();
      this.removeAt(pstr(listPath), index);
      const prev = (get(this.doc, listPath) as unknown[])[index - 1];
      const target = this.sheet.querySelector<HTMLElement>(`[data-path="${pstr(listPath.concat(index - 1, typeof prev === 'string' ? [] : ['text']))}"]`);
      if (target) placeCaret(target, true);
    }
  }

  /** The list member (bullet, paragraph, entry) or block the run belongs to, and its controls. */
  private navFor(el: HTMLElement, wholeBlock: boolean): HTMLElement | null {
    return wholeBlock
      ? el.closest<HTMLElement>('.blk:has(> .ctl[data-list="blocks"])')?.querySelector<HTMLElement>(':scope > .ctl[data-list="blocks"]') ?? null
      : el.closest<HTMLElement>('.blk')?.querySelector<HTMLElement>(':scope > .ctl') ?? null;
  }
  private moveFrom(el: HTMLElement, delta: number, wholeBlock: boolean): void {
    const nav = this.navFor(el, wholeBlock);
    if (nav?.dataset.list) this.move(nav.dataset.list, Number(nav.dataset.index), Number(nav.dataset.index) + delta);
  }
  private removeFrom(el: HTMLElement, wholeBlock: boolean): void {
    const nav = this.navFor(el, wholeBlock);
    if (nav?.dataset.list) this.removeAt(nav.dataset.list, Number(nav.dataset.index));
  }
  private addItemAfter(el: HTMLElement): void {
    if (!this.doc || el.dataset.kind !== 'item' || !el.dataset.path) return;
    const path = pparse(el.dataset.path);
    const isField = typeof path[path.length - 1] === 'string';
    const listPath = isField ? path.slice(0, -2) : path.slice(0, -1);
    const index = (isField ? path[path.length - 2] : path[path.length - 1]) as number;
    const current = (get(this.doc, listPath) as unknown[])[index];
    const fresh = typeof current === 'string' ? '' : Object.fromEntries(Object.entries(current as Record<string, string>).map(([k, v]) => [k, k === 'label' ? v : '']));
    this.insertAt(pstr(listPath), index + 1, fresh);
  }

  /* ------------------------------------------------------------------ */
  /* Commands: one list behind the selection toolbar, the right-click menu and Ctrl+K */
  /* ------------------------------------------------------------------ */

  private currentRun(): HTMLElement | null {
    const node = getSelection()?.anchorNode;
    const el = node instanceof HTMLElement ? node : node?.parentElement;
    return el?.closest<HTMLElement>('#sheet [data-path]') ?? null;
  }
  private context(run: HTMLElement | null = this.currentRun()): CommandContext {
    const sel = getSelection();
    return {
      hasDocument: !!this.doc,
      inText: !!run,
      hasSelection: !!run && !!sel && !sel.isCollapsed,
      inFlag: !!run && !!flagAtSelection(),
      inItem: run?.dataset.kind === 'item',
      inBlock: !!run?.closest('.blk:has(> .ctl[data-list="blocks"])'),
    };
  }
  /** Keep the text selection across a palette or menu, which take focus. */
  private saveSelection(): void {
    const sel = getSelection();
    this.savedRange = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  }
  private restoreSelection(): HTMLElement | null {
    const range = this.savedRange;
    if (!range) return null;
    const node = range.commonAncestorContainer;
    const host = (node instanceof HTMLElement ? node : node.parentElement)?.closest<HTMLElement>('#sheet [contenteditable]');
    if (!host) return null;
    host.focus({ preventScroll: true });
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return host;
  }
  private inRun(fn: (run: HTMLElement) => void): void {
    const run = this.restoreSelection() ?? this.currentRun();
    if (run) fn(run);
  }
  private format(command: 'bold' | 'italic'): void {
    this.inRun((run) => { document.execCommand(command); run.dispatchEvent(new Event('input', { bubbles: true })); });
  }
  private flag(): void {
    this.inRun((run) => {
      if (flagSelection()) run.dispatchEvent(new Event('input', { bubbles: true }));
      else this.notify('Put the caret in a word, or select the words to flag.');
    });
  }
  private removeFlag(): void {
    this.inRun((run) => { const span = flagAtSelection(); if (span) { unflag(span); run.dispatchEvent(new Event('input', { bubbles: true })); } });
  }

  private commands(): Command[] {
    const doc = this.doc;
    const list: Command[] = [
      { id: 'bold', label: 'Bold', group: 'Format', keys: 'Ctrl B', when: (c) => c.hasSelection, contextual: true, run: () => this.format('bold') },
      { id: 'italic', label: 'Italic', group: 'Format', keys: 'Ctrl I', when: (c) => c.hasSelection, contextual: true, run: () => this.format('italic') },
      { id: 'flag', label: 'Flag for confirmation', group: 'Format', keys: 'Ctrl Shift F', when: (c) => c.inText && !c.inFlag, contextual: true, run: () => this.flag() },
      { id: 'unflag', label: 'Remove flag', group: 'Format', when: (c) => c.inFlag, contextual: true, run: () => this.removeFlag() },
      { id: 'add-item', label: 'Add one below', group: 'Structure', keys: 'Enter', when: (c) => c.inItem, contextual: true, run: () => this.inRun((r) => this.addItemAfter(r)) },
      { id: 'item-up', label: 'Move up', group: 'Structure', keys: 'Alt ↑', when: (c) => c.inItem || c.inBlock, contextual: true, run: () => this.inRun((r) => this.moveFrom(r, -1, false)) },
      { id: 'item-down', label: 'Move down', group: 'Structure', keys: 'Alt ↓', when: (c) => c.inItem || c.inBlock, contextual: true, run: () => this.inRun((r) => this.moveFrom(r, 1, false)) },
      { id: 'block-up', label: 'Move section up', group: 'Structure', keys: 'Alt Shift ↑', when: (c) => c.inBlock, contextual: true, run: () => this.inRun((r) => this.moveFrom(r, -1, true)) },
      { id: 'block-down', label: 'Move section down', group: 'Structure', keys: 'Alt Shift ↓', when: (c) => c.inBlock, contextual: true, run: () => this.inRun((r) => this.moveFrom(r, 1, true)) },
      { id: 'pagebreak', label: 'Start section on a new page', group: 'Structure', when: (c) => c.inBlock, contextual: true, run: () => this.inRun((r) => { const nav = this.navFor(r, true); if (nav) this.togglePageBreak(Number(nav.dataset.index)); }) },
      { id: 'remove-item', label: 'Remove this one', group: 'Structure', when: (c) => c.inItem, contextual: true, run: () => this.inRun((r) => this.removeFrom(r, false)) },
      { id: 'remove-block', label: 'Remove section', group: 'Structure', when: (c) => c.inBlock, contextual: true, run: () => this.inRun((r) => this.removeFrom(r, true)) },
      ...ADDABLE.map<Command>((a) => ({ id: `add-${a.value}`, label: a.label, group: 'Insert', when: (c) => c.hasDocument, run: () => this.addBlock(a.value) })),
      ...(doc ? doc.blocks.map<Command>((b, i) => ({ id: `goto-${i}`, label: this.blockTitle(b, i, doc), group: 'Go to', run: () => this.gotoBlock(i) })) : []),
      { id: 'new-cv', label: 'New curriculum vitae', group: 'Document', run: () => this.addDocument('cv') },
      { id: 'new-criteria', label: 'New criteria response', group: 'Document', run: () => this.addDocument('criteria') },
      { id: 'new-letter', label: 'New cover letter', group: 'Document', run: () => this.addDocument('letter') },
      { id: 'design', label: 'Design: colour, type, margins', group: 'Document', run: () => this.openPanel('panel-design', $('#design')) },
      { id: 'running', label: 'Header and footer', group: 'Document', when: (c) => c.hasDocument, run: () => this.openPanel('panel-running', $('#running')) },
      { id: 'doc-settings', label: 'Document: title, word limits, numbering', group: 'Document', when: (c) => c.hasDocument, run: () => this.openPanel('panel-doc', $('#doc-menu')) },
      { id: 'copy-text', label: 'Copy document as plain text', group: 'Document', when: (c) => c.hasDocument, run: () => { if (this.doc) this.copy(toPlainText(this.doc), 'Plain text copied.'); } },
      { id: 'copy-md', label: 'Copy document as Markdown', group: 'Document', when: (c) => c.hasDocument, run: () => { if (this.doc) this.copy(toMarkdown(this.doc), 'Markdown copied.'); } },
      { id: 'next-flag', label: 'Go to the next flag', group: 'Document', when: () => this.sheet.querySelectorAll('.flag').length > 0, run: () => this.nextFlag() },
      { id: 'print', label: 'Export PDF', group: 'File', keys: 'Ctrl P', run: () => this.print() },
      { id: 'save', label: 'Save file', group: 'File', keys: 'Ctrl S', run: () => this.saveFile() },
      { id: 'open', label: 'Open file', group: 'File', keys: 'Ctrl O', run: () => $('#open-file').click() },
      { id: 'versions', label: 'Versions', group: 'File', run: () => this.openPanel('panel-versions', $('#file')) },
      { id: 'undo', label: 'Undo', group: 'File', keys: 'Ctrl Z', when: () => this.past.length > 0, run: () => this.undo() },
      { id: 'redo', label: 'Redo', group: 'File', keys: 'Ctrl Shift Z', when: () => this.future.length > 0, run: () => this.redo() },
      { id: 'shortcuts', label: 'Keyboard shortcuts', group: 'File', keys: '?', run: () => $('#help').click() },
    ];
    return list;
  }
  private gotoBlock(index: number): void {
    const el = this.sheet.querySelector<HTMLElement>(`.ctl[data-list="blocks"][data-index="${index}"]`)?.parentElement;
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    el?.querySelector<HTMLElement>('[contenteditable]')?.focus({ preventScroll: true });
  }

  /* ---------- Selection toolbar ---------- */

  private updateBubble(): void {
    const bubble = $('#bubble');
    const sel = getSelection();
    const run = this.currentRun();
    if (!run || !sel || sel.rangeCount === 0 || (sel.isCollapsed && !flagAtSelection()) || this.openPanelId !== null) { bubble.hidden = true; return; }
    const ctx = this.context(run);
    bubble.querySelector<HTMLElement>('[data-command="bold"]')!.hidden = !ctx.hasSelection;
    bubble.querySelector<HTMLElement>('[data-command="italic"]')!.hidden = !ctx.hasSelection;
    bubble.querySelector<HTMLElement>('.bubble-sep')!.hidden = !ctx.hasSelection;
    bubble.querySelector<HTMLElement>('[data-command="flag"]')!.hidden = ctx.inFlag;
    bubble.querySelector<HTMLElement>('[data-command="unflag"]')!.hidden = !ctx.inFlag;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { bubble.hidden = true; return; }
    bubble.hidden = false;
    const w = bubble.offsetWidth;
    bubble.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - w / 2, window.innerWidth - w - 8))}px`;
    bubble.style.top = `${Math.max(8, rect.top - bubble.offsetHeight - 8)}px`;
  }

  /* ---------- Right-click menu ---------- */

  private openContextMenu(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const run = target.closest<HTMLElement>('#sheet [data-path]');
    if (!run || e.shiftKey) return;   /* Shift keeps the browser's own menu, with spelling suggestions */
    e.preventDefault();
    this.closePanels();
    this.hideMenus();
    const sel = getSelection();
    if (sel && (sel.isCollapsed || !run.contains(sel.anchorNode))) {
      const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (range && run.contains(range.startContainer)) { sel.removeAllRanges(); sel.addRange(range); }
    }
    this.saveSelection();
    const menu = $('#context');
    menu.innerHTML = '';
    const items = applicable(this.commands(), this.context(run)).filter((c) => c.contextual);
    let group = '';
    for (const c of items) {
      if (c.group !== group) { if (group) menu.append(h('span', 'menu-sep')); group = c.group; }
      const b = h('button', null, h('span', null, c.label), c.keys ? h('kbd', null, c.keys) : null);
      b.type = 'button'; b.role = 'menuitem'; b.dataset.command = c.id;
      b.addEventListener('click', () => { menu.hidden = true; c.run(); });
      menu.append(b);
    }
    menu.hidden = false;
    const w = menu.offsetWidth, hgt = menu.offsetHeight;
    menu.style.left = `${Math.min(e.clientX, window.innerWidth - w - 8)}px`;
    menu.style.top = `${Math.min(e.clientY, window.innerHeight - hgt - 8)}px`;
    menu.querySelector<HTMLElement>('button')?.focus();
  }

  /* ---------- Command palette ---------- */

  private togglePalette(): void {
    const pal = $('#palette');
    if (!pal.hidden) { this.closePalette(); return; }
    this.saveSelection();
    this.closePanels();
    this.hideMenus();
    $('#bubble').hidden = true;
    const input = $<HTMLInputElement>('#palette-input');
    input.value = '';
    pal.hidden = false;
    this.renderPalette('');
    input.focus();
  }
  private closePalette(): void {
    $('#palette').hidden = true;
  }
  private renderPalette(query: string): void {
    const list = $('#palette-list');
    list.innerHTML = '';
    this.paletteItems = matchCommands(applicable(this.commands(), this.context(this.savedRun())), query).slice(0, 40);
    this.paletteIndex = 0;
    if (this.paletteItems.length === 0) { list.append(h('li', 'empty', 'Nothing matches. Try a section name, a block heading or an action.')); return; }
    this.paletteItems.forEach((c, i) => {
      const li = h('li', i === 0 ? 'active' : null, h('span', 'group', c.group), h('span', 'label', c.label), c.keys ? h('kbd', null, c.keys) : null);
      li.role = 'option'; li.dataset.index = String(i);
      li.addEventListener('mouseenter', () => this.setPaletteIndex(i));
      li.addEventListener('click', () => this.runPalette(i));
      list.append(li);
    });
  }
  private savedRun(): HTMLElement | null {
    const node = this.savedRange?.commonAncestorContainer;
    const el = node instanceof HTMLElement ? node : node?.parentElement;
    return el?.closest<HTMLElement>('#sheet [data-path]') ?? null;
  }
  private setPaletteIndex(i: number): void {
    this.paletteIndex = Math.max(0, Math.min(i, this.paletteItems.length - 1));
    $('#palette-list').querySelectorAll('li').forEach((li, k) => li.classList.toggle('active', k === this.paletteIndex));
    $('#palette-list').querySelector<HTMLElement>('li.active')?.scrollIntoView({ block: 'nearest' });
  }
  private runPalette(i: number): void {
    const c = this.paletteItems[i];
    this.closePalette();
    if (c) c.run();
  }

  private onSheetClick(e: MouseEvent): void {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!btn || !this.doc) return;
    if (btn.classList.contains('adder')) {
      const list = btn.dataset.list!;
      this.insertAt(list, this.listAt(list).length, this.makeItem(btn.dataset.make!, list));
      return;
    }
    const nav = btn.closest<HTMLElement>('.ctl');
    if (!nav?.dataset.list) return;
    const index = Number(nav.dataset.index);
    switch (btn.dataset.act) {
      case 'remove': this.removeAt(nav.dataset.list, index); break;
      case 'up': this.move(nav.dataset.list, index, index - 1); break;
      case 'down': this.move(nav.dataset.list, index, index + 1); break;
      case 'pagebreak': if (nav.dataset.list === 'blocks') this.togglePageBreak(index); break;
    }
  }

  private onRailClick(e: MouseEvent): void {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('button');
    const row = (e.target as HTMLElement).closest<HTMLElement>('.rail-row');
    if (!btn || !row) return;
    const index = Number(row.dataset.index);
    switch (btn.dataset.act) {
      case 'goto': {
        const el = this.sheet.querySelector<HTMLElement>(`.ctl[data-list="blocks"][data-index="${index}"]`)?.parentElement;
        el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        el?.querySelector<HTMLElement>('[contenteditable]')?.focus({ preventScroll: true });
        break;
      }
      case 'up': this.move('blocks', index, index - 1); break;
      case 'down': this.move('blocks', index, index + 1); break;
      case 'pagebreak': this.togglePageBreak(index); break;
      case 'remove': this.removeAt('blocks', index); break;
    }
  }
  private onDragStart(e: DragEvent): void {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.rail-row');
    if (!row || row.dataset.index === '0') { e.preventDefault(); return; }
    this.drag = { list: 'blocks', index: Number(row.dataset.index) };
    row.classList.add('dragging');
    e.dataTransfer?.setData('text/plain', row.dataset.index ?? '');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }
  private onDragOver(e: DragEvent): void {
    if (!this.drag) return;
    const row = (e.target as HTMLElement).closest<HTMLElement>('.rail-row');
    if (!row || row.dataset.index === '0') return;
    e.preventDefault();
    this.clearDropMarks();
    const r = row.getBoundingClientRect();
    row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  }
  private onDrop(e: DragEvent): void {
    if (!this.drag) return;
    const row = (e.target as HTMLElement).closest<HTMLElement>('.rail-row');
    if (!row) return;
    e.preventDefault();
    const target = Number(row.dataset.index);
    const before = row.classList.contains('drop-before');
    const from = this.drag.index;
    let to = before ? target : target + 1;
    if (from < to) to -= 1;
    this.drag = null;
    this.clearDropMarks();
    this.move('blocks', from, Math.max(1, to));
  }
  private clearDropMarks(): void {
    this.rail.querySelectorAll('.drop-before, .drop-after, .dragging').forEach((r) => r.classList.remove('drop-before', 'drop-after', 'dragging'));
  }

  private onGlobalKey(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey;
    const inText = !!(e.target as HTMLElement).closest('[contenteditable], input, select, textarea');
    if (e.key === 'Escape') { this.closePanels(); this.hideMenus(); this.closePalette(); $('#context').hidden = true; $('#bubble').hidden = true; return; }
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); this.togglePalette(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); this.saveFile(); return; }
    if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); this.print(); return; }
    if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); $('#open-file').click(); return; }
    if (mod && e.key.toLowerCase() === 'z' && !inText) { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && !inText) { e.preventDefault(); this.redo(); return; }
    if (e.key === '?' && !inText) { e.preventDefault(); $('#help').click(); }
  }

  private print(): void {
    this.closePanels();
    this.sheet.querySelectorAll('.guide').forEach((g) => g.remove());
    window.print();
  }

  /* Test and scripting surface, exposed as window.Quire. */
  get api(): QuireApi {
    const editor = this;
    return {
      readText,
      fill,
      exportJSON: () => editor.exportJSON(),
      importJSON: (t: string) => editor.importJSON(t),
      toPlainText,
      toMarkdown,
      validateWorkspace,
      render: () => editor.render(),
      get state(): State { return editor.state; },
    };
  }
}
