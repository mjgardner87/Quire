/**
 * Render one document into the sheet. The output is the printed document plus editor chrome
 * (controls, word badges) that the print stylesheet hides. Every editable run carries a
 * data-path into the document and a data-kind that decides what Enter and Backspace do.
 */
import { icon } from './icons';
import { blockWords, countsShown, pstr, type Block, type Path, type QDocument } from './model';
import { fill } from './text';

export type EditKind = 'single' | 'lines' | 'item';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | null, ...children: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const c of children) if (c != null) el.append(c);
  return el;
}

/** An editable run bound to a model path. */
export function ed(tag: keyof HTMLElementTagNameMap, cls: string | null, path: Path, text: string, kind: EditKind, placeholder = ''): HTMLElement {
  const el = h(tag, cls);
  el.contentEditable = 'true';
  el.spellcheck = true;
  el.lang = 'en-AU';
  el.dataset.path = pstr(path);
  el.dataset.kind = kind;
  if (placeholder) el.dataset.placeholder = placeholder;
  fill(el, text);
  return el;
}

function button(act: string, iconName: Parameters<typeof icon>[0], label: string, disabled = false): HTMLButtonElement {
  const b = h('button', null, icon(iconName));
  b.type = 'button';
  b.disabled = disabled;
  b.dataset.act = act;
  b.title = label;
  b.setAttribute('aria-label', label);
  return b;
}

/**
 * Controls for a list member. Block-level controls also offer a page break.
 *
 * A control that cannot act is disabled, on the same rules the rail uses: the masthead is the
 * first block and stays, nothing moves above it, and nothing moves past either end of its list.
 * The model refuses those moves anyway, so a live button here was a control that did nothing.
 */
export function ctl(listPath: Path, index: number, opts: { inline?: boolean; block?: boolean; pageBreak?: boolean; count?: number } = {}): HTMLElement {
  const nav = h('nav', 'ctl' + (opts.inline ? ' inline' : ''));
  nav.dataset.list = pstr(listPath);
  nav.dataset.index = String(index);
  nav.setAttribute('aria-label', opts.inline ? 'Item controls' : 'Block controls');
  if (opts.inline) { nav.append(button('remove', 'x', 'Remove (move with Alt+Arrow)')); return nav; }
  const last = (opts.count ?? 0) - 1;
  const first = opts.block ? index <= 1 : index === 0;
  nav.append(button('up', 'arrowUp', 'Move up', first), button('down', 'arrowDown', 'Move down', index === last || (opts.block && index === 0)));
  if (opts.block) {
    const pb = button('pagebreak', 'arrowLineDown', opts.pageBreak ? 'Remove page break before this block' : 'Start this block on a new page', index === 0);
    if (opts.pageBreak) pb.classList.add('on');
    nav.append(pb);
  }
  nav.append(button('remove', 'x', 'Remove', opts.block === true && index === 0));
  return nav;
}

function adder(listPath: Path, label: string, make: string): HTMLButtonElement {
  const b = h('button', 'adder', icon('plus'), ` ${label}`);
  b.type = 'button';
  b.dataset.list = pstr(listPath);
  b.dataset.make = make;
  return b;
}

function wordBadge(b: Block, limit: number | null): HTMLElement | null {
  if (!countsShown(b)) return null;
  const n = blockWords(b);
  const badge = h('span', 'wc', limit ? `${n} / ${limit}` : `${n} ${n === 1 ? 'word' : 'words'}`);
  if (limit && n > limit) badge.classList.add('over');
  badge.title = limit ? `${n} words against a limit of ${limit}` : `${n} words`;
  return badge;
}

/** A paragraph in a wrapper, so its controls are siblings of the editable run. */
function para(listPath: Path, index: number, text: string, placeholder = 'Paragraph'): HTMLElement {
  const wrap = h('div', 'pw blk', ed('p', null, [...listPath, index], text, 'item', placeholder));
  wrap.append(ctl(listPath, index, { inline: true }));
  return wrap;
}
function bullet(listPath: Path, index: number, text: string, placeholder = 'Bullet'): HTMLElement {
  const li = h('li', 'blk', ed('span', 't', [...listPath, index], text, 'item', placeholder));
  li.append(ctl(listPath, index, { inline: true }));
  return li;
}
function lineList(cls: string, listPath: Path, lines: string[], placeholder: string): HTMLElement {
  const box = h('div', cls);
  lines.forEach((line, k) => box.append(ed('p', 'contact-line', [...listPath, k], line, 'item', placeholder)));
  return box;
}

