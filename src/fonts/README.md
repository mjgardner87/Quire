# Fonts

Source Serif 4 and Inter, vendored as static TrueType so the build does not fetch anything.
Both are under the SIL Open Font Licence 1.1: `OFL-SourceSerif4.txt` and `OFL-Inter.txt`.

`scripts/fonts.mjs` subsets each face to WinAnsiEncoding and records its advance widths into
`faces.json`, which the build inlines and `src/pdf.ts` embeds. `faces.json` is generated, not
committed. Run `npm run fonts` to rebuild it.

The exported PDF is typeset in these faces on every machine, whatever the reader has installed.
