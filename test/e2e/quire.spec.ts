import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { QuireApi } from '../../src/editor';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, '..', '..', 'dist', 'index.html');
const ART = join(here, '..', '.artefacts');
mkdirSync(ART, { recursive: true });
const url = (suffix = ''): string => 'file://' + DIST + suffix;

declare global {
  interface Window { Quire: QuireApi }
}

const pdfPages = (buffer: Buffer, name: string): number => {
  const file = join(ART, name + '.pdf');
  writeFileSync(file, buffer);
  return Number(/^Pages:\s+(\d+)/m.exec(execFileSync('pdfinfo', [file], { encoding: 'utf8' }))![1]);
};
const pdfPageText = (name: string, page: number): string =>
  execFileSync('pdftotext', ['-f', String(page), '-l', String(page), join(ART, name + '.pdf'), '-'], { encoding: 'utf8' });
const printPdf = async (page: Page, name: string): Promise<number> => {
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  const buf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  return pdfPages(buf, name);
};
/** Point at the block's own heading (not a nested item) so the block's controls appear. */
const hoverBlock = async (page: Page, selector: string): Promise<void> => {
  await page.locator(selector).locator(':scope > h2, :scope > .num, :scope > .head, :scope > div:first-child').first().hover();
};
const removeBlock = async (page: Page, selector: string): Promise<void> => {
  await hoverBlock(page, selector);
  page.once('dialog', (d) => d.accept());
  await page.locator(selector).locator(':scope > .ctl [data-act="remove"]').click();
};
const fileMenu = async (page: Page, item: string): Promise<void> => {
  await page.click('#file');
  await page.click(item);
};

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

test.describe('workspace and seed', () => {
  test('the seed renders three documents and the CV', async ({ page }) => {
    await page.goto(url('#cv'));
    await expect(page.locator('#tabs .tab')).toHaveCount(3);
    await expect(page.locator('#tabs .tab[data-doc="cv"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.name')).toHaveText('Jordan Example');
    expect(await page.locator('section').count()).toBeGreaterThanOrEqual(4);
    expect(await page.locator('.flag').count()).toBeGreaterThanOrEqual(1);
  });

  test('the section picker offers every type', async ({ page }) => {
    await page.goto(url('#cv'));
    const values = await page.locator('#add-section option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    for (const t of ['prose', 'achievements', 'entries', 'columns', 'skills', 'paragraphs', 'criterion', 'closing', 'letterhead', 'signoff']) expect(values).toContain(t);
  });

  test('the print title names the document', async ({ page }) => {
    await page.goto(url('#cv'));
    await expect(page).toHaveTitle(/Curriculum vitae/);
  });
});

test.describe('editing', () => {
  test('an edit survives reload', async ({ page }) => {
    await page.goto(url('#cv'));
    await page.locator('.tagline').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' EDITED');
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.locator('.tagline')).toContainText('EDITED');
  });

  test('Enter adds a bullet and Backspace on an empty one removes it', async ({ page }) => {
    await page.goto(url('#cv'));
    const bullets = page.locator('.entry').first().locator('li');
    const before = await bullets.count();
    await bullets.first().locator('[contenteditable]').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(bullets).toHaveCount(before + 1);
    expect(await page.evaluate(() => document.activeElement?.closest('li') !== null && document.activeElement?.textContent === '')).toBe(true);
    await page.keyboard.press('Backspace');
    await expect(bullets).toHaveCount(before);
  });

  test('Ctrl+B and Ctrl+I store and remove markers', async ({ page }) => {
    await page.goto(url('#cv'));
    const p = page.locator('.prose p').first();
    await p.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+b');
    expect(await page.evaluate(() => window.Quire.readText(document.querySelector('.prose p')!))).toMatch(/\*\*.+\*\*/);
    await page.keyboard.press('Control+b');
    expect(await page.evaluate(() => window.Quire.readText(document.querySelector('.prose p')!))).not.toMatch(/\*\*/);
    await page.keyboard.press('Control+i');
    expect((await page.evaluate(() => window.Quire.readText(document.querySelector('.prose p')!))).trim()).toMatch(/^_.+_$/);
  });

  test('Ctrl+Shift+F flags the selection and the status steps to it', async ({ page }) => {
    await page.goto(url('#cv'));
    const flags0 = await page.locator('.flag').count();
    const run = page.locator('.entry').first().locator('li [contenteditable]').first();
    await run.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+Shift+f');
    await expect(page.locator('.flag')).toHaveCount(flags0 + 1);
    expect((await page.evaluate(() => window.Quire.readText(document.querySelector('.entry li [contenteditable]')!))).trim()).toMatch(/^\[\[.+\]\]$/);
    await expect(page.locator('#flags')).toContainText(/\d+ flag/);
    await page.locator('.name').click();
    await page.click('#flags');
    expect(await page.evaluate(() => !!document.activeElement?.querySelector('.flag'))).toBe(true);
  });
});

