import { describe, expect, test } from 'vitest';
import {
  tokenise, countWords, blockWords, documentWords,
  migrate, validateWorkspace, defaultDesign, defaultRunning, SCHEMES,
  newDocument, newBlock, TEMPLATE_KINDS, BLOCK_TYPES, blockForPicker, ADDABLE,
  pageRuleCSS, cssString,
  toPlainText, toMarkdown,
  get, set, pparse, pstr,
  checkBeforeExport, exportWarning,
  type QDocument, type Block,
} from '../../src/model';

describe('inline text', () => {
  test('tokenise splits flags, bold and italic and leaves plain text alone', () => {
    expect(tokenise('Plain **bold** and _italic_ with [[CONFIRM: check]] end')).toEqual([
      { kind: 'text', text: 'Plain ' },
      { kind: 'bold', text: 'bold' },
      { kind: 'text', text: ' and ' },
      { kind: 'italic', text: 'italic' },
      { kind: 'text', text: ' with ' },
      { kind: 'flag', text: 'CONFIRM: check' },
      { kind: 'text', text: ' end' },
    ]);
  });

  test('underscores inside words are not italic', () => {
    expect(tokenise('snake_case_name stays')).toEqual([{ kind: 'text', text: 'snake_case_name stays' }]);
  });

  test('newlines stay inside text tokens', () => {
    expect(tokenise('line one\nline two')).toEqual([{ kind: 'text', text: 'line one\nline two' }]);
  });

  test('countWords ignores markers and excludes flag text', () => {
    expect(countWords('one **two** _three_')).toBe(3);
    expect(countWords('one two [[CONFIRM: three four five]]')).toBe(2);
    expect(countWords('')).toBe(0);
    expect(countWords('  spaced   out  ')).toBe(2);
    expect(countWords('$15 million · 2026')).toBe(3);
  });
});

describe('word counts', () => {
  test('a criterion counts its body, not its heading', () => {
    expect(blockWords({ type: 'criterion', heading: 'Five words in this heading', paragraphs: ['one two', 'three'] })).toBe(3);
  });

  test('every block type counts what prints', () => {
    expect(blockWords({ type: 'section', kind: 'entries', heading: 'x', entries: [{ dates: 'a', org: 'b', title: 'c d', context: 'e', bullets: ['f g', 'h'] }] })).toBe(8);
    expect(blockWords({ type: 'section', kind: 'achievements', heading: 'x', items: [{ lead: 'a b.', text: 'c' }] })).toBe(3);
    expect(blockWords({ type: 'section', kind: 'columns', heading: 'x', columns: [{ heading: 'h', items: [{ text: 'a b', sub: 'c' }] }] })).toBe(4);
    expect(blockWords({ type: 'section', kind: 'skills', heading: 'x', skills: ['a', 'b c'] })).toBe(3);
    expect(blockWords({ type: 'letterhead', date: '1 January 2026', recipient: ['A B'], subject: 'C' })).toBe(6);
    expect(blockWords({ type: 'signoff', closing: 'Yours sincerely', name: 'A B' })).toBe(4);
    expect(blockWords({ type: 'masthead', name: 'A B', creds: 'c', tagline: 'd e', contact: ['f'] })).toBe(0);
  });

  test('documentWords sums block words', () => {
    const d: QDocument = { ...newDocument('blank', 'x'), blocks: [
      { type: 'docmast', kicker: 'k', title: 't', sub: 's', contact: [] },
      { type: 'opening', paragraphs: ['one two'] },
      { type: 'criterion', heading: 'h', paragraphs: ['three'] },
    ] };
    expect(documentWords(d)).toBe(3);
  });
});

describe('migration', () => {
  const mast: Block = { type: 'masthead', name: 'N', creds: '', tagline: '', contact: [] };
  const docmast: Block = { type: 'docmast', kicker: '', title: '', sub: '', contact: [] };

  test('accepts the first-generation two-document shape', () => {
    const ws = migrate({ cv: { id: 'cv', title: 'CV', blocks: [mast] }, criteria: { id: 'criteria', title: 'Criteria', blocks: [docmast, { type: 'criterion', heading: 'h', paragraphs: [] }] } });
    expect(ws.format).toBe('quire/1');
    expect(ws.documents.map((d) => d.kind)).toEqual(['cv', 'criteria']);
    expect(ws.design).toEqual(defaultDesign());
    expect(ws.documents[0]!.running.footer.centre).toBe('Page {page} of {pages}');
  });

  test('accepts a single first-generation document', () => {
    const ws = migrate({ id: 'cv', title: 'CV', blocks: [mast] });
    expect(ws.documents).toHaveLength(1);
    expect(ws.documents[0]!.id).toBe('cv');
  });

  test('passes a current workspace through and fills missing fields', () => {
    const ws = migrate({ format: 'quire/1', documents: [{ id: 'a', title: 'A', blocks: [] }] });
    expect(ws.design.accent).toBe(defaultDesign().accent);
    expect(ws.documents[0]!.kind).toBe('blank');
    expect(ws.documents[0]!.numbering).toBe('both');
    expect(newDocument('criteria').numbering).toBe('number');
  });

  test('rejects shapes that are not a workspace', () => {
    expect(() => validateWorkspace({})).toThrow(/documents/);
    expect(() => validateWorkspace({ format: 'quire/1', documents: [{ id: 'a' }] })).toThrow(/blocks/);
    expect(() => validateWorkspace({ format: 'quire/1', documents: [{ id: 'a', blocks: [{ type: 'nope' }] }] })).toThrow(/block type/);
    expect(() => validateWorkspace({ format: 'quire/1', documents: [{ id: 'a', blocks: [] }, { id: 'a', blocks: [] }] })).toThrow(/duplicate/);
    expect(() => migrate('text')).toThrow(/Not a Quire file/);
  });
});

