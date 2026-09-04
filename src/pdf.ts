/**
 * A small PDF writer. It exists so that Export PDF writes the file itself, in every browser,
 * instead of handing the document to a print dialog that paginates it differently and stamps its
 * own header on it.
 *
 * The faces are subsetted to WinAnsiEncoding at build time (`scripts/fonts.mjs`), so a face is
 * embedded here as bytes plus a table of 256 advance widths. Nothing parses a font at runtime.
 */
import facesJSON from './fonts/faces.json';

export type FaceId = 'serif' | 'serif-bold' | 'serif-italic' | 'sans' | 'sans-medium' | 'sans-bold' | 'sans-italic';
export type Colour = readonly [number, number, number];

export interface TextItem {
  readonly kind: 'text';
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly face: FaceId;
  readonly colour: Colour;
  readonly text: string;
  /** Extra space between characters, in points. The chrome tracks small caps this way. */
  readonly tracking?: number;
}
export interface RectItem {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly colour: Colour;
}
export type Item = TextItem | RectItem;
export interface Page { readonly items: readonly Item[] }
export interface PageSize { readonly w: number; readonly h: number }

/** A4 in PostScript points, the unit every PDF coordinate here is in. */
export const A4: PageSize = { w: 595.276, h: 841.89 };

interface Face {
  readonly data: string;
  readonly widths: readonly number[];
  readonly ascent: number;
  readonly descent: number;
  readonly capHeight: number;
  readonly italicAngle: number;
  readonly bbox: readonly number[];
  readonly flags: number;
}
const FACES = facesJSON as unknown as Record<FaceId, Face>;
const BASE_NAME: Record<FaceId, string> = {
  'serif': 'SourceSerif4', 'serif-bold': 'SourceSerif4-SemiBold', 'serif-italic': 'SourceSerif4-Italic',
  'sans': 'Inter', 'sans-medium': 'Inter-Medium', 'sans-bold': 'Inter-SemiBold', 'sans-italic': 'Inter-Italic',
};

/** Unicode to WinAnsi code, for the codes that are not the character's own value. */
const WIN_ANSI_HIGH = new Map<number, number>([
  [0x20ac, 128], [0x201a, 130], [0x0192, 131], [0x201e, 132], [0x2026, 133], [0x2020, 134],
  [0x2021, 135], [0x02c6, 136], [0x2030, 137], [0x0160, 138], [0x2039, 139], [0x0152, 140],
  [0x017d, 142], [0x2018, 145], [0x2019, 146], [0x201c, 147], [0x201d, 148], [0x2022, 149],
  [0x2013, 150], [0x2014, 151], [0x02dc, 152], [0x2122, 153], [0x0161, 154], [0x203a, 155],
  [0x0153, 156], [0x017e, 158], [0x0178, 159],
]);

/** The WinAnsi byte for a code point, or the question mark when the encoding has no room for it. */
export function winAnsiByte(cp: number): number {
  if (cp >= 32 && cp < 127) return cp;
  if (cp >= 160 && cp < 256) return cp;
  return WIN_ANSI_HIGH.get(cp) ?? 63;
}

/** The width of a string at a size, in points. Line breaking and fitting read this. */
export function textWidth(text: string, face: FaceId, size: number, tracking = 0): number {
  const widths = FACES[face].widths;
  let total = 0;
  for (const ch of text) total += (widths[winAnsiByte(ch.codePointAt(0) ?? 63)] ?? 0) / 1000 * size + tracking;
  return total;
}

const enc = new TextEncoder();
const bytes = (s: string): Uint8Array => enc.encode(s);
const num = (n: number): string => (Math.round(n * 1000) / 1000).toString();

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A PDF literal string: the bytes of the text in WinAnsi, with the three reserved bytes escaped. */
function pdfString(text: string): Uint8Array {
  const out: number[] = [0x28];
  for (const ch of text) {
    const b = winAnsiByte(ch.codePointAt(0) ?? 63);
    if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c);
    out.push(b);
  }
  out.push(0x29);
  return new Uint8Array(out);
}

