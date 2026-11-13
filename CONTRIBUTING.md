# Contributing to Boss Rehearsal

Focused cue-state reproductions, media-handling fixes, input edge cases and clearer authoring workflows are welcome.

## Set up locally

Use Node.js 24 LTS:

```sh
npm ci
npm run dev
```

Read [the architecture](docs/architecture.md) before changing media timing or input handling and [the scoring reference](docs/reference.md) before changing session results.

## Report a reproducible problem

Include the source commit, browser/platform, input path, exact steps and a minimal lesson. For a media issue, include codec information and prefer the original synthetic demo or a generated minimal file over private footage.

Do not attach private recordings or exported files without reviewing their contents. Follow [SECURITY.md](SECURITY.md) for vulnerabilities.

## Preserve the timing contract

- Start response timing only after the cue frame is frozen and confirmed ready.
- Treat fresh presses and gamepad edges as answers; reject repeated/held carryover.
- Keep skips and interrupted attempts separate from scored answers.
- Preserve manual feedback advancement and resume/retry behavior.
- Keep decision and timing metrics distinct; median latency uses correct decisions only.
- Escape lesson text and preserve the independent-player build.

Add a focused regression test for behavior you change. Document saved-format or scoring changes before making them the default. Keep all project content in English.

Do not commit private recordings, credentials, dependency folders, generated runtime or build output. Only include media you have permission to redistribute; retain required attribution for third-party material.

## Verify and submit

```sh
npm run verify
npx playwright install --no-shell chromium
npm run test:e2e
```

State the checks you actually ran and the hardware/codec conditions you did not verify. Use the pull-request template to describe the concrete behavior and its evidence. Contributions use the repository's [MIT license](LICENSE) and [code of conduct](CODE_OF_CONDUCT.md).