test.describe('commands', () => {
  test('selecting text shows the toolbar and its Flag button flags the words', async ({ page }) => {
    await page.goto(url('#cv'));
    const flags0 = await page.locator('.flag').count();
    await page.locator('.prose p').first().click();
    await page.keyboard.press('Control+a');
    await expect(page.locator('#bubble')).toBeVisible();
    await page.click('#bubble [data-command="flag"]');
    await expect(page.locator('.flag')).toHaveCount(flags0 + 1);
    await expect(page.locator('#bubble')).toBeHidden();
  });

  test('right-click opens a menu with structural actions', async ({ page }) => {
    await page.goto(url('#cv'));
    const bullets = page.locator('.entry').first().locator('li');
    const before = await bullets.count();
    await bullets.first().locator('[contenteditable]').click({ button: 'right' });
    await expect(page.locator('#context')).toBeVisible();
    await page.click('#context [data-command="add-item"]');
    await expect(bullets).toHaveCount(before + 1);
    await expect(page.locator('#context')).toBeHidden();
  });

  test('Ctrl+K opens the palette and runs a filtered command', async ({ page }) => {
    await page.goto(url('#cv'));
    const n = await page.locator('section').count();
    await page.keyboard.press('Control+k');
    await expect(page.locator('#palette')).toBeVisible();
    await page.fill('#palette-input', 'skills');
    await expect(page.locator('#palette-list li').first()).toContainText('Skills list');
    await page.keyboard.press('Enter');
    await expect(page.locator('section')).toHaveCount(n + 1);
    await expect(page.locator('#palette')).toBeHidden();
  });
});

test.describe('sections', () => {
  test('remove, add every type, move and page-break', async ({ page }) => {
    await page.goto(url('#cv'));
    const n0 = await page.locator('section').count();
    await removeBlock(page, 'section >> nth=1');
    await expect(page.locator('section')).toHaveCount(n0 - 1);
    for (const t of ['prose', 'achievements', 'entries', 'columns', 'skills']) {
      const n = await page.locator('section').count();
      await page.selectOption('#add-section', t);
      await expect(page.locator('section')).toHaveCount(n + 1);
    }
    expect(await page.locator('.skills li').count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('section').last().locator('h2')).toHaveAttribute('contenteditable', /.+/);

    const lastHeading = await page.locator('section').last().locator('h2').textContent();
    await hoverBlock(page, 'section >> nth=-1');
    await page.locator('section').last().locator(':scope > .ctl [data-act="up"]').click();
    await expect(page.locator('section').nth(-2).locator('h2')).toHaveText(lastHeading ?? '');

    const pagesBefore = await printPdf(page, 'cv-before-break');
    await hoverBlock(page, 'section >> nth=1');
    await page.locator('section').nth(1).locator(':scope > .ctl [data-act="pagebreak"]').click();
    await expect(page.locator('section').nth(1)).toHaveClass(/\bpb\b/);
    const pagesAfter = await printPdf(page, 'cv-after-break');
    expect(pagesAfter).toBe(pagesBefore + 1);
  });

  test('undo and redo walk structural changes', async ({ page }) => {
    await page.goto(url('#cv'));
    await hoverBlock(page, 'section >> nth=1');
    await page.locator('section').nth(1).locator(':scope > .ctl [data-act="pagebreak"]').click();
    await expect(page.locator('section').nth(1)).toHaveClass(/\bpb\b/);
    await page.click('#undo');
    await expect(page.locator('section').nth(1)).not.toHaveClass(/\bpb\b/);
    await page.click('#redo');
    await expect(page.locator('section').nth(1)).toHaveClass(/\bpb\b/);
  });
});

