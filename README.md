# Quire

One file for a job application. Quire holds a CV, a response to selection criteria and a
cover letter, lets you edit them in place in the finished design, counts words against the
limits a panel sets, and prints them to PDF from the browser.

A quire is a gathering of sheets.

## Use it

1. Download `dist/index.html` and open it in Chrome or Chromium. Firefox works, without
   running headers and footers.
2. The sample workspace opens. Click any text and type. Enter adds a bullet or paragraph.
   Backspace on an empty one removes it.
3. Use the structure rail on the left to reorder, remove or add sections. Drag a row, or use
   its buttons. Point at a block on the page to see the same controls in the right margin.
4. Set the colour scheme, type and margins under Design. Set page headers and footers under
   Header and footer. Set word limits and criterion numbering under Document.
5. Choose File, then Save file, to keep a `.quire.json` file with the application it belongs
   to. Edits also autosave in the browser.
6. Click Print and choose Save as PDF.

Text between `[[` and `]]` is a flag. It prints amber and the toolbar counts it, so a fact you
still have to confirm cannot slip into a submission. Select words and press Ctrl+Shift+F to flag
them.

### Keyboard

| Keys | Action |
|---|---|
| Enter | New bullet or paragraph after this one |
| Backspace | On an empty bullet or paragraph, remove it |
| Ctrl+B, Ctrl+I | Bold, italic |
| Ctrl+Shift+F | Flag the selected words |
| Alt+Up, Alt+Down | Move this bullet, paragraph or entry |
| Alt+Shift+Up, Alt+Shift+Down | Move the whole section |
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo a structural change (outside text) |
| Ctrl+S, Ctrl+O, Ctrl+P | Save file, open file, print |
| Esc | Close a panel |
| ? | Show the shortcuts |

### Headers and footers

Each document has three header slots and three footer slots. They accept `{page}`, `{pages}`,
`{name}`, `{title}` and `{date}`. Chromium 131 and later print them through CSS page margin
boxes. Other browsers print the page without them.

## Build it

```sh
npm install
npm run dev        # Vite dev server
npm run build      # dist/index.html, one self-contained file
npm test           # typecheck, unit tests, build, drift check, browser tests
```

Node 24 or later. Fonts: Inter and Source Serif 4 load from Google Fonts. If XCharter is
installed on the machine, the body uses it.

### Embed your own workspace

The build embeds `src/seed.json` as the sample. To ship a copy with your own workspace inside
it, so the file opens straight onto your documents:

```sh
QUIRE_SEED=/path/to/application.quire.json npm run build
cp dist/index.html "/path/to/application/Application Editor.html"
```

Edits in that copy autosave under its own path in the browser. Save a file before you move it.

### Render a PDF without a browser window

```sh
chromium-browser --headless --disable-gpu --no-sandbox \
  --allow-file-access-from-files --no-pdf-header-footer --virtual-time-budget=5000 \
  --print-to-pdf=cv.pdf "file:///path/to/index.html#cv"
```

`#cv` selects the document by id. With `--allow-file-access-from-files`, `?open=file.json`
loads a workspace from a file beside the page.

## Files

| Path | What it is |
|---|---|
| `src/model.ts` | Types, templates, word counts, migration, the `@page` rule, plain text and Markdown export. No DOM. |
| `src/render.ts` | Document to DOM, with editing controls. |
| `src/editor.ts` | State, storage, history, panels, structure rail, events. |
| `src/text.ts` | Model text to editable DOM and back. Bold, italic and flags are plain markers in the model. |
| `src/styles/document.css` | The printed design. Sizes are relative to `--base`, spacing to `--density`. |
| `src/styles/editor.css` | Editor chrome. Screen only. |
| `src/seed.json` | The fictional sample workspace. |
| `test/unit` | Vitest, for the model. |
| `test/e2e` | Playwright, against `dist/index.html`. |

## File format

A workspace is JSON: `format`, `design`, and `documents`. Each document has an `id`, a
`title`, a `kind` (`cv`, `criteria`, `letter` or `blank`), `numbering`, optional `wordLimit`
and `blockWordLimit`, `running` header and footer slots, and `blocks`. Block types: `masthead`,
`docmast`, `section` (kinds `prose`, `achievements`, `entries`, `columns`, `skills`), `opening`,
`criterion`, `closing`, `letterhead`, `signoff`. Any block may carry `pageBreak: true`.

Files from the first-generation editor (`{ cv: ..., criteria: ... }`) open and migrate.

## Licence

MIT. Icons are Phosphor Icons, MIT.
