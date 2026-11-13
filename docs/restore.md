# Restore Boss Rehearsal from GitHub

The repository contains the editor, player source, original synthetic demo and its generator, dependency lockfile, non-secret configuration, tests and documentation. User lessons and session files are separate local data.

## Fresh setup

Install Git and Node.js 24 LTS, then run:

```sh
git clone https://github.com/ufodia/boss-rehearsal.git
cd boss-rehearsal
git switch main
git pull --ff-only origin main
git rev-parse HEAD
npm ci
npm run verify
npm run dev
```

Record the source SHA when you need an exact version. Open the printed local address and load your saved lesson through the editor.

For the static application's Vercel build, see [deployment.md](deployment.md). A hosted editor still keeps selected user video processing in the browser.

## Generated runtime

The standalone-player runtime is intentionally ignored by Git. Normal dev/build commands regenerate it from tracked source and build scripts. Do not copy stale runtime output from another checkout.

Use the committed dependency lockfile. If the build fails, inspect the actual error and rerun the documented setup rather than substituting an unrelated runtime or CDN script.

## Original demo source

The committed `public/demo/training.webm` is ready for normal builds. You do not need FFmpeg or demo regeneration to run the application.

If you intentionally change the demo, install the project's Chromium browser and use `npm run generate:demo`. Its generator renders 240 original vector-animation frames at exact 30 fps timestamps through Chromium, then encodes an eight-second VP9 WebM with FFmpeg. The encoder needs the image2pipe/MJPEG input and libvpx-vp9 output codecs. You can provide a specific FFmpeg executable as the command's argument or through `BOSS_FFMPEG_PATH`.

Encoding must succeed before the script replaces the committed demonstration asset. On failure, it retains the generated frames in a run-specific `test-results/demo-frames-*` directory. Verify the new clip's finite eight-second duration and seeking, rerun browser tests, then commit the reviewed asset with its generator changes.

## Update an existing checkout

Inspect git status and preserve local changes first. With a clean checkout on main, update using a normal fast-forward pull from origin/main, install from the lockfile and rerun verification.

Restore private lesson/session files from your own backup. Browser codec and physical gamepad compatibility should be checked again on a replacement computer.