test.describe('criteria document', () => {
  test('word counts, limits and numbering', async ({ page }) => {
    await page.goto(url('#criteria'));
    await expect(page.locator('.crit .wc')).toHaveCount(await page.locator('.crit').count());
    await expect(page.locator('#words')).toContainText(/\d[\d,]* words/);
    await page.click('#doc-menu');
    await page.fill('#doc-block-limit', '5');
    await page.dispatchEvent('#doc-block-limit', 'change');
    expect(await page.locator('.crit .wc.over').count()).toBeGreaterThanOrEqual(1);
    await page.fill('#doc-word-limit', '10');
    await page.dispatchEvent('#doc-word-limit', 'change');
    await expect(page.locator('#words')).toHaveClass(/\bover\b/);

    const nums = (await page.locator('.crit .num').allTextContents()).join('');
    expect(nums.startsWith('123')).toBe(true);
    await page.selectOption('#doc-numbering', 'none');
    expect(await page.locator('.crit .num').first().evaluate((el) => getComputedStyle(el).display)).toBe('none');
    await page.selectOption('#doc-numbering', 'number');
    await page.keyboard.press('Escape');
    const count = await page.locator('.crit').count();
    await removeBlock(page, '.crit >> nth=-1');
    expect((await page.locator('.crit .num').allTextContents()).join('')).toBe('123456789'.slice(0, count - 1));
  });

  test('running header and footer print with page numbers', async ({ page }) => {
    await page.goto(url('#criteria'));
    await page.click('#running');
    await page.fill('#run-footer-centre', 'Page {page} of {pages}');
    await page.dispatchEvent('#run-footer-centre', 'change');
    await page.fill('#run-header-right', '{name} · {title}');
    await page.dispatchEvent('#run-header-right', 'change');
    await page.uncheck('#run-first');
    await page.keyboard.press('Escape');
    const pages = await printPdf(page, 'criteria-running');
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(pdfPageText('criteria-running', 2)).toMatch(new RegExp(`Page 2 of ${pages}`));
    expect(pdfPageText('criteria-running', 2)).toMatch(/Jordan Example/);
    expect(pdfPageText('criteria-running', 1)).not.toMatch(/Page 1 of/);
    await page.click('#running');
    await page.check('#run-first');
    await page.keyboard.press('Escape');
    await printPdf(page, 'criteria-running-first');
    expect(pdfPageText('criteria-running-first', 1)).toMatch(/Page 1 of/);
  });
});

