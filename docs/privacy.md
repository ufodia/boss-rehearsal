# Privacy and portable video

Boss Rehearsal processes videos, cues and practice input in your browser. It has no application upload endpoint, account system or cloud-analysis service.

## Local processing

Selecting a clip lets the browser decode it locally. The player uses authored cues and keyboard/gamepad input; it does not inspect a game process, read a game account or send the recording to a model service.

Loading a clip does not start microphone capture. The tool does not record a new camera or microphone stream. An imported video can already contain audio; that content belongs to the file you selected.

## Files can contain the original recording

Portable lesson JSON and exported trainer HTML may embed the original video. That video can contain voice, chat, usernames, private overlays, notifications or other identifying content. Embedding does not redact it.

The trainer starts muted, but muting is playback behavior rather than removal of an audio track from the embedded recording. Metadata-only lesson saves omit video when you explicitly clear the inclusion option; standalone trainer export always embeds it.

Before sharing a lesson or trainer, review the actual clip and authored text. Only distribute recordings you have permission to share. Avoid placing private exports into the public source repository.

Session JSON is separate drill evidence and does not embed the video. It includes lesson/video names, cue titles and codes, browser timestamps, queue settings, responses and summary measures. Inspect those authored identifiers before sharing a result publicly.

## Save deliberately

Unsaved editor and session state is not a backup. Save a lesson when you want to continue authoring, and export session JSON when you want to retain results. Store those files in your own chosen backup location.

The GitHub repository contains application source and the original synthetic demo; it does not back up your selected recordings or private practice data.

Installing dependencies contacts npm; visiting GitHub, a hosted application page or Buy Me a Coffee contacts those services. Those visits are separate from local video decoding and scoring.

Use synthetic examples for public issue reports where possible. Follow [SECURITY.md](../SECURITY.md) for sensitive implementation findings.
