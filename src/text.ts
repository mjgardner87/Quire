/**
 * Model text <-> editable DOM. Bold, italic and flags travel as plain markers in the model
 * (see tokenise in model.ts) and as <strong>, <em> and <span class="flag"> in the DOM.
 */
import { tokenise } from './model';

const CHROME = ['ctl', 'adder', 'wc', 'guide'];

/** Replace an element's content with the rendered form of model text. */
export function fill(el: HTMLElement, text: string): void {
  el.textContent = '';
  for (const t of tokenise(text ?? '')) {
    if (t.kind === 'text') {
      t.text.split('\n').forEach((line, i) => {
        if (i) el.appendChild(document.createElement('br'));
        if (line) el.appendChild(document.createTextNode(line));
      });
      continue;
    }
    const tag = t.kind === 'bold' ? 'strong' : t.kind === 'italic' ? 'em' : 'span';
    const wrap = document.createElement(tag);
    if (t.kind === 'flag') wrap.className = 'flag';
    wrap.textContent = t.text;
    el.appendChild(wrap);
  }
}

/** Serialise an editable element (or a fragment) back to model text. Editor chrome never counts. */
export function readText(node: Node): string {
  let out = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) { out += n.nodeValue ?? ''; return; }
    if (!(n instanceof HTMLElement)) return;
    if (CHROME.some((c) => n.classList.contains(c))) return;
    const tag = n.tagName;
    if (tag === 'BR') { out += '\n'; return; }
    const inner = readText(n);
    if (n.classList.contains('flag')) { if (inner.trim()) out += `[[${inner}]]`; return; }
    if (tag === 'STRONG' || tag === 'B') { out += inner.trim() ? `**${inner}**` : inner; return; }
    if (tag === 'EM' || tag === 'I') { out += inner.trim() ? `_${inner}_` : inner; return; }
    if (tag === 'DIV' || tag === 'P') { out += (out && !out.endsWith('\n') ? '\n' : '') + inner; return; }
    out += inner;
  });
  return out.replace(/ /g, ' ');
}

/** True when nothing printable sits before the caret inside el. */
export function caretAtStart(el: HTMLElement): boolean {
  const sel = getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const live = sel.getRangeAt(0);
  const r = live.cloneRange();
  r.selectNodeContents(el);
  r.setEnd(live.startContainer, live.startOffset);
  return readText(r.cloneContents()).length === 0;
}

/** Put the caret at the start or end of an editable element. */
export function placeCaret(el: HTMLElement, atEnd = true): void {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(!atEnd);
  const sel = getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** The flag span containing the selection's anchor, if any. */
export function flagAtSelection(): HTMLElement | null {
  const sel = getSelection();
  const node = sel?.anchorNode;
  const el = node instanceof HTMLElement ? node : node?.parentElement;
  return el?.closest<HTMLElement>('.flag') ?? null;
}

/** Replace a flag span with its text, keeping the caret inside the text. */
export function unflag(span: HTMLElement): void {
  const text = document.createTextNode(span.textContent?.replace(/^CONFIRM:\s*/, '') ?? '');
  span.replaceWith(text);
  const sel = getSelection();
  const range = document.createRange();
  range.selectNodeContents(text);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Wrap the current selection (inside an editable) in a flag span. A collapsed caret flags the word around it. */
export function flagSelection(): boolean {
  const sel = getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  if (sel.isCollapsed) {
    sel.modify('move', 'backward', 'word');
    sel.modify('extend', 'forward', 'word');
    if (sel.isCollapsed || !sel.toString().trim()) return false;
  }
  const range = sel.getRangeAt(0);
  const host = (range.commonAncestorContainer instanceof HTMLElement ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest('[contenteditable]');
  if (!host) return false;
  const text = range.toString();
  range.deleteContents();
  const span = document.createElement('span');
  span.className = 'flag';
  span.textContent = text.startsWith('CONFIRM') ? text : `CONFIRM: ${text}`;
  range.insertNode(span);
  sel.removeAllRanges();
  const after = document.createRange();
  after.setStartAfter(span);
  after.collapse(true);
  sel.addRange(after);
  return true;
}
