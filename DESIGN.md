---
name: Quire
description: One job application, edited in place on an A4 sheet that prints as it reads.
colors:
  accent: "#1f5c4d"
  eucalyptus: "#1f5c4d"
  slate: "#2b4c7e"
  oxblood: "#7a2e2e"
  charcoal: "#333a40"
  ochre: "#8a5a12"
  plum: "#5b3a6e"
  ink: "#1c2024"
  ink-2: "#3a4148"
  muted: "#6a7178"
  rule: "#d2d7db"
  rule-strong: "#9aa3aa"
  sheet: "#ffffff"
  desk: "#e6e9ec"
  bar: "#fbfbfc"
  rail: "#f1f3f5"
  line: "#d9dde1"
  line-strong: "#c3c9ce"
  chrome-muted: "#626970"
  chrome-quiet: "#687079"
  flag: "#9a4b00"
  flag-bg: "#fff1dc"
  danger: "#a3271f"
  brand: "#2f47b8"
typography:
  display:
    fontFamily: "Inter Display, Inter, system-ui, sans-serif"
    fontSize: "2.4rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.022em"
  headline:
    fontFamily: "Inter Display, Inter, system-ui, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "XCharter, Source Serif 4, Charter, Georgia, serif"
    fontSize: "0.98rem"
    fontWeight: 400
    lineHeight: 1.44
  list:
    fontFamily: "XCharter, Source Serif 4, Charter, Georgia, serif"
    fontSize: "0.92rem"
    fontWeight: 400
    lineHeight: 1.34
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.84rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.76rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.16em"
  control:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1
  rail:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.3
  badge:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  run: "2px"
  xs: "4px"
  sm: "5px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  round: "50%"
  flag: "0.6mm"
spacing:
  2xs: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  control: "32px"
  tier: "44px"
  toolbar: "89px"
  rail-width: "284px"
  panel-width: "400px"
  margin-top: "14mm"
  margin-side: "17mm"
  gutter: "8mm"
  date-column: "36mm"
  text-indent: "41mm"
  section-gap: "3.6mm"
  heading-gap: "2.2mm"
  paragraph-gap: "2mm"
  entry-gap: "3.2mm"
  criterion-gap: "6.5mm"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.sheet}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 11px"
    height: "{spacing.control}"
  button-default:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 11px"
    height: "{spacing.control}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 11px"
    height: "{spacing.control}"
  button-quiet-hover:
    textColor: "{colors.ink}"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.chrome-muted}"
    typography: "{typography.control}"
    padding: "0 12px"
    height: "{spacing.tier}"
  tab-active:
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 9px"
    height: "{spacing.control}"
  rail-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.rail}"
    rounded: "{rounded.md}"
    padding: "0 6px 0 4px"
    height: "{spacing.control}"
  rail-row-current:
    textColor: "{colors.accent}"
  menu:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "6px"
    width: "220px"
  panel:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    width: "{spacing.panel-width}"
  block-control:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    size: "24px"
  flag:
    backgroundColor: "{colors.flag-bg}"
    textColor: "{colors.flag}"
    rounded: "{rounded.flag}"
    padding: "0.2mm 1.2mm"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
  selection-toolbar:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "7px"
    padding: "3px"
  selection-toolbar-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 7px"
    height: "26px"
  context-menu:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "6px"
    width: "240px"
  palette:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    width: "560px"
  palette-input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "0 16px"
    height: "{spacing.tier}"
  palette-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  palette-row-active:
    textColor: "{colors.accent}"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "14mm 17mm"
    width: "210mm"
---

# Design System: Quire

## Overview

**Creative North Star: "The Drafting Table"**

Quire is one white A4 sheet on a cool grey desk. The sheet is the finished document: serif body, sans labels, one accent, a hanging date column and hairline rules, the print design the author confirmed on 2 September 2026. Everything around the sheet is furniture. The toolbar, the structure rail, the margin controls and the panels are set in one family (Inter) at one control size (13px), in cool neutrals that borrow no colour of their own. The only colour the chrome carries is the document's accent, and it carries it in exactly four places: the active tab, the focus ring, the text selection and the primary action.

