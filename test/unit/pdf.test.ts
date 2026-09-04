import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePdf, A4, type Page } from '../../src/pdf';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', '.artefacts');
mkdirSync(ART, { recursive: true });

/** Write the bytes and read them back with poppler. A PDF that poppler cannot read is not a PDF. */
function readBack(pages: Page[], name: string): { info: string; text: string } {
  const file = join(ART, `${name}.pdf`);
  writeFileSync(file, writePdf(pages, A4));
  return {
    info: execFileSync('pdfinfo', [file], { encoding: 'utf8' }),
    text: execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }),
  };
}

describe('pdf writer', () => {
  test('writes an A4 page whose text reads back', () => {
    const pages: Page[] = [{ items: [
      { kind: 'text', x: 60, y: 700, size: 11, face: 'serif', colour: [0, 0, 0], text: 'Jordan Example' },
      { kind: 'text', x: 60, y: 680, size: 9, face: 'sans', colour: [0.4, 0.4, 0.4], text: 'Canberra ACT' },
    ] }];
    const { info, text } = readBack(pages, 'writer-one-page');
    expect(info).toMatch(/^Pages:\s+1/m);
    expect(info).toMatch(/595(\.\d+)? x 841(\.\d+)?/);
    expect(text).toContain('Jordan Example');
    expect(text).toContain('Canberra ACT');
  });

  test('writes one page per page and keeps their text apart', () => {
    const pages: Page[] = [
      { items: [{ kind: 'text', x: 60, y: 700, size: 11, face: 'serif', colour: [0, 0, 0], text: 'First sheet' }] },
      { items: [{ kind: 'text', x: 60, y: 700, size: 11, face: 'serif', colour: [0, 0, 0], text: 'Second sheet' }] },
    ];
    const file = join(ART, 'writer-two-pages.pdf');
    writeFileSync(file, writePdf(pages, A4));
    expect(execFileSync('pdfinfo', [file], { encoding: 'utf8' })).toMatch(/^Pages:\s+2/m);
    const page2 = execFileSync('pdftotext', ['-f', '2', '-l', '2', file, '-'], { encoding: 'utf8' });
    expect(page2).toContain('Second sheet');
    expect(page2).not.toContain('First sheet');
  });

  test('keeps the accented and punctuation characters a name needs', () => {
    const { text } = readBack([{ items: [
      { kind: 'text', x: 60, y: 700, size: 11, face: 'serif', colour: [0, 0, 0], text: 'José Ferrão · BEng (Hons) – 2026' },
    ] }], 'writer-accents');
    expect(text).toContain('José Ferrão');
    expect(text).toContain('·');
    expect(text).toContain('–');
  });

  test('fills a rectangle in the colour it is given', () => {
    const pages: Page[] = [{ items: [
      { kind: 'rect', x: 60, y: 700, w: 45, h: 2, colour: [0.12, 0.36, 0.30] },
    ] }];
    const file = join(ART, 'writer-rect.pdf');
    writeFileSync(file, writePdf(pages, A4));
    // A raw PPM needs no inflating and no row filters, so the pixel under test is a plain offset.
    const ppm = execFileSync('pdftoppm', ['-r', '72', '-f', '1', '-l', '1', file], { maxBuffer: 1 << 26 });
    const header = ppm.subarray(0, 32).toString('latin1');
    const [, w, h] = /^P6\s+(\d+)\s+(\d+)\s+255\s/.exec(header) ?? [];
    expect(w).toBeDefined();
    const start = header.indexOf('255') + 4;
    const at = (x: number, y: number): number[] => {
      const off = start + (y * Number(w) + x) * 3;
      return [ppm[off]!, ppm[off + 1]!, ppm[off + 2]!];
    };
    const [r, g, b] = at(70, Number(h) - 701);
    expect(r).toBeLessThan(90);
    expect(g).toBeGreaterThan(70);
    expect(b).toBeGreaterThan(50);
    // A pixel well away from the bar stays paper white.
    expect(at(400, Number(h) - 701)[0]).toBeGreaterThan(240);
  });
});