export function renderDocument(doc: QDocument): DocumentFragment {
  const frag = document.createDocumentFragment();
  let critIndex = 0;
  doc.blocks.forEach((b, i) => {
    const path: Path = ['blocks', i];
    const el = renderBlock(b, path, doc, () => ++critIndex);
    if (b.pageBreak) el.classList.add('pb');
    frag.append(el);
  });
  return frag;
}

/** One choice, both mastheads: a document has only one of them. */
const contactClass = (doc: QDocument): string => (doc.layout.contact === 'under' ? ' contact-under' : '');

function renderBlock(b: Block, path: Path, doc: QDocument, nextCriterion: () => number): HTMLElement {
  const blocks: Path = ['blocks'];
  const i = path[1] as number;
  const blockCtl = (): HTMLElement => ctl(blocks, i, { block: true, pageBreak: b.pageBreak === true, count: doc.blocks.length });

  switch (b.type) {
    case 'masthead': {
      const left = h('div', null,
        ed('h1', 'name', [...path, 'name'], b.name, 'single', 'Your name'),
        ed('p', 'creds', [...path, 'creds'], b.creds, 'single', 'Post-nominals'),
        ed('p', 'tagline', [...path, 'tagline'], b.tagline, 'lines', 'One line that says what you are and what you bring'));
      const el = h('header', `mast blk${contactClass(doc)}`, left, lineList('contact', [...path, 'contact'], b.contact, 'Contact line'));
      el.append(blockCtl());
      return el;
    }
    case 'docmast': {
      const left = h('div', null,
        ed('p', 'doc-kicker', [...path, 'kicker'], b.kicker, 'single', 'Document type, for example Response to selection criteria. Leave empty for none.'),
        ed('h1', 'doc-title', [...path, 'title'], b.title, 'single', 'Title'),
        ed('p', 'doc-sub', [...path, 'sub'], b.sub, 'lines', 'Position number and organisation'));
      const el = h('header', `doc-mast blk${contactClass(doc)}`, left, lineList('contact', [...path, 'contact'], b.contact, 'Contact line'));
      el.append(blockCtl());
      return el;
    }
    case 'section': {
      const sec = h('section', 'blk' + (b.kind === 'columns' ? ' keep' : ''));
      sec.append(ed('h2', null, [...path, 'heading'], b.heading, 'single', 'Section heading'));
      const body = h('div', 'body');
      switch (b.kind) {
        case 'prose': {
          const wrap = h('div', 'prose');
          (b.paragraphs ?? []).forEach((p, k) => wrap.append(para([...path, 'paragraphs'], k, p)));
          body.append(wrap, adder([...path, 'paragraphs'], 'Paragraph', 'paragraph'));
          break;
        }
        case 'achievements': {
          const ul = h('ul', 'achievements');
          (b.items ?? []).forEach((it, k) => {
            const li = h('li', 'blk',
              ed('strong', null, [...path, 'items', k, 'lead'], it.lead, 'single', 'Lead phrase.'),
              ' ',
              ed('span', null, [...path, 'items', k, 'text'], it.text, 'item', 'What you did and what it produced.'));
            li.append(ctl([...path, 'items'], k, { inline: true }));
            ul.append(li);
          });
          body.append(ul, adder([...path, 'items'], 'Achievement', 'achievement'));
          break;
        }
        case 'entries': {
          (b.entries ?? []).forEach((en, k) => {
            const ep: Path = [...path, 'entries', k];
            const when = h('div', 'when',
              ed('div', 'dates', [...ep, 'dates'], en.dates, 'single', 'Dates'),
              ed('div', 'org', [...ep, 'org'], en.org, 'lines', 'Organisation'));
            const head = h('div', 'head',
              ed('h3', null, [...ep, 'title'], en.title, 'single', 'Role title'),
              ed('p', 'context', [...ep, 'context'], en.context, 'single', 'One line of context, if it helps'));
            const ul = h('ul');
            en.bullets.forEach((t, j) => ul.append(bullet([...ep, 'bullets'], j, t)));
            const what = h('div', 'what', head, ul, adder([...ep, 'bullets'], 'Bullet', 'bullet'));
            const art = h('article', 'entry blk', when, what);
            art.append(ctl([...path, 'entries'], k, { count: (b.entries ?? []).length }));
            body.append(art);
          });
          body.append(adder([...path, 'entries'], 'Entry', 'entry'));
          break;
        }
        case 'columns': {
          const cols = h('div', 'cols' + ((b.columns ?? []).length === 3 ? ' three' : '') + (doc.layout.columnDetail === 'beside' ? ' detail-beside' : ''));
          (b.columns ?? []).forEach((col, k) => {
            const cp: Path = [...path, 'columns', k];
            const ul = h('ul');
            col.items.forEach((it, j) => {
              const li = h('li', 'blk',
                ed('span', 'coltext', [...cp, 'items', j, 'text'], it.text, 'item', 'Item'),
                ed('span', 'sub', [...cp, 'items', j, 'sub'], it.sub, 'single', 'Detail line, if any'));
              li.append(ctl([...cp, 'items'], j, { inline: true }));
              ul.append(li);
            });
            const cdiv = h('div', 'col blk', ed('h4', null, [...cp, 'heading'], col.heading, 'single', 'Column heading'), ul, adder([...cp, 'items'], 'Item', 'colitem'));
            cdiv.append(ctl([...path, 'columns'], k, { count: (b.columns ?? []).length }));
            cols.append(cdiv);
          });
          body.append(cols);
          if ((b.columns ?? []).length < 3) body.append(adder([...path, 'columns'], 'Column', 'column'));
          break;
        }
        case 'skills': {
          const ul = h('ul', 'skills');
          (b.skills ?? []).forEach((s, k) => ul.append(bullet([...path, 'skills'], k, s, 'Skill')));
          body.append(ul, adder([...path, 'skills'], 'Skill', 'skill'));
          break;
        }
      }
      sec.append(body, blockCtl());
      const badge = wordBadge(b, null);
      if (badge) sec.append(badge);
      return sec;
    }
    case 'opening': {
      const wrap = h('div', 'opening blk');
      b.paragraphs.forEach((p, k) => wrap.append(para([...path, 'paragraphs'], k, p)));
      wrap.append(adder([...path, 'paragraphs'], 'Paragraph', 'paragraph'), blockCtl());
      const badge = wordBadge(b, null);
      if (badge) wrap.append(badge);
      return wrap;
    }
    case 'criterion': {
      const n = nextCriterion();
      const head = h('div', 'head', h('p', 'label', `Criterion ${n}`), ed('h2', null, [...path, 'heading'], b.heading, 'single', 'Criterion wording, as the panel wrote it'));
      const body = h('div', 'body', head);
      b.paragraphs.forEach((p, k) => body.append(para([...path, 'paragraphs'], k, p)));
      body.append(adder([...path, 'paragraphs'], 'Paragraph', 'paragraph'));
      const sec = h('section', 'crit blk', h('div', 'num', String(n)), body);
      sec.dataset.numbering = doc.numbering;
      sec.append(blockCtl());
      const badge = wordBadge(b, doc.blockWordLimit);
      if (badge) sec.append(badge);
      return sec;
    }
    case 'closing': {
      const wrap = h('div', 'closing blk');
      b.paragraphs.forEach((p, k) => wrap.append(para([...path, 'paragraphs'], k, p)));
      const refs = h('div', 'cols referees');
      b.referees.forEach((r, k) => {
        const rp: Path = [...path, 'referees', k];
        const div = h('div', 'referee blk',
          ed('h4', null, [...rp, 'label'], r.label, 'single', 'Referee'),
          ed('strong', null, [...rp, 'name'], r.name, 'single', 'Name'),
          ed('span', 'sub', [...rp, 'sub'], r.sub, 'lines', 'Title, organisation, phone and email'));
        div.append(ctl([...path, 'referees'], k, { count: b.referees.length }));
        refs.append(div);
      });
      wrap.append(adder([...path, 'paragraphs'], 'Paragraph', 'paragraph'), refs, adder([...path, 'referees'], 'Referee', 'referee'), blockCtl());
      return wrap;
    }
    case 'letterhead': {
      const el = h('div', `letterhead blk${doc.layout.letterDate === 'right' ? ' date-right' : ''}`,
        ed('p', 'date', [...path, 'date'], b.date, 'single', 'Date'),
        lineList('recipient', [...path, 'recipient'], b.recipient, 'Recipient line'),
        ed('p', 'subject', [...path, 'subject'], b.subject, 'single', 'Subject line'));
      el.append(blockCtl());
      return el;
    }
    case 'signoff': {
      const el = h('div', 'signoff blk',
        ed('p', 'sig-close', [...path, 'closing'], b.closing, 'single', 'Yours sincerely'),
        ed('p', 'sig-name', [...path, 'name'], b.name, 'single', 'Your name'));
      el.append(blockCtl());
      return el;
    }
  }
}