The system is an expansion of an established print world, not a new one. The document stylesheet came first and is normative; the editor stylesheet extends it. Every size inside the sheet is a rem on a root of 9 to 11pt so the Design panel can scale the whole page, and every vertical gap is multiplied by a density factor. The chrome measures in pixels and never enters the sheet. At print, the chrome is erased and the sheet's editing affordances are stripped, so paper shows the document and nothing else.

Density is editorial rather than dense: the sheet holds a full A4 page of 10pt text, the rail holds a table of contents at 32px per row, and controls appear only where the pointer or focus is. Confirmed rejections: no cards, no decorative gradients, no ribbons or rulers, no floating page, no OpenForte colours or marks.

**Key Characteristics:**
- One user-chosen accent, applied through a single custom property to both the printed document and the editing chrome.
- Serif body (Charter, then Source Serif 4) with Inter for every label, date, heading and control.
- Hairline rules: 0.5pt on the sheet, 1px in the chrome, and one 1.6pt accent bar at the masthead.
- Two shadows only: the sheet's soft offset shadow and the lifted shadow under panels, menus and toasts.
- Controls in the sheet's right margin, shown on hover or focus, like a proof-reader's marks.
- Flags are amber on screen and on paper; the same amber marks an over-limit word count.
- Phosphor regular icons, inlined as SVG, one stroke weight throughout.
- One fixed brand colour, indigo, on the Quire mark alone; every other hue in the chrome is the document's.

## Colors

A restrained palette: cool blue-grey neutrals, one accent chosen from six schemes or set by hand, amber for anything unresolved, and a single red for destructive actions.

### Primary
- **Accent** (default Eucalyptus, `#1f5c4d`): The document's own colour. On the sheet it draws the masthead bar, section headings, credentials line, criterion numbers, achievement dashes and skill separators. In the chrome it draws the active tab's underline, every focus ring, the caret, the primary Print button and the current rail row. The user picks it in the Design panel; the tool writes it to `--accent` on the root and nothing else changes.
- **Schemes** (Eucalyptus `#1f5c4d`, Slate `#2b4c7e`, Oxblood `#7a2e2e`, Charcoal `#333a40`, Ochre `#8a5a12`, Plum `#5b3a6e`): The six presets. Each is a dark, low-chroma tone that holds AA contrast as text on white. A seventh choice, Custom, takes any colour from a colour input.
- **Accent tints** (derived, never stored): Soft, `color-mix(in srgb, var(--accent) 9%, white)`, is the hover and current-row wash in the chrome. Ring, `color-mix(in srgb, var(--accent) 35%, transparent)`, is the hover outline on an editable run and the current-block bar. Selection, `color-mix(in srgb, var(--accent) 22%, white)`, is the text selection on the sheet. Focus wash, 4% of the accent over transparent, sits behind a focused run.

### Brand
- **Quire indigo** (`#2f47b8`): The mark only. It colours the folded-sheets glyph beside the wordmark and fills the favicon tile, and nothing else: never a control, never text, never the sheet. It is fixed and independent of the document scheme, so the tool keeps one identity while the author's documents take any accent.

### Neutral
- **Ink** (`#1c2024`): Body text on the sheet and control text in the chrome. Also the toast background.
- **Ink 2** (`#3a4148`): The tagline and context lines on the sheet; rail text and quiet-button text in the chrome.
- **Muted** (`#6a7178`): Organisation lines, contact block, sub-lines and the running header and footer on the sheet.
- **Chrome muted** (`#626970`): Tab labels, the status line, panel hints, group headings and type icons in the rail. It runs a touch darker than the sheet's muted so it holds AA on the tinted bar and rail.
- **Chrome quiet** (`#687079`): The small-text tone. Word-count badges in the margin, placeholders in editable runs and inputs, menu shortcut hints and disabled toolbar buttons.
- **Rule** (`#d2d7db`) and **Rule strong** (`#9aa3aa`): The sheet's hairlines. Rule sits after a section heading and above the closing; rule strong closes the masthead and draws the dash before an entry bullet. In the chrome, rule strong colours only hairlines and grips, never text.
- **Sheet** (`#ffffff`): The page, panels, menus, buttons and inputs.
- **Desk** (`#e6e9ec`): The page background behind the sheet.
- **Bar** (`#fbfbfc`) and **Rail** (`#f1f3f5`): The toolbar and the structure rail, each one step off white so the sheet reads as the brightest surface.
- **Line** (`#d9dde1`) and **Line strong** (`#c3c9ce`): The chrome's hairlines and borders. Line separates tiers, menus and panels; line strong outlines buttons, inputs, swatches and the dashed add controls.

