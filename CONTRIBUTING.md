# Contributing

Quire is a personal project, open to issues and pull requests. Read `PRODUCT.md` for what it is
for, `DESIGN.md` for the visual system and `CLAUDE.md` for how the code is organised.

## Before you start

Open an issue first for anything that changes behaviour. A pull request that adds a feature
nobody agreed to is a pull request that gets closed.

Keep the shape of the product: one offline file, no server, no account, no telemetry.

## The workflow

`main` is protected. Nobody pushes to it, including the owner. Every change lands as a pull
request, reviewed and merged by the owner with a rebase merge.

Install poppler-utils first. The browser suite reads the printed PDF with `pdfinfo` and
`pdftotext`, and skips nothing when they are absent: it fails.

```sh
git switch -c <topic>
npm install
npm run dev        # Vite dev server
npm test           # the gate: typecheck, unit, build, drift, browser. About a minute.
npm run build      # rebuild dist/index.html before you commit a src/ change
git push -u origin <topic>
gh pr create
```

CI runs the same gate on the pull request. A red gate blocks the merge.

## The rules

- **Write the test first.** A bugfix starts with a test that reproduces the bug. Run it, watch
  it fail, then fix it.
- **Rebuild `dist/index.html`.** It is committed. `npm run check` fails when it differs from a
  fresh build.
- **Keep the gate at about a minute.** One test for each behaviour a user notices. Do not add
  tests for coverage.
- **Obey `DESIGN.md`.** One accent, one brand indigo on the mark alone, Phosphor icons, no em
  dash and no exclamation mark in any string.
- **Commit no personal data.** The seed is fictional. A real application lives outside this
  repository.
- **Australian English** in code, comments, commits and documents.

## Commit messages

One line, imperative, under 72 characters. Say what the change does, not what you did.

```
Flag the word at the caret when the selection is empty
```

## Reporting a vulnerability

Read `SECURITY.md`. Do not open a public issue.
