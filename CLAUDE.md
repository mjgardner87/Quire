# Quire

An offline single-file editor for job application documents. `README.md` says what it does and
how to use it; `PRODUCT.md` records product truth; `DESIGN.md` records the visual system. This
file says how to work here. Global rules live in `~/.claude/CLAUDE.md`; workspace rules in
`../CLAUDE.md`.

## Repository

- GitHub `mjgardner87/Quire`, public. Personal, not an OpenForte product: no OpenForte marks.
- Base branch `main`, protected: no direct pushes, including by the owner. Every change lands
  as a pull request that passes CI and that the owner merges with a rebase merge.
- `.github/` holds the CI gate, Dependabot, the templates and `CODEOWNERS`. `CONTRIBUTING.md`
  states the contributor workflow; `SECURITY.md` states the reporting path and threat model.
- The shipped artefact is `dist/index.html`, committed. `npm run check` fails when it differs
  from a fresh build, so rebuild before you commit.
- No personal data in the repository. The seed is fictional. Real applications keep their
  `.quire.json` beside the application, outside this repo.

## Gate

`npm test` runs typecheck, unit tests, build, drift check and the browser suite. It takes about
a minute. Keep it that way: one browser process, one test per behaviour a user would notice.
Do not add tests for coverage.

## Where things live

| Concern | File |
|---|---|
| Types, templates, counts, migration, `@page` rule, exports | `src/model.ts` (no DOM, unit tested) |
| Document rendering and controls | `src/render.ts` |
| State, storage, history, panels, rail, events | `src/editor.ts` |
| Text markers to and from DOM | `src/text.ts` |
| PDF bytes: pages, text, rectangles, embedded fonts | `src/pdf.ts` (no DOM, unit tested) |
| Reading the laid-out document into PDF items | `src/paint.ts` |
| Subsetting the vendored faces and their widths | `scripts/fonts.mjs` (writes the generated `src/fonts/faces.json`) |
| Print design | `src/styles/document.css` |
| Chrome | `src/styles/editor.css` |

## Rules that came from incidents

- `vite.config.ts` takes `defineConfig` from `vitest/config`, never from `vite`. The `test`
  key is Vitest's. Vitest 3 added it to Vite's own config type, Vitest 4 and Vite 8 do not, so
  the `vite` import fails the typecheck on any of those bumps.
- A control revealed by a transition reads as hidden if you measure it at once. The margin
  controls and the adders fade in over 120ms, so `getComputedStyle(el).opacity` straight after
  `Tab` returns the value the transition started from, not the one it lands on. An audit read it
  that way and reported eight focusable invisible controls that do not exist. Let the transition
  settle, then read.
- An element with `hidden` still shows if a class sets `display`. `editor.css` carries
  `[hidden] { display: none !important }`; keep it.
- Chromium cannot split a CSS grid row across pages, so career entries use a float layout.
  Do not "modernise" it back to grid.
- `fetch` refuses `file://`. Opening a workspace from `?open=` uses XMLHttpRequest, which
  Chromium allows with `--allow-file-access-from-files`.
- A control that re-renders its own panel becomes detached before the click reaches
  `document`. Outside-click logic reads `event.composedPath()`, never `event.target.closest`.
- Controls never sit inside a `contenteditable` run; the model would read them back as text.
- Storage keys include `location.pathname` so two copies of the file on one machine do not
  share a workspace.
- Export PDF writes the file here, not through the print dialog. The dialog paginates its own
  way, Gecko drops every `@page` margin box so a running header cannot print, and the browser
  stamps its own title, URL and date on the sheet.
- The export clone is typeset in the embedded faces. Text measured in one face and drawn in
  another collides: the sheet may be set in XCharter or in whatever fallback a machine has.
- A pseudo-element is not in the tree to be measured. The accent bar, the rule beside a heading
  and the dash before a bullet are all `::before` or `::after`. The exporter gives each a real
  element and switches the pseudos off first, or a heading draws its rule twice.
- The column pitch is fractional, so a column's own left edge can measure a hair under
  `k * pitch`. Take the page index with a pixel of tolerance, never a bare floor, and never
  `Math.round`, which sends a right-aligned block to the next page.
- Quire does its own page breaks. CSS multi-column looked like a free paginator, but neither
  engine keeps every fragment inside its column: Chromium overflows rather than break a float,
  Gecko overflows too and ignores a forced column break. An overflowing line is not moved to the
  next page, it is drawn off the foot of this one and lost. The exporter lays the document out in
  one flow and cuts it in `packPages`, which is the same in every browser.
- Marks that overlap in the flow cannot be split by a horizontal cut, so `packPages` merges them:
  a name and the contact block beside it, or the two halves of a two-column block.
- The running header and footer sit in the margin band, and the exporter centres each line in its
  own band. Measuring the line from the content edge instead drew the header 4.5pt inside the
  content box, across the first line of a full sheet.
- History belongs to the workspace, not to one document. Switching documents used to clear the
  undo and redo stacks, so a tab click destroyed the whole history with no warning. A snapshot
  carries its own `activeId`, so an undo returns to the document the change was made in.
- A swallowed storage write looks exactly like a saved document. `localStorage.setItem` throws in
  a private window, on a full quota, and in a browser set to block site data. Both writes report
  it once and the close is held while the browser stays in that state.
- A control that cannot act is disabled. The rail did that from the start; the same controls on
  the sheet stayed live and did nothing, because the model refuses the move. Both surfaces read
  the same rules.
- Verify an export by reading the PDF back, never by trusting the code that wrote it. The browser
  test renders every sheet and fails on any ink in the outer 4mm, which is how three lines of a
  career entry hanging off the foot of the sheet were caught.
