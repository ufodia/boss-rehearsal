# Build and run a video practice drill

This guide describes Boss Rehearsal 0.1.0. Start with the included synthetic clip, then use your own recording once you understand the cue and score model.

## Open the editor

With Node.js 24 LTS installed:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. The startup command builds the independent trainer runtime before serving the editor.

## Explore the included drill

The original demo loads automatically; choose **Load sample** to restore it later. Inspect its cue sheet, choose **Start practice**, then wait for **Start session** to become available. Leave **Shuffle cues this session** unchecked for the first run:

1. Choose **Start session** and watch the lead-in for **Left sweep**. When the phase is **ARMED** and the picture is frozen, press the Left arrow once.
2. Release the key, inspect feedback and choose **Next cue**. Respond to **Right sweep** with the Right arrow.
3. Continue to **Core flash**. Press Space near its authored 350 ms target after the cue is ready; its tolerance is ±150 ms.
4. After feedback, choose **View summary** and inspect the separate decision/timing measures.

The original eight-second demo makes the workflow reproducible without distributing copyrighted gameplay. It is a controlled illustration, not evidence of improvement in a particular game.

## Bring your own clip

Choose **Upload video** and select a local MP4 or WebM up to 80 MiB. Wait for the browser to read its finite duration, up to six hours. An accepted extension does not guarantee that the browser can decode every codec inside it; try a supported encoding if the media fails to load.

Replacing a clip keeps the current cue definitions. If a shorter clip makes a cue out of range, adjust or remove that cue before practice/export becomes available again.

Use a short clip with the visual context needed for your cues. Long lead-ins and unrelated material make a drill harder to inspect and produce larger portable files.

No file is uploaded to an application service. A portable lesson or trainer can embed the clip, so inspect it for private content before sharing.

## Author a cue

For each cue, choose:

- A short title identifying the tell or decision.
- The video time where the cue should freeze.
- The expected keyboard or gamepad control.
- Decision or timing mode.
- For timing mode, the target delay after the ready cue and the allowed tolerance.

Scrub the editor video or use **Playhead in seconds**, then choose **Add cue at playhead**. Select a cue in **Your cue sheet** to edit it. Timeline markers seek to their cue; the cue-sheet rows select their settings. A lesson keeps 1–32 cues.

Use **Expected input** to choose a supported keyboard code or standard gamepad button. **Record a keyboard input** records the next supported physical key code; Escape cancels. Gamepad inputs are chosen from the menu. **Practice mode** selects decision or timing behavior; **Target delay** and **Tolerance** are editable for timing mode.

The cue time belongs to the video timeline. The response clock belongs to the ready, frozen drill; they are different measurements. Under **The run-up**, set **Lead-in** from 0.25–10 seconds and **Playback speed** from 0.25×–2×.

### Decision mode

Decision mode asks whether the newly pressed control matches the expected input. Review decision accuracy independently of timing results. Correct decision responses contribute to the median decision-latency statistic.

### Timing mode

Timing mode asks for the expected input within the authored delay window after the cue becomes ready. An early, late or different control has a different meaning from a skipped cue. The timing target is your lesson annotation, not an automatically extracted in-game timing model.

## Rehearse

Choose **Start practice** to open the trainer. Select **Shuffle cues this session** if you want a randomized queue; otherwise the lesson's cue-array order is used, which need not be chronological video order. Release all supported controls and choose **Start session**. Each attempt follows these states:

1. Load and seek the clip to its lead-in.
2. Play toward the cue.
3. Pause at the cue and confirm the displayed frame.
4. Start the response clock and wait for a fresh input.
5. Show feedback.
6. Wait for your manual next action.

Do not hold a control before **ARMED**. Repeated keyboard events and already-held gamepad controls do not answer the next cue. Release all supported keys/buttons before starting, resuming or continuing. The first fresh supported response while armed records the attempt, including a wrong input.

The trainer uses only gamepads with the browser's **standard** mapping and buttons 0–15. Press and release a button once if the browser has not exposed the device yet. Axis movement is not an answer input.

Choose **Skip cue** during preparation/lead-in or the armed response state when you do not want to answer it. Skips remain separate from decision accuracy and timing-window results. After any answer or skip, choose **Next cue**, or **View summary** for the last cue; nothing advances automatically.

## Interrupt safely

During lead-in or **ARMED**, **Pause trial**, focus loss, a hidden tab, external seeking/pause, unexpected playback, an early video end or a media error interrupts the active attempt without scoring it. **Resume trial** retries that same cue from its lead-in after media readiness and release checks. Already recorded results remain recorded.

**Restart session** discards the current result list and returns to the ready state, where you can choose the order and start again. Use **Save results** first if you want to keep the current record. Closing practice removes that player session; it is not an automatic save.

If the frame cannot become ready, resolve the media problem first. Waiting or seeking is not response time.

## Save the lesson and results

Choose **Save lesson** to retain annotations. **Include video when saving the lesson** is selected by default; keep it selected for portable JSON with embedded media. If you clear it, the JSON contains metadata only. **Open lesson** can reopen either form, but metadata-only lessons need you to reload the named clip and verify its cue times. Imported JSON may be up to 112 MiB.

Choose **Download trainer** for an independent HTML player with embedded runtime and video. This requires loaded, readable video and valid cue times even if you prefer metadata-only lesson saves.

Choose **Save results** in the player once at least one answer or skip has been recorded. You can save a partial session; the file contains the full planned cue order and only results recorded so far. It records that session's drill evidence, not a general assessment of game skill. Save before leaving the page; unsaved editor/session state is not a backup.

### Open an exported trainer through localhost

The trainer embeds its media and does not need an application server. If the recipient's browser works better with a local HTTP address, the repository includes a helper that serves only the chosen HTML file:

```sh
npm run serve:player -- "path/to/trainer.html"
```

Replace the path with the actual exported file and open `http://127.0.0.1:4180/`, or the printed address. It accepts HTML files up to 128 MiB and does not provide uploads or a directory listing. Stop it with Ctrl+C.

Supply a second positional argument to choose another port:

```sh
npm run serve:player -- "path/to/trainer.html" 4181
```

## Troubleshooting

| Symptom                                             | Check                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Video does not load                                 | Check file size, MP4/WebM encoding and browser codec support. Use the included demo to isolate an application problem. |
| A cue is outside the clip                           | Wait for metadata and keep cue times within the actual video duration.                                                 |
| The drill does not accept a held key                | Release it and make a fresh press after the cue is ready; key repeat is intentionally ignored.                         |
| A held gamepad button does not answer               | Release it, then press it again in the response state.                                                                 |
| The attempt becomes interrupted                     | Restore focus/visibility, stop seeking and resume to retry the cue. Interrupted attempts are unscored.                 |
| Timing results look unexpected                      | Check target delay, tolerance, playback rate and whether you are responding after the cue-ready state.                 |
| A portable file is large                            | Embedded video is the dominant content; JSON encoding can make the file larger than the original clip.                 |
| An exported trainer lacks the latest player changes | Rebuild through the normal dev/build workflow so the tracked player source regenerates its runtime.                    |

For reproducible bugs, use a minimal synthetic lesson and see [CONTRIBUTING.md](../CONTRIBUTING.md).