### Semantic
- **Flag** (`#9a4b00`) on **Flag background** (`#fff1dc`): An unresolved fact on the sheet, and the over-limit state of the word count, the pages estimate and the flags button in the chrome. One pair, both media.
- **Danger** (`#a3271f`): Remove and reset actions on hover, and the error toast. It never appears at rest.

### Named Rules
**The One Accent Rule.** One accent, chosen by the user, written once to `--accent` and read by both stylesheets. The chrome never carries a hue the document does not, with one exception: the brand indigo on the Quire mark, which is never a control.

**The Four Places Rule.** In the chrome the accent appears on the active tab, the focus ring, the selection and the primary action, plus the current item in the rail and margin. Everything else is neutral.

**The Amber Flag Rule.** Anything unresolved is amber on cream, on screen and on paper. The same pair marks a count over its limit. No other warning colour exists.

## Typography

**Display Font:** Inter Display (with Inter, then system-ui)
**Body Font:** XCharter (with Source Serif 4, Charter, Georgia)
**Label Font:** Inter (with system-ui)
**Chrome Font:** Inter (with system-ui, -apple-system, Segoe UI)

**Character:** A typeset application rather than a word-processed one. The serif carries every sentence the author wrote; the sans carries every label the tool wrote: headings, dates, organisations, credentials, counts. The user may swap the body to Source Serif, Georgia, Inter or the system sans, and the label face to the system sans or to Charter, from fixed lists. Three weights load: 400, 500 and 600. Nothing is bold beyond 600.

### Hierarchy

Sizes on the sheet are rem on a root of `--base`, default 10pt, chosen from 9, 9.5, 10, 10.5 or 11pt. Sizes in the chrome are pixels and do not scale with the sheet.

- **Display** (600, 2.4rem, line-height 1, tracking -0.022em): The author's name in the CV masthead.
- **Headline** (600, 1.9rem, line-height 1.08, tracking -0.018em): The document title in the criteria response and letter masthead, and the criterion number in the accent.
- **Criterion heading** (600, 1.1rem, line-height 1.3, tracking -0.005em, ink): The criterion wording as the panel wrote it. A section heading with the uppercase and the rule removed.
- **Title** (600, 1rem, line-height 1.25): The role title of a career entry. Column headings step down to 0.82rem.
- **Body** (400, 0.98rem, line-height 1.44): Profile prose. Opening paragraphs and criterion responses rise to 1rem and 1.04rem with line-height 1.46 to 1.48; the tagline is 1.04rem at 1.38. Orphans and widows are held to three lines.
- **List** (400, 0.92rem, line-height 1.34 to 1.4): Achievements and entry bullets. Two-column items and referees drop to 0.86rem.
- **Caption** (400, 0.77 to 0.86rem, line-height 1.4 to 1.55, muted): Contact block, organisation line, sub-lines, document subtitle and letter date. Dates in the hanging column are 600 at 0.84rem in ink.
- **Label** (600, 0.76rem, tracking 0.16em, uppercase, accent): Section headings, followed by a hairline that runs to the right edge. The credentials line under the name is the same device at 500 and 0.8rem with tracking 0.13em; the criterion label above a heading is 500, 0.74rem, 0.14em, muted. A new criteria document numbers its criteria with the numeral only; the label, both together, or neither remain per-document options.
- **Running header and footer** (400, 7.6pt, tracking 0.02em, muted): Set through `@page` margin boxes in the label face.
- **Control** (500, 13px, line-height 1): Every button, tab, select, menu item and input in the chrome. The wordmark is 600 at 15px with tracking -0.01em, in ink, with the mark 7px to its left.
- **Rail** (500, 12.5px, line-height 1.3): Rail rows and the status line. The current document's title in the rail is 600 at 13px; its meta line is 11.5px.
- **Badge** (600, 10.5 to 11px, tracking 0.08em, uppercase, chrome muted): Menu group headings, the rail heading, panel sub-headings. Word counts in the margin are 500 at 10.5px, tabular, in chrome quiet; page-break and guide tags are 500 at 10px.