describe('templates', () => {
  test('every document template validates and starts with a masthead', () => {
    for (const kind of TEMPLATE_KINDS) {
      const d = newDocument(kind);
      expect(d.kind).toBe(kind);
      expect(['masthead', 'docmast']).toContain(d.blocks[0]!.type);
      validateWorkspace({ format: 'quire/1', design: defaultDesign(), documents: [d] });
    }
  });

  test('every block type has a template', () => {
    for (const type of BLOCK_TYPES) {
      const b = newBlock(type);
      expect(b.type).toBe(type);
      validateWorkspace({ format: 'quire/1', design: defaultDesign(), documents: [{ ...newDocument('blank', 'x'), blocks: [newBlock('docmast'), b] }] });
    }
  });

  test('every picker value maps to a block', () => {
    for (const a of ADDABLE) {
      const b = blockForPicker(a.value);
      expect(BLOCK_TYPES).toContain(b.type);
    }
    expect(blockForPicker('paragraphs').type).toBe('opening');
    expect(blockForPicker('skills')).toMatchObject({ type: 'section', kind: 'skills' });
  });

  test('schemes carry an accent each and eucalyptus is the default', () => {
    expect(SCHEMES.length).toBeGreaterThanOrEqual(6);
    for (const s of SCHEMES) expect(s.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(defaultDesign().scheme).toBe('eucalyptus');
    expect(defaultDesign().accent).toBe(SCHEMES.find((s) => s.id === 'eucalyptus')!.accent);
  });
});

describe('page rule', () => {
  test('cssString escapes quotes and backslashes', () => {
    expect(cssString('say "hi" \\ there')).toBe('"say \\"hi\\" \\\\ there"');
  });

  test('builds margin boxes from tokens and suppresses the first page when asked', () => {
    const design = { ...defaultDesign(), marginTop: 15, marginSide: 18 };
    const doc: QDocument = { ...newDocument('cv', 'x'), title: 'Curriculum vitae',
      blocks: [{ type: 'masthead', name: 'Jordan Example', creds: '', tagline: '', contact: [] }],
      running: { header: { left: '', centre: '', right: '{title}' }, footer: { left: '{name}', centre: '', right: 'Page {page} of {pages}' }, firstPage: false } };
    const css = pageRuleCSS(design, doc, { date: '2 September 2026' });
    expect(css).toMatch(/@page\s*\{[^}]*margin:\s*15mm 18mm 15mm 18mm/);
    expect(css).toMatch(/@top-right\s*\{\s*content:\s*"Curriculum vitae"/);
    expect(css).toMatch(/@bottom-left\s*\{\s*content:\s*"Jordan Example"/);
    expect(css).toMatch(/@bottom-right\s*\{\s*content:\s*"Page " counter\(page\) " of " counter\(pages\)/);
    expect(css).toMatch(/@page :first\s*\{[\s\S]*@top-right\s*\{\s*content:\s*""/);
    expect(css).toMatch(/@page :first\s*\{[\s\S]*@bottom-right\s*\{\s*content:\s*""/);
    expect(css).toMatch(/@top-left\s*\{\s*content:\s*""/);
  });

  // Chromium prints its own date, page title, file URL and page number in any page margin the
  // document leaves undeclared, per edge. A declared box with empty content takes the edge back.
  test('declares all six margin boxes so the browser prints no URL or date of its own', () => {
    const bare: QDocument = newDocument('blank', 'x');
    for (const css of [pageRuleCSS(defaultDesign(), bare, { date: '2 September 2026' }),
                       pageRuleCSS(defaultDesign(), undefined, { date: '2 September 2026' })]) {
      for (const box of ['@top-left', '@top-center', '@top-right', '@bottom-left', '@bottom-center', '@bottom-right']) {
        expect(css).toContain(box);
      }
      expect(css).not.toMatch(/content:\s*none/);
    }
  });

  // A multi-page application is read on paper and gets separated. Every sheet after the first
  // names its owner, its document and its place in the set.
  test('a new document carries a running footer with the name, the title and the page number', () => {
    const r = defaultRunning();
    expect(r.header.right).toBe('{title}');
    expect(r.footer.left).toBe('{name}');
    expect(r.footer.centre).toBe('Page {page} of {pages}');
    expect(r.firstPage).toBe(false);
    for (const kind of TEMPLATE_KINDS) expect(newDocument(kind).running).toEqual(r);
  });

  // Every workspace saved before Quire had running defaults carries six empty slots, which is
  // the old default and not a choice anyone could have made. Fill them; leave a set alone the
  // moment one slot has text in it.
  test('migration fills running slots that are entirely empty and leaves a set with any text alone', () => {
    const empty = { left: '', centre: '', right: '' };
    const bare = migrate({ format: 'quire/1', documents: [
      { id: 'cv', kind: 'cv', title: 'Curriculum vitae', blocks: [{ type: 'masthead', name: 'A', creds: '', tagline: '', contact: [] }],
        running: { header: { ...empty }, footer: { ...empty }, firstPage: false } },
      { id: 'two', kind: 'blank', title: 'Two', blocks: [],
        running: { header: { ...empty }, footer: { left: 'Commercial in confidence', centre: '', right: '' }, firstPage: false } },
    ] });
    expect(bare.documents[0]!.running).toEqual(defaultRunning());
    expect(bare.documents[1]!.running.footer.left).toBe('Commercial in confidence');
    expect(bare.documents[1]!.running.header.right).toBe('');
  });

  test('expands {date} and emits no :first rule when the first page shows the running text', () => {
    const doc: QDocument = { ...newDocument('blank', 'x'), running: { header: { left: '{date}', centre: '', right: '' }, footer: { left: '', centre: '', right: '' }, firstPage: true } };
    const css = pageRuleCSS(defaultDesign(), doc, { date: '2 September 2026' });
    expect(css).toMatch(/@top-left\s*\{\s*content:\s*"2 September 2026"/);
    expect(css).not.toMatch(/:first/);
  });
});

describe('exports', () => {
  const d: QDocument = { ...newDocument('criteria', 'c'), title: 'Criteria', numbering: 'both', blocks: [
    { type: 'docmast', kicker: 'Response', title: 'Role', sub: 'P1', contact: ['Name'] },
    { type: 'opening', paragraphs: ['Hello **there**.'] },
    { type: 'criterion', heading: 'Criterion wording.', paragraphs: ['Body _one_.', 'Body two [[CONFIRM: x]].'] },
  ] };

  test('plain text has no markers and keeps flags visible', () => {
    const text = toPlainText(d);
    expect(text).toMatch(/Criterion 1\. Criterion wording\./);
    expect(text).toMatch(/Hello there\./);
    expect(text).toMatch(/Body one\./);
    expect(text).toMatch(/Body two \[CONFIRM: x\]\./);
    expect(text).not.toMatch(/\*\*|\[\[/);
  });

  test('markdown keeps emphasis', () => {
    const md = toMarkdown(d);
    expect(md).toMatch(/^## 1\. Criterion wording\./m);
    expect(md).toMatch(/Hello \*\*there\*\*\./);
  });
});

describe('paths', () => {
  test('read and write nested values', () => {
    const o = { blocks: [{ items: [{ text: 'a' }] }] };
    const p = pparse('blocks.0.items.0.text');
    expect(p).toEqual(['blocks', 0, 'items', 0, 'text']);
    expect(get(o, p)).toBe('a');
    set(o, p, 'b');
    expect(o.blocks[0]!.items[0]!.text).toBe('b');
    expect(pstr(p)).toBe('blocks.0.items.0.text');
  });
});

describe('before export', () => {
  const doc = (): QDocument => {
    const d = newDocument('criteria', 'c');
    d.blockWordLimit = 50;
    d.wordLimit = null;
    return d;
  };
  const criterion = (heading: string, text: string): Block => ({ type: 'criterion', heading, paragraphs: [text] });

  test('a document with nothing outstanding warns about nothing', () => {
    const d = doc();
    d.blocks = [criterion('First criterion.', 'Ten words here to stay well under the limit set.')];
    expect(checkBeforeExport(d)).toEqual({ flags: 0, overBlocks: [], overDocument: null });
    expect(exportWarning(checkBeforeExport(d))).toBeNull();
  });

  test('an unresolved flag is counted and named', () => {
    const d = doc();
    d.blocks = [criterion('First criterion.', 'I led the [[CONFIRM: how many]] team.')];
    expect(checkBeforeExport(d).flags).toBe(1);
    expect(exportWarning(checkBeforeExport(d))).toBe('1 flag is still unresolved.');
  });

  test('a criterion over its limit is named with its count', () => {
    const d = doc();
    d.blockWordLimit = 3;
    d.blocks = [criterion('Strategic planning.', 'One two three four five')];
    expect(checkBeforeExport(d).overBlocks).toEqual([{ heading: 'Strategic planning.', words: 5, limit: 3 }]);
    expect(exportWarning(checkBeforeExport(d))).toBe('Strategic planning. is 5 words against a limit of 3.');
  });

  test('the whole document over its limit is reported with both counts', () => {
    const d = doc();
    d.blockWordLimit = null;
    d.wordLimit = 4;
    d.blocks = [criterion('First criterion.', 'One two three four five six')];
    expect(checkBeforeExport(d).overDocument).toEqual({ words: 6, limit: 4 });
    expect(exportWarning(checkBeforeExport(d))).toBe('The document is 6 words against a limit of 4.');
  });
});