function contentStream(items: readonly Item[]): Uint8Array {
  const parts: Uint8Array[] = [];
  let colour: string | null = null;
  for (const item of items) {
    const c = `${num(item.colour[0])} ${num(item.colour[1])} ${num(item.colour[2])}`;
    if (item.kind === 'rect') {
      if (item.w <= 0 || item.h <= 0) continue;
      parts.push(bytes(`${c} rg\n${num(item.x)} ${num(item.y)} ${num(item.w)} ${num(item.h)} re f\n`));
      colour = null;
      continue;
    }
    if (!item.text) continue;
    if (c !== colour) { parts.push(bytes(`${c} rg\n`)); colour = c; }
    parts.push(bytes(`BT /${item.face} ${num(item.size)} Tf ${num(item.tracking ?? 0)} Tc 1 0 0 1 ${num(item.x)} ${num(item.y)} Tm `));
    parts.push(pdfString(item.text));
    parts.push(bytes(' Tj ET\n'));
  }
  return concat(parts);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Every face an item asks for, in a stable order, so the resource names are deterministic. */
function usedFaces(pages: readonly Page[]): FaceId[] {
  const seen = new Set<FaceId>();
  for (const page of pages) for (const item of page.items) if (item.kind === 'text') seen.add(item.face);
  return (Object.keys(FACES) as FaceId[]).filter((f) => seen.has(f));
}

export function writePdf(pages: readonly Page[], size: PageSize): Uint8Array {
  const faces = usedFaces(pages);
  const objects: Uint8Array[] = [];
  /** Reserve an object number. PDF numbers objects from 1. */
  const add = (body: Uint8Array): number => { objects.push(body); return objects.length; };

  const catalogue = add(new Uint8Array());        // 1, filled once the page tree exists
  const tree = add(new Uint8Array());             // 2
  const fontRefs = new Map<FaceId, number>();
  for (const id of faces) {
    const face = FACES[id];
    const data = base64ToBytes(face.data);
    const file = add(concat([
      bytes(`<< /Length ${data.length} /Length1 ${data.length} >>\nstream\n`), data, bytes('\nendstream'),
    ]));
    const descriptor = add(bytes(
      `<< /Type /FontDescriptor /FontName /${BASE_NAME[id]} /Flags ${face.flags}`
      + ` /FontBBox [${face.bbox.join(' ')}] /ItalicAngle ${face.italicAngle} /Ascent ${face.ascent}`
      + ` /Descent ${face.descent} /CapHeight ${face.capHeight} /StemV 80 /FontFile2 ${file} 0 R >>`));
    fontRefs.set(id, add(bytes(
      `<< /Type /Font /Subtype /TrueType /BaseFont /${BASE_NAME[id]} /FirstChar 0 /LastChar 255`
      + ` /Widths [${face.widths.join(' ')}] /Encoding /WinAnsiEncoding /FontDescriptor ${descriptor} 0 R >>`)));
  }
  const resources = `<< /Font << ${faces.map((f) => `/${f} ${fontRefs.get(f)} 0 R`).join(' ')} >> >>`;
  const pageRefs: number[] = [];
  for (const page of pages) {
    const stream = contentStream(page.items);
    const contents = add(concat([bytes(`<< /Length ${stream.length} >>\nstream\n`), stream, bytes('\nendstream')]));
    pageRefs.push(add(bytes(
      `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${num(size.w)} ${num(size.h)}]`
      + ` /Resources ${resources} /Contents ${contents} 0 R >>`)));
  }
  objects[tree - 1] = bytes(`<< /Type /Pages /Kids [${pageRefs.map((r) => `${r} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`);
  objects[catalogue - 1] = bytes(`<< /Type /Catalog /Pages ${tree} 0 R >>`);

  const parts: Uint8Array[] = [bytes('%PDF-1.7\n%âãÏÓ\n')];
  let offset = parts[0]!.length;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    const head = bytes(`${i + 1} 0 obj\n`);
    const tail = bytes('\nendobj\n');
    offsets.push(offset);
    parts.push(head, body, tail);
    offset += head.length + body.length + tail.length;
  });
  const xrefAt = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) xref += `${String(at).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogue} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  parts.push(bytes(xref));
  return concat(parts);
}
