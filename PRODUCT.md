# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript (strict) with Vite, bundled by `vite-plugin-singlefile` into one `dist/index.html`.
Vitest for unit tests, Playwright for browser tests. Chosen by the user on 2 September 2026 from
three options (plain HTML, TypeScript and Vite, component framework). The artefact must still open
by double-click and print from the browser; the codebase may use dependencies and web fonts.

## Users

Matthew Gardner, a chartered engineer applying for senior public-sector roles in Canberra, writing
a CV, a response to selection criteria and sometimes a cover letter for each application, usually
in the fortnight before a closing date, often late in the evening after a working day. He knows
the content cold and wants to shape it, count it and print it without fighting a word processor.

Secondary, later: anyone Matthew shares the tool with who is applying for an Australian public
service or government role. The tool is built for the first user and must not embarrass itself
in front of the second. Confirmed 2 September 2026: "me, shareable later".

## Product Purpose

Quire holds the documents of one job application in a single file, lets the author edit them in
place in the finished design, counts words against the limits a panel sets, and prints them to a
PDF that looks typeset rather than word-processed. Success is a submitted application whose
documents read as one considered set, produced in less time than a word processor would take,
with nothing unresolved left in the text.

## Positioning

The design is fixed and good; the content is free. Word processors give the author every control
and therefore every way to make a document look assembled. Quire gives the author the text, the
structure (which sections, in what order, on which page) and a small set of design choices that
cannot produce an ugly result. What a neighbouring tool cannot truthfully copy: the documents are
edited inside the exact print layout, with live page estimates, word counts per criterion, and
visible flags for unresolved facts, so the file is always one click from a submission-ready PDF.

## Operating Context

- An application is a folder containing the position description, research notes, and the Quire
  workspace file (`*.quire.json`) holding the CV, criteria response and letter.
- Australian public service and ACT Government applications ask for a CV, a response to numbered
  selection criteria (often with a word limit per criterion or a total limit), two referees, and
  sometimes a cover letter. Selection may run on the written application alone.
- Output is a PDF per document, printed from Chromium's Save as PDF or rendered headlessly for a
  reproducible build. Portals sometimes take the criteria response as pasted plain text.
- The author edits on a desktop or laptop in Chromium or Chrome. Firefox is second.
- Fonts: Inter and Source Serif 4 load from Google Fonts; XCharter is preferred for the body when
  installed locally. The print result must hold on a machine without the local font.

## Capabilities and Constraints

- A workspace holds several documents; each has a kind (cv, criteria, letter, blank), a title,
  running header and footer text, numbering style, optional word limits, and three layout choices.
- The layout choices are the contact block (beside or under the name), the letterhead date (left or
  right) and a column's detail line (under or beside its item). Each appears under Document only
  when the document holds the block it moves, and each default is what the design already did.
  There is no alignment control on a paragraph: no centred body text and no justification.
- Blocks: masthead, document masthead, text section, achievements list, career entries,
  two-column list, skills list, paragraphs, criterion, closing with referees, letterhead, sign-off.
  Any block can be added, moved, removed, or made to start a new page.
- Inline emphasis is stored as plain markers (`**bold**`, `_italic_`) and unresolved facts as
  `[[CONFIRM: ...]]` flags. The file stays readable as JSON.
- Word counts exclude flag text and markers. Limits are per document and per criterion.
- Running header and footer print through CSS page margin boxes with `{page}`, `{pages}`,
  `{name}`, `{title}` and `{date}` tokens. Chromium 131 and later support this; other browsers
  print without them.
- Edits autosave in the browser, scoped to the file's own location. Saved versions can be
  restored. The workspace can be saved to and opened from a JSON file, or opened from a URL
  parameter for headless rendering.
- No server, no account, no telemetry. No personal data in the repository: the seed is fictional.
- Terminology: workspace, document, block, section, entry, bullet, criterion, flag, version,
  running header, running footer. "Section" is the user-facing word for a block with a heading.

## Brand Commitments

- Name: Quire (a gathering of sheets). Repository github.com/mjgardner87/Quire, public.
- Australian English in every string. No em dashes. No exclamation marks.
- Not an OpenForte product: no OpenForte colours, fonts or marks.
- Print design carried over from the first hand-built version and confirmed by the user: serif
  body, sans labels, one accent, hanging date column, restrained rules. Colour schemes extend it;
  they do not replace it.

## Evidence on Hand

- The first-generation editor and its two rendered documents, archived at
  `~/Documents/01. Job Apps/15. ACT Education - Senior Director Major Projects/reference/drafts/`.
  These are real content and must not enter the repository.
- The ACT Government position description and advertisement that set the document requirements
  (same folder, `reference/`).
- No testimonials, no user research beyond the first user. Do not invent any.

## Product Principles

1. The author owns every word; the tool owns the typography. Design choices are few, named and
   safe.
2. Nothing unresolved ships silently. Flags are loud on screen and in print until removed.
3. The count is always visible. Panels set limits; the tool shows the distance to them.
4. Structure is free within the set: any block type, any order, any page break, no other layout.
5. One file is the whole application. Open it anywhere, print it anywhere.

## Accessibility & Inclusion

Keyboard operation for every control, visible focus, WCAG AA contrast on the editing chrome and
on the printed page, and text that reflows at 200% zoom in the editor. No requirement beyond
that has been established.
