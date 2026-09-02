// Screenshot the built editor for a visual check: node scripts/screenshots.mjs [outDir]
// Writes desktop.png and mobile.png (the finish-review pair) plus a few states.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? '.impeccable/review';
mkdirSync(out, { recursive: true });
const dist = 'file://' + join(process.cwd(), 'dist', 'index.html');
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250); };

await page.goto(dist + '#cv'); await settle();
await page.screenshot({ path: join(out, 'desktop.png') });
await page.hover('.entry >> nth=0'); await page.waitForTimeout(150);
await page.screenshot({ path: join(out, 'cv-hover.png') });
await page.click('#design'); await page.waitForTimeout(200);
await page.screenshot({ path: join(out, 'design-panel.png') });
await page.keyboard.press('Escape');
await page.goto(dist + '#criteria'); await settle();
await page.click('#doc-menu'); await page.waitForTimeout(200);
await page.screenshot({ path: join(out, 'criteria-document-panel.png') });
await page.keyboard.press('Escape');
await page.click('#running'); await page.waitForTimeout(200);
await page.screenshot({ path: join(out, 'running-panel.png') });
await page.keyboard.press('Escape');
await page.goto(dist + '#letter'); await settle();
await page.screenshot({ path: join(out, 'letter.png') });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(dist + '#cv'); await settle();
await page.screenshot({ path: join(out, 'mobile.png') });
await browser.close();
console.log(`screenshots written to ${out}/`);