test.describe('design', () => {
  test('scheme, size, font and margins apply and persist', async ({ page }) => {
    await page.goto(url('#criteria'));
    await page.click('#design');
    await page.selectOption('#design-scheme', 'slate');
    expect(await page.locator('.crit .num').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(43, 76, 126)');
    await page.selectOption('#design-size', '11');
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeGreaterThan(14.5);
    await page.selectOption('#design-body-font', 'Inter');
    expect(await page.locator('.crit p').first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Inter/);
    await page.fill('#design-margin-side', '25');
    await page.dispatchEvent('#design-margin-side', 'change');
    expect(await page.locator('#page-rule').evaluate((el) => el.textContent)).toMatch(/margin:\s*\d+mm 25mm/);
    await page.keyboard.press('Escape');
    await page.reload();
    expect(await page.locator('.crit .num').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(43, 76, 126)');
    await page.click('#design');
    await page.click('#design-reset');
    await page.keyboard.press('Escape');
    expect(await page.locator('.crit .num').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(31, 92, 77)');
  });
});

test.describe('documents', () => {
  test('add from template, rename, duplicate, reorder, delete', async ({ page }) => {
    await page.goto(url('#cv'));
    const docs0 = await page.locator('#tabs .tab').count();
    await page.click('#add-doc');
    await page.click('#menu-add-doc [data-template="letter"]');
    await expect(page.locator('#tabs .tab')).toHaveCount(docs0 + 1);
    await expect(page.locator('.letterhead')).toHaveCount(1);
    await expect(page.locator('.signoff')).toHaveCount(1);
    await page.click('#doc-menu');
    await page.fill('#doc-title', 'Renamed Letter');
    await page.dispatchEvent('#doc-title', 'change');
    await expect(page.locator('#tabs .tab[aria-selected="true"]')).toHaveText('Renamed Letter');
    await page.click('#doc-duplicate');
    await expect(page.locator('#tabs .tab')).toHaveCount(docs0 + 2);
    await page.click('#doc-menu');
    const activeBefore = await page.locator('#tabs .tab').evaluateAll((ts) => ts.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
    await page.click('#doc-left');
    const activeAfter = await page.locator('#tabs .tab').evaluateAll((ts) => ts.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
    expect(activeAfter).toBe(activeBefore - 1);
    page.once('dialog', (d) => d.accept());
    await page.click('#doc-delete');
    await expect(page.locator('#tabs .tab')).toHaveCount(docs0 + 1);
    await page.click('#doc-menu');
    page.once('dialog', (d) => d.accept());
    await page.click('#doc-delete');
    await expect(page.locator('#tabs .tab')).toHaveCount(docs0);
  });

  test('export, plain text, legacy import and reset', async ({ page }) => {
    await page.goto(url('#cv'));
    const docs0 = await page.locator('#tabs .tab').count();
    const ws = JSON.parse(await page.evaluate(() => window.Quire.exportJSON())) as { format: string; documents: unknown[] };
    expect(ws.format).toBe('quire/1');
    expect(ws.documents).toHaveLength(docs0);
    const plain = await page.evaluate(() => window.Quire.toPlainText(window.Quire.state.workspace.documents.find((d) => d.id === 'criteria')!));
    expect(plain).not.toMatch(/\*\*|\[\[/);
    expect(plain).toMatch(/^1\. /m);
    const legacy = JSON.stringify({
      cv: { id: 'cv', title: 'Legacy CV', blocks: [{ type: 'masthead', name: 'Legacy Person', creds: '', tagline: '', contact: [] }] },
      criteria: { id: 'criteria', title: 'Legacy Criteria', blocks: [{ type: 'docmast', kicker: '', title: 'T', sub: '', contact: [] }] },
    });
    await page.evaluate((j) => window.Quire.importJSON(j), legacy);
    await expect(page.locator('#tabs .tab')).toHaveCount(2);
    await expect(page.locator('#tabs .tab').first()).toHaveText('Legacy CV');
    page.once('dialog', (d) => d.accept());
    await fileMenu(page, '#reset');
    await expect(page.locator('#tabs .tab')).toHaveCount(docs0);
  });

  test('versions save and restore', async ({ page }) => {
    await page.goto(url('#cv'));
    await fileMenu(page, '#versions');
    await page.click('#version-save');
    expect(await page.locator('.version-restore').count()).toBeGreaterThanOrEqual(1);
    await page.keyboard.press('Escape');
    await page.locator('.name').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' CHANGED');
    await page.waitForTimeout(300);
    await fileMenu(page, '#versions');
    page.once('dialog', (d) => d.accept());
    await page.locator('.version-restore').first().click();
    await expect(page.locator('.name')).not.toContainText('CHANGED');
  });

  test('?open= loads a workspace file', async ({ page }) => {
    const loaded = { format: 'quire/1', documents: [{ id: 'only', title: 'Loaded Workspace', kind: 'blank', blocks: [{ type: 'docmast', kicker: 'k', title: 'Loaded', sub: '', contact: [] }] }] };
    writeFileSync(join(ART, 'ws.json'), JSON.stringify(loaded));
    await page.goto(url('?open=../test/.artefacts/ws.json'));
    await expect(page.locator('#tabs .tab').first()).toHaveText('Loaded Workspace');
  });
});

test.describe('print', () => {
  test('the chrome does not print and the demo CV is two pages', async ({ page }) => {
    await page.goto(url('#cv'));
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });
    expect(await page.locator('.toolbar').evaluate((el) => getComputedStyle(el).display)).toBe('none');
    expect(await page.locator('.ctl').first().evaluate((el) => getComputedStyle(el).display)).toBe('none');
    expect(await page.locator('.wc').first().evaluate((el) => getComputedStyle(el).display)).toBe('none');
    expect(pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: true }), 'cv')).toBe(2);
  });
});
