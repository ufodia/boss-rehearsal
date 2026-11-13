# Verify authoring and practice behavior

This guide describes Boss Rehearsal 0.1.0 checks. Automated fixtures and mocked input edges do not prove every physical controller or media codec works.

## Install and verify source

Use Node.js 24 LTS:

```sh
npm ci
npm run verify
```

The verification command combines type checking, unit tests and the complete build, including the independent-player runtime.

## Run browser workflows

```sh
npx playwright install --no-shell chromium
npm run test:e2e
```

The suite uses full Chromium. Linux CI installs OS browser dependencies with `npx playwright install --with-deps --no-shell chromium`.

## Verification map

| Area              | Meaningful checks                                                          |
| ----------------- | -------------------------------------------------------------------------- |
| Lesson validation | Supported schema, cue references, numeric bounds and safe authored text    |
| Media readiness   | Seek/decode confirmation before response timing                            |
| Input edges       | Nonrepeating keys, fresh gamepad edges and rejection of held controls      |
| Attempt state     | Feedback/manual next, skip separation and interrupted-attempt retry        |
| Scoring           | Separate decision/timing denominators and median of correct decisions only |
| Portability       | Save/reopen lesson and embedded trainer using original synthetic media     |
| Workspace         | Cue editing, practice settings, downloads and readable failure feedback    |

Use the original synthetic demo or a minimal generated recording for reproducible tests. Do not add private gameplay clips as fixtures.

## Manual checks

1. Load an intended MP4/WebM codec and verify playback, seeking and cue freezing.
2. Hold a key through a cue transition and verify it does not answer the next attempt.
3. Connect your intended physical controller, identify its mapping and test release/new-press behavior.
4. Change focus, hide the tab, pause and seek during preparation/response; confirm interruption is unscored.
5. Resume and retry the cue, then inspect individual feedback and session JSON.
6. Open the exported trainer in the recipient's intended browser.

Report the actual browser, platform, codec and input path with verification evidence. These tests describe the authored drill; they do not measure transfer into game performance.
