// Subset the vendored faces to WinAnsiEncoding and record their metrics, so the PDF writer in
// the browser needs no font library: it embeds these bytes and reads these widths.
// Run by `npm run build`. Writes src/fonts/faces.json, which is not committed.
import subsetFont from 'subset-font';
import * as fontkit from 'fontkit';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'src', 'fonts');

/** WinAnsiEncoding: the code points PDF reads from a single byte, in code order. */
export const WIN_ANSI = (() => {
  const map = new Array(256).fill(null);
  for (let c = 32; c < 127; c++) map[c] = c;
  const high = {
    128: 0x20ac, 130: 0x201a, 131: 0x0192, 132: 0x201e, 133: 0x2026, 134: 0x2020, 135: 0x2021,
    136: 0x02c6, 137: 0x2030, 138: 0x0160, 139: 0x2039, 140: 0x0152, 142: 0x017d, 145: 0x2018,
    146: 0x2019, 147: 0x201c, 148: 0x201d, 149: 0x2022, 150: 0x2013, 151: 0x2014, 152: 0x02dc,
    153: 0x2122, 154: 0x0161, 155: 0x203a, 156: 0x0153, 158: 0x017e, 159: 0x0178,
  };
  for (const [code, cp] of Object.entries(high)) map[Number(code)] = cp;
  for (let c = 160; c < 256; c++) map[c] = c;
  return map;
})();

const FACES = {
  'serif': 'XCharter-Roman.otf',
  'serif-bold': 'XCharter-Bold.otf',
  'serif-italic': 'XCharter-Italic.otf',
  'sans': 'Inter-Regular.ttf',
  'sans-medium': 'Inter-Medium.ttf',
  'sans-bold': 'Inter-SemiBold.ttf',
  'sans-italic': 'Inter-Italic.ttf',
};

/**
 * Where the outlines live in a subset sfnt. A TrueType face carries them in `glyf` and a PDF
 * embeds the whole file through /FontFile2. XCharter carries them in `CFF `, and a PDF embeds
 * that one table through /FontFile3 /Subtype /Type1C. The browser needs the whole sfnt either
 * way to make a FontFace, so record where the table sits rather than storing its bytes twice.
 */
function outlines(sfnt) {
  const count = sfnt.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const entry = 12 + i * 16;
    if (sfnt.toString('ascii', entry, entry + 4) === 'CFF ') {
      return { format: 'cff', cffStart: sfnt.readUInt32BE(entry + 8), cffLength: sfnt.readUInt32BE(entry + 12) };
    }
  }
  return { format: 'truetype' };
}

const text = WIN_ANSI.filter((cp) => cp !== null).map((cp) => String.fromCodePoint(cp)).join('');
const out = {};
for (const [id, file] of Object.entries(FACES)) {
  const source = readFileSync(join(dir, file));
  const subset = await subsetFont(source, text, { targetFormat: 'truetype' });
  const font = fontkit.create(subset);
  const scale = 1000 / font.unitsPerEm;
  const widths = WIN_ANSI.map((cp) => {
    if (cp === null) return 0;
    const [glyph] = font.glyphsForString(String.fromCodePoint(cp));
    return glyph ? Math.round(glyph.advanceWidth * scale) : 0;
  });
  out[id] = {
    ...outlines(subset),
    data: subset.toString('base64'),
    widths,
    ascent: Math.round(font.ascent * scale),
    descent: Math.round(font.descent * scale),
    capHeight: Math.round((font.capHeight ?? font.ascent) * scale),
    italicAngle: Math.round(font.italicAngle ?? 0),
    bbox: [font.bbox.minX, font.bbox.minY, font.bbox.maxX, font.bbox.maxY].map((v) => Math.round(v * scale)),
    flags: id.includes('serif') ? 34 : 32,
  };
  console.log(`  ${id.padEnd(13)} ${String(source.length).padStart(7)} -> ${String(subset.length).padStart(6)} bytes  ${out[id].format}`);
}
writeFileSync(join(dir, 'faces.json'), JSON.stringify(out));
const total = Object.values(out).reduce((n, f) => n + f.data.length, 0);
console.log(`  faces.json ${(total / 1024).toFixed(0)}KB of base64`);
