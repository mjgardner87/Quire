# Fonts

XCharter and Inter, vendored as static files so the build does not fetch anything.

- XCharter is the serif the sheet previews in and the PDF is set in. It is free under the
  Bitstream Charter licence: `LICENCE-XCharter.txt`, which must stay with the fonts.
- Inter is the sans, under the SIL Open Font Licence 1.1: `OFL-Inter.txt`.

`scripts/fonts.mjs` subsets each face to WinAnsiEncoding and records its advance widths into
`faces.json`, which the build inlines and `src/pdf.ts` embeds. `faces.json` is generated, not
committed. Run `npm run fonts` to rebuild it.

The two families carry their outlines differently, and a PDF embeds each its own way. Inter is
TrueType, so the whole file goes in through `/FontFile2`. XCharter is CFF, so its `CFF ` table
alone goes in through `/FontFile3 /Subtype /Type1C` and the font dictionary is a `/Type1`.
`faces.json` records the format and, for a CFF face, where that table sits in the subset, so the
browser can still make a `FontFace` from the whole sfnt without the bytes being stored twice.

The exported PDF is typeset in these faces on every machine, whatever the reader has installed.

`SourceSerif4-*.ttf` and `OFL-SourceSerif4.txt` are the previous serif. Nothing reads them now.
