import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toDocx } from '../../src/docx';
import { defaultDesign, newDocument, type Design, type QDocument } from '../../src/model';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', '.artefacts');
mkdirSync(ART, { recursive: true });

/**
 * Write the bytes and read them back with unzip. A Word file is a zip: unzip -t checks the
 * central directory and the CRC of every entry, so an archive this writer got wrong fails here
 * rather than in the portal the author uploads it to.
 */
function readBack(bytes: Uint8Array, name: string): { names: string[]; part: (p: string) => string } {
  const file = join(ART, `${name}.docx`);
  writeFileSync(file, bytes);
  execFileSync('unzip', ['-t', file], { encoding: 'utf8' });
  const listing = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' });
  return {
    names: listing.split('\n').filter((s) => s !== ''),
    part: (p) => execFileSync('unzip', ['-p', file, p], { encoding: 'utf8' }),
  };
}

const criteria = (): QDocument => {
  const doc = newDocument('criteria');
  // Not the template's default, so the label proves the export reads the document's own choice.
  doc.numbering = 'both';
  const first = doc.blocks.find((b) => b.type === 'criterion');
  if (first?.type !== 'criterion') throw new Error('the criteria template has no criterion');
  first.heading = 'Shapes strategic thinking';
  first.paragraphs = ['I led **the programme** and _shaped_ its plan with [[CONFIRM: the budget]].'];
  return doc;
};

const design = (over: Partial<Design> = {}): Design => ({ ...defaultDesign(), ...over });

describe('the Word file', () => {
  test('is a zip Word can open, holding every part it requires', () => {
    const { names } = readBack(toDocx(newDocument('cv'), design(), '4 September 2026'), 'parts');
    expect(names).toEqual(expect.arrayContaining([
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'word/_rels/document.xml.rels',
      'word/styles.xml',
      'word/numbering.xml',
    ]));
  });

  test('carries the criterion, its number and the emphasis the author typed', () => {
    const { part } = readBack(toDocx(criteria(), design(), '4 September 2026'), 'criteria');
    const xml = part('word/document.xml');
    expect(xml).toContain('Criterion 1. Shapes strategic thinking');
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('the programme');
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('shaped');
  });

  test('keeps a flag loud: its brackets, its words and the amber the sheet prints', () => {
    const { part } = readBack(toDocx(criteria(), design(), '4 September 2026'), 'flag');
    const xml = part('word/document.xml');
    expect(xml).toContain('[[CONFIRM: the budget]]');
    expect(xml).toContain('9A4B00');
  });

  test('sets an A4 page with the margins the design panel holds', () => {
    const { part } = readBack(toDocx(newDocument('cv'), design({ marginTop: 20, marginSide: 18 }), '4 September 2026'), 'page');
    const xml = part('word/document.xml');
    expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
    // 20mm and 18mm in twips, rounded.
    expect(xml).toContain('w:top="1134"');
    expect(xml).toContain('w:left="1020"');
  });

  test('prints the running header and footer, page numbers included, off the first sheet', () => {
    const doc = newDocument('cv');
    const { names, part } = readBack(toDocx(doc, design(), '4 September 2026'), 'running');
    expect(names).toEqual(expect.arrayContaining(['word/header2.xml', 'word/footer2.xml']));
    const footer = part('word/footer2.xml');
    expect(footer).toContain(' PAGE ');
    expect(footer).toContain(' NUMPAGES ');
    // The first sheet carries its own masthead, so Word is told to leave it clear.
    expect(part('word/document.xml')).toContain('<w:titlePg/>');
  });
});