### Named Rules
**The Base Rule.** Inside the sheet, every size is a rem of `--base` and every vertical gap is a millimetre value multiplied by `--density`. No pixel enters the sheet.

**The Serif Sentence Rule.** Text the author wrote is serif. Text the tool set (headings, dates, organisations, labels, counts, controls) is Inter. A user may swap either face, but never mix a third.

**The Tabular Rule.** Numbers in the sheet, the toolbar status and the rail counts are tabular (`tnum`), so a moving count does not shift its neighbours.

## Layout

The viewport is three fixed regions and one scrolling desk. The toolbar is fixed to the top in two 44px tiers with a 1px line between them (89px in total): documents, New, File and Print above; Add a section, undo and redo, Design, Header and footer, Document, the status line and the rail toggle below. The direction contract first named a single 52px bar and a 224px rail; the build settled on two tiers and 284px, and the build is the record.

The structure rail is 284px wide, sticky under the toolbar, and lists the document's blocks as a table of contents, one 32px row each: grip, type icon, title, count. It hides below 1100px or on the rail toggle. The desk fills the rest, padded 28px above, 24px at the sides and 64px below, and centres the sheet.

The sheet is 210mm by at least 297mm, padded by the user's margins (default 14mm top and bottom, 17mm at the sides; the same values write the `@page` rule). Block controls sit 16.5mm outside the right edge, in the printed margin; the current-block bar sits 6mm outside the left edge. Inside the sheet the CV masthead is a two-column grid, text and a 52mm contact column with an 8mm gutter. Career entries hang a 36mm date column on the left with the text starting at 41mm, as a float rather than a grid so an entry can split across a page. Two-column and three-column lists use 8mm and 6mm gutters.

Vertical rhythm on the sheet, at density 1: 3.6mm between sections, 2.2mm under a heading, 2mm between paragraphs, 3.2mm between entries, 0.7 to 1.1mm between list items, 6.5mm before a criterion and 7mm before the closing. The chrome's rhythm is 2, 4, 6, 8, 12 and 16px, with 6px gaps between toolbar items and 14px between panel fields.

Below 760px the tiers wrap (the toolbar grows to 130px), the desk scrolls horizontally, the sheet zooms to 60%, and the margin controls and counts are hidden. Below 1100px the rail is gone.

## Elevation & Depth

