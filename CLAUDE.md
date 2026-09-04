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
- Chromium does not break a float cleanly at a column edge: it overflows the column, and
  `break-inside: avoid` does not stop it. The exporter lays a career entry out as a grid and
  keeps it whole.
