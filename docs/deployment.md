# Static application deployment

Boss Rehearsal's editor is a static browser application. Selecting a video in a hosted editor still processes it locally; deployment does not add an upload service, account system or shared lesson storage.

## Reproduce the build

Use Node.js 24 and the committed lockfile:

```sh
npm ci
npm run build
```

The command type-checks source, builds the independent trainer runtime, and emits the editor plus the committed original demo into `dist/`. It does not regenerate the demo or require FFmpeg/Chromium for this normal application build.

Use `npm run preview` to inspect that build locally before publication.

## Vercel configuration

The tracked `vercel.json` selects Vite, installs with `npm ci`, builds with `npm run build`, and publishes `dist/`. Keep the production source aligned with the reviewed GitHub `main` commit. No application API key or environment variable is required.

After an authorized deployment, verify the actual production address and source commit. Test the demo load, cue authoring, embedded practice view and trainer download at that address. A source build or configuration file alone is not evidence of a successful deployment.

Portable user lessons and trainers are separate from the hosted source. Do not add private recordings to `public/` or commit them to make a hosted lesson accessible.
