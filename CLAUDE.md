# Quire

An offline single-file editor for job application documents. `README.md` says what it does and
how to use it; `PRODUCT.md` records product truth; `DESIGN.md` records the visual system. This
file says how to work here. Global rules live in `~/.claude/CLAUDE.md`; workspace rules in
`../CLAUDE.md`.

## Repository

- GitHub `mjgardner87/Quire`, public. Personal, not an OpenForte product: no OpenForte marks.
- Base branch `main`. Small changes commit to `main`; larger work goes through a branch and a
  rebase merge.
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
