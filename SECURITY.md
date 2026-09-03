# Security

## Report a vulnerability

Do not open a public issue. Use
[private vulnerability reporting](https://github.com/mjgardner87/Quire/security/advisories/new).
A report gets a first reply within 7 days. A confirmed fix ships in `dist/index.html` and the
advisory is published with it.

Include the browser and version, the steps that reproduce the fault, and the effect. Reproduce
the fault on the sample workspace. Do not attach a real application.

## What is supported

Only the latest commit on `main`, and the `dist/index.html` built from it. Earlier builds get no
fixes. A user updates by downloading the file again.

## How Quire handles data

- Quire is one HTML file. It has no server, no account and no network calls at runtime.
- Fonts load from Google Fonts. The page works without them and falls back to installed fonts.
- Documents stay in the browser under a key that includes the file path, and in the `.quire.json`
  file the author saves. Nothing leaves the machine.
- The repository holds no personal data. `src/seed.json` is a fictional sample.

## Threat model

A workspace file is untrusted input. The renderer writes document text through `textContent`
only, so text in a `.quire.json` file cannot become markup or script. Report any path that
breaks that rule.

An attacker who can write to the repository can ship a modified `dist/index.html` to every
person who downloads it. The branch protection on `main`, the required gate and the pinned
action versions defend that path. Report any way around them.

## Out of scope

- A person who already controls the machine, the browser profile or the downloaded file.
- Denial of service through a very large workspace file.
- Findings from an automated scanner with no working proof.