Depth is nearly flat. Two shadows exist. The sheet casts a soft offset shadow onto the desk so it reads as paper lying on a surface. Panels, menus, the right-click menu, the selection toolbar, the command palette and toasts cast a lifted shadow because they float above the desk for a moment and then leave. Everything else, including the toolbar, the rail, buttons and inputs, is flat and bounded by a hairline. A hovered rail row and the margin control buttons carry a 1px hairline shadow that lifts them from the tinted rail or the white sheet by the least visible amount.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px rgba(22, 30, 38, 0.06), 0 16px 40px -8px rgba(22, 30, 38, 0.18)`): The A4 sheet on the desk. Nothing else uses it.
- **Panel** (`box-shadow: 0 12px 32px -12px rgba(22, 30, 38, 0.28), 0 2px 6px rgba(22, 30, 38, 0.08)`): Floating panels, menus and toasts.
- **Hairline lift** (`box-shadow: 0 1px 2px rgba(22, 30, 38, 0.06)` to `0.08`): A hovered rail row on the rail, and a margin control button on the sheet.

### Named Rules
**The Two Shadows Rule.** Only the sheet and floating surfaces cast a shadow. A control is flat, and a hairline border says where it ends.

**The Rise Rule.** A floating surface rises: opacity 0 to 1 and 4px upward over 160ms on `cubic-bezier(0.2, 0.8, 0.2, 1)`. A toast rises from below over 6px. The selection toolbar rises over 120ms, because it follows the caret and must not lag it. Hover changes fade over 120ms on the same curve. A moved block settles from the soft accent wash to transparent over 600ms. Nothing else moves.

## Shapes

Corners are small and graded by size. An editable run has a 2px corner so its hover ring follows the text. Small buttons, `kbd` keys and the adder have 4px; menu items and margin control buttons 5px; buttons, selects, inputs and rail rows 6px; menus and toasts 8px; panels 10px. Swatches and the colour input are circles. The sheet has square corners, and on the sheet only the flag is rounded, at 0.6mm.

Rules are hairlines. On paper they are 0.5pt in rule or rule strong; in the chrome they are 1px in line or line strong. The one heavier mark is the accent bar at the head of a document: 16mm wide, 1.6pt tall. Bullets are dashes, not discs: a 2.2mm by 0.6pt accent stroke before an achievement, a 1.8mm by 0.5pt rule-strong stroke before an entry bullet. Skills are separated by a middle dot in the accent.

Dashed lines mean "not yet part of the page": the page-break marker, the guide lines, the add-section button in the rail, the adder under a block and the drop indicator's neighbours. Borders are 1px throughout; a `kbd` key has a 2px bottom border so it reads as a key.

## Components

### Buttons
Calm, bordered, one line of Inter. Every button has a visible name; the three icon-only buttons (undo, redo, rail toggle) carry the name as `title` and `aria-label`.
- **Shape:** 6px corners, 32px tall, 11px side padding, 6px gap between icon and text.
- **Primary:** Accent background, white text, accent border. Only Print in the toolbar and the confirming action in a panel. Hover darkens by `filter: brightness(0.92)`.
- **Default:** White background, ink text, line-strong border. Hover turns the border to the accent. An open menu button takes the soft accent wash and the accent border.
- **Quiet:** No border, no background, ink-2 text. Hover takes the soft accent wash and ink text.
- **Disabled:** Chrome quiet text, line border, transparent background, default cursor.
- **Focus:** 2px accent outline offset 2px on every control in the toolbar, rail, panels and menus. A tab focuses inward, offset -4px, with a 4px corner.
- **Panel button:** The same at 30px tall, 12.5px text and 10px padding. Disabled uses chrome quiet, like every disabled control.
- **Start buttons (empty sheet):** Default style with 10px by 14px padding; hover adds the soft accent wash.

### Tabs
- **Style:** 44px tall, 13px Inter at 500, chrome-muted text, no border, 12px padding, 2px gap. Long titles truncate at 280px.
- **Hover / Active:** Text turns ink. The selected tab draws a 2px accent underline inset 10px from each end, sitting on the tier's bottom line.

### Menus
- **Style:** White, 1px line border, 8px corners, panel shadow, 6px inner padding, 220px minimum, 38px below its anchor. Rises over 160ms.
- **Items:** 13px Inter at 500, ink, 9px by 10px padding, 5px corners. Hover and focus take the soft accent wash. A shortcut sits right in chrome quiet at 11px with no key styling. Group headings are badges. A separator is a 1px line with 5px margins. A danger item turns red on hover only.

### Right-click menu
The same menu vocabulary, opened at the pointer. Right-click on any editable run positions a fixed menu at the click (kept 8px inside the viewport), at least 240px wide, and moves the caret there if the selection was collapsed. Shift-click keeps the browser's own menu for spelling. Items are the commands that apply at that point (Format, then Structure), separated by group with the 1px menu line, each with its shortcut as a plain `kbd` pushed to the right. The first item takes focus.

### Selection toolbar
A small white bar that appears 8px above a text selection or a flag on the sheet: 3px padding, 1px line border, 7px corners, panel shadow, rising over 120ms. Its buttons are 26px tall with 7px side padding, 12px Inter at 500 in ink, 5px corners, no border, with a 14px Phosphor icon; hover takes the soft accent wash and accent text. Bold and Italic are icon-only with `title` and `aria-label`; a 1px 16px-tall line separates them from Flag or Remove flag, which carry their labels. It shows only the commands that apply: Bold, Italic and the separator need a selection, Flag hides inside a flag, Remove flag shows only there. It hides while a panel is open and stays clamped 8px inside the viewport.

### Command palette
Ctrl K. A 560px white dialog centred at 96px from the top, 10px corners, 1px line border, panel shadow, rising over 160ms. A 44px input at 14px Inter with 16px side padding, no border but a 1px line beneath, placeholder in chrome quiet. Below it a list padded 6px and capped at 380px: each row is an uppercase group label (500, 10.5px, 0.06em, chrome quiet, 64px minimum) then the command, then its shortcut as a plain `kbd`; rows have 8px by 10px padding and 6px corners. Hover and the active row take the soft accent wash; the active row and its group label turn accent. At most 40 matches show; an empty result is a single muted line. A hint line in 11.5px chrome quiet sits under a 1px top line. Arrow keys move, Enter runs, Esc closes.

### Panels
- **Style:** Fixed under the toolbar, 400px wide, white, 1px line border, 10px corners, panel shadow, 13px Inter at 400. Rises over 160ms. The shortcuts panel docks right; all others dock left at 16px.
- **Head:** 600 at 14px, with a 28px close button that takes the soft accent wash on hover.
- **Body:** 16px side padding, 14px between fields; a field is a 500 12px ink-2 label over its control with a 5px gap; hints are 12px chrome muted.

### Inputs / Fields
- **Style:** 32px tall, 9px side padding, white, 1px line-strong border, 6px corners, 13px Inter at 400. Selects are the same with a Phosphor caret inlined at 14px and a 160px minimum in the toolbar.
- **Hover / Focus:** Border to the accent on hover; 2px accent outline offset 2px on focus. Placeholder in chrome quiet. Checkboxes take the accent through `accent-color`.
- **Scheme swatches:** 22px circles of each scheme's accent, white 2px border, 1px line-strong ring. Hover darkens the ring to ink 2; the selected swatch takes a 2px ink ring. The custom colour input is the same circle.

### Navigation (structure rail)
- **Style:** 284px, rail background, 1px line on its right, 12.5px Inter at 500 in ink 2, 14px top padding, 6px between groups.
- **Row:** 32px grid of grip (14px), type icon (16px), title, and a tabular count at 11px. 6px corners. Hover or focus-within turns the row white with a hairline lift; the grip appears. The current row takes the soft accent wash and accent text and icon.
- **Row controls:** Move up, move down, page break, remove, in 24px transparent-bordered buttons at the row's right, fading in over 120ms behind a 14px gradient from transparent to the row's background so the title is legible underneath. This gradient is functional masking, not decoration. Remove turns red on hover.
- **Drag:** A dragged row goes to 45% opacity; the drop target draws a 2px accent line above or below.
- **Page break:** A dashed line in line strong with a 10.5px uppercase tag between its halves.
- **Add section:** A full-width dashed line-strong button; hover turns border and text to the accent on white. Its menu opens upward.

### One command list (signature)
One list drives the selection toolbar, the right-click menu and the command palette. Each command has a label, a group (Format, Structure, Insert, Go to, Document), an optional shortcut and a condition; the three surfaces are filters on that list. The toolbar and the menu show only contextual commands that apply at the caret; the palette shows every applicable command and matches typed text against it. A shortcut is written the same way everywhere, as a plain `kbd` in chrome quiet at 11px, so a user who learns it in one surface reads it in the other two.

### Block controls (signature)
The proof-reader's marks. Each block on the sheet owns a 17mm strip of the right margin. On hover or focus-within, a vertical cluster of 24px white buttons (line-strong border, 5px corner, hairline lift) fades in at -16.5mm over 120ms: move up, move down, page break, remove. Only the innermost hovered block shows its cluster; pointing at the margin beside a section shows the section's. Hover turns a button's border and icon to the accent; remove turns red; an active toggle (page break on) takes the soft accent wash and accent border. Item-level controls are a single 19px remove button in a row 30px inboard of the block cluster. A word count sits at the block's bottom right in 10.5px tabular chrome quiet and turns amber at 600 when over the limit. An adder (dashed accent-ring border, 11px accent text) appears under a hovered block to add the next item.

### Editable runs
Every text run on the sheet is contenteditable with a 2px corner. Hover draws a 1px accent-ring outline; focus draws a 1.5px accent outline and a 4% accent wash. Empty runs show their placeholder in italic Inter at 0.9em in chrome quiet. The current block carries a 2px accent-ring bar 6mm into the left margin. At print, all of it is removed.

### Flags (chip)
Inline, cloned across line breaks: Inter 500 at 0.82rem, flag amber on flag cream, 0.2mm by 1.2mm padding, 0.6mm corners. Stored as `[[...]]` in the text, excluded from word counts, and printed as-is.

### Toast
Ink background, white 13px Inter at 500, 8px corners, panel shadow, centred 22px above the bottom edge, rising from below. An error toast is danger red.

### Quire mark (signature)
The one authored glyph: three nested folded sheets meeting at a rounded spine corner, standing on a baseline. A 24-unit viewBox, no fill, a 2.1 stroke with round caps and joins, in brand indigo through `currentColor`. It sits at 18px beside the ink wordmark in the toolbar, separated by a 7px gap, and at 40px above the empty-sheet start text. The favicon is the same mark in white at a 2.4 stroke on an indigo tile, 32 units square with a 7-unit corner, written as a data URI. The mark never takes the document accent and never appears on a control or on paper.

### Document mastheads (signature)
The CV masthead: a 16mm by 1.6pt accent bar, then the name in display, the credentials line in accent small caps, the tagline in ink 2 serif, and a right-aligned contact block in muted Inter, closed by a 0.5pt rule-strong hairline. The document masthead for the criteria response and letter: the same bar, the title in headline, a subtitle in muted Inter, the same contact column and the same closing hairline.

## Do's and Don'ts

### Do:
- **Do** write a colour once to `--accent` and let both stylesheets read it; the chrome shows it only on the active tab, focus ring, selection, primary action and current item.
- **Do** size everything inside the sheet in rem of `--base` and multiply every vertical gap by `--density`.
- **Do** set the author's words in the body serif and the tool's labels in Inter, at 400, 500 or 600 only.
- **Do** draw rules as hairlines: 0.5pt on the sheet, 1px in the chrome, in rule, rule strong, line or line strong.
- **Do** show a control on hover or focus-within, fading over 120ms, in the sheet's right margin at 16.5mm.
- **Do** mark anything unresolved in flag amber on flag cream, on screen and on paper.
- **Do** inline Phosphor regular icons as SVG at 16px in the toolbar, 15px in the rail, 14px on margin controls and 12px on grips and adders.
- **Do** rise floating surfaces over 160ms on `cubic-bezier(0.2, 0.8, 0.2, 1)` and remove them all at print.

### Don't:
- **Don't** use cards, ribbons, rulers or a floating page; the sheet is the only lifted surface at rest.
- **Don't** use a gradient for decoration; the only gradient is the 14px mask behind rail controls.
- **Don't** add a shadow to a button, input, tab or the toolbar; a hairline border bounds a flat control.
- **Don't** put a pixel size or a pixel gap inside the sheet, or let a chrome colour or font enter it.
- **Don't** add a second accent, a second warning colour or any OpenForte colour, font or mark; the brand indigo stays on the Quire mark and the favicon tile.
- **Don't** use disc bullets on the sheet; a bullet is a short horizontal stroke.
- **Don't** use Lucide or any icon set other than Phosphor, and don't ship an icon-only control without a `title` and `aria-label`.
- **Don't** write an em dash or an exclamation mark in any string, on the sheet or in the chrome.
