# Lesson, cue and scoring reference

This reference describes Boss Rehearsal 0.1.0. Types and pure scoring functions are exported by src/core.ts. There is no application HTTP API.

## Version-1 lesson

| Field         | Type and bounds                                               |
| ------------- | ------------------------------------------------------------- |
| version       | Exactly 1                                                     |
| name          | 1–120 readable characters                                     |
| description   | 0–800 readable characters                                     |
| videoName     | 1–160 readable characters                                     |
| videoDataUrl  | Optional embedded MP4/WebM data URL; remote URLs are rejected |
| cues          | 1–32 Cue objects                                              |
| leadInSeconds | Number from 0.25 to 10 seconds                                |
| playbackRate  | Number from 0.25 to 2                                         |

Validation copies supported data, trims text and discards unknown fields. Unsupported control characters are rejected. Embedded media must use matching MP4/WebM signatures and valid base64 with a decoded size at most **80 MiB**.

The optional duration argument to validateLesson must be positive, finite and no more than six hours. When provided, every cue must occur strictly before that duration. A metadata-only lesson without videoDataUrl is valid data but is not a self-contained trainer; HTML export requires embedded video.

The editor limits imported lesson JSON to 112 MiB. Video inclusion is selected by default when saving; clearing it creates metadata-only JSON that requires reloading the source clip before practice.

## Cue

| Field         | Type and bounds                                                                    |
| ------------- | ---------------------------------------------------------------------------------- |
| id            | Unique 1–48-character ID containing letters, numbers, underscores or dashes        |
| title         | 1–80 readable characters                                                           |
| time          | Video time in seconds, from 0 to 21,600; strictly before a supplied media duration |
| expectedInput | One supported control code                                                         |
| mode          | decision or timing                                                                 |
| targetDelayMs | Integer from 0 to 5,000 milliseconds                                               |
| toleranceMs   | Integer from 20 to 2,000 milliseconds                                              |

Timing fields remain present and validated for a decision cue, but the decision's success depends on the correct input rather than its timing window.

Supported keyboard codes are **ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Space, KeyA–KeyZ, Digit0–Digit9**. They are KeyboardEvent.code values, so they identify physical key positions rather than translated character strings. Gamepad codes are **Gamepad0–Gamepad15**, representing browser-reported standard button indices. Axis movement is not an answer code.

## Timing and scoring

Cue time belongs to the video timeline. Response latency begins only after the cue has frozen and the player confirms the displayed frame. It is elapsed browser time and does not scale with video playback speed.

scoreResponse returns:

| Field        | Meaning                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| correctInput | The new input code equals expectedInput                                       |
| latencyMs    | Nonnegative elapsed response time in milliseconds                             |
| deltaMs      | latencyMs minus targetDelayMs; negative is early, positive is late            |
| withinWindow | Absolute delta is less than or equal to toleranceMs                           |
| success      | Correct input in decision mode; correct input and withinWindow in timing mode |

Window boundaries are inclusive. Decision accuracy and timing-window success are separate statistics; a fast wrong control is still a wrong control.

The player confirms current decoded data near the sought cue and gives it a paint opportunity before arming the performance clock. Display, decode, polling and device delays still affect the browser estimate; it is not a hardware-calibrated response measurement.

Keyboard repeat and already-held gamepad controls do not create new answers. Media preparation and interrupted attempts do not become latency samples.

Only standard-mapped gamepads are polled. Buttons 0–15 count as down when pressed or above 0.5 value; a rising edge requires a prior unpressed observation, so attaching a pad with a held button does not create an answer. The first fresh supported input while armed records the trial.

## Player phases and transitions

| Phase       | Behavior                                                                           |
| ----------- | ---------------------------------------------------------------------------------- |
| loading     | Decode embedded media and validate its finite duration/cue bounds.                 |
| ready       | Wait for release checks and Start session.                                         |
| lead-in     | Seek to max(0, cue time minus lead-in), play, then prepare the frozen cue.         |
| armed       | Cue frame is paused/ready; a fresh response can be scored.                         |
| feedback    | Keep the recorded answer or skip visible; require manual Next cue or View summary. |
| interrupted | Active attempt is unscored; Resume trial retries the same cue once ready.          |
| summary     | Show the separate metrics and recorded trial rows.                                 |

During active lead-in/armed phases, focus loss, tab hiding, external media seeking/pause, unexpected play, early media end or media failure interrupts the attempt. Internal seeks and pauses used to prepare a cue are distinguished from those external changes. Restart session discards results and returns to ready; closing the player removes its session state.

## Trial result

A TrialResult contains:

- **cueId, cueTitle, mode, expectedInput:** the authored cue identity and condition.
- **input:** the response code, or null for a skip.
- **latencyMs, deltaMs:** response values, or null for a skip.
- **correctInput, withinWindow, success:** recorded outcome flags.
- **skipped:** whether the user explicitly skipped the cue.

Interrupted attempts do not enter the scored result list. A retry therefore cannot silently add a failure or latency observation just because focus or media readiness was lost.

## Session summary

| Field                    | Meaning                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| total                    | Number of recorded answered or skipped trials                              |
| answered                 | Trials that were not skipped                                               |
| skipped                  | Explicitly skipped trials                                                  |
| decision.attempts        | Answered decision-mode trials                                              |
| decision.correct         | Correct decision inputs                                                    |
| decision.accuracy        | Correct/attempts ratio, or null with no decision attempts                  |
| decision.medianLatencyMs | Median of finite, nonnegative correct decision-response latencies, or null |
| timing.attempts          | Answered timing-mode trials                                                |
| timing.successful        | Timing trials with success true                                            |
| timing.successRate       | Successful/attempts ratio, or null with no timing attempts                 |

Ratios such as 0.75 represent 75%; they are not already percentages. Skips are excluded from the accuracy/rate denominators. Timing latencies and incorrect decision latencies do not enter the median decision statistic.

## Session JSON envelope

Save results writes **boss-rehearsal-session.json** with these fields:

| Field                       | Meaning                                                |
| --------------------------- | ------------------------------------------------------ |
| version                     | 1                                                      |
| lessonName, videoName       | Authored identifiers, not embedded video               |
| sessionStartedAt            | ISO timestamp when Start session was chosen            |
| savedAt                     | ISO timestamp when the result file was created         |
| shuffled, seed              | Whether shuffling was selected and its numeric seed    |
| playbackRate, leadInSeconds | Session playback context                               |
| cueOrder                    | Full planned array of cue IDs                          |
| results                     | Recorded TrialResult array so far                      |
| summary                     | SessionSummary for those recorded results              |
| note                        | Scope statement identifying browser-measured estimates |

The envelope can describe a partial session. It does not embed the source recording or count interrupted attempts. Timestamps come from the browser clock; response latency uses performance timing.

These metrics describe the authored drill. They do not establish in-game benefit or a general skill assessment.

## Core exports

| Function                                | Result                                            |
| --------------------------------------- | ------------------------------------------------- |
| validateLesson(value, duration?)        | Copied Lesson, or a readable validation Error     |
| inputLabel(input)                       | Human-readable label for a supported code         |
| scoreResponse(cue, input, latencyMs)    | ResponseScore                                     |
| shuffledCues(cues, seed)                | Copied cue records in a seeded Fisher–Yates order |
| summarize(results)                      | SessionSummary                                    |
| sampleLesson()                          | Metadata and cues for the original synthetic demo |
| exportLessonHtml(lesson, runtimeScript) | Self-contained trainer HTML                       |

shuffledCues accepts a finite numeric seed and does not mutate the supplied array or cue records. The lesson's authored cue list and a practice-session order are distinct.

sampleLesson does not itself contain embedded video data; the editor loads the included original clip. The sample has two decision cues at 2 and 4 seconds expecting ArrowLeft and ArrowRight, and one timing cue at 6 seconds expecting Space with a 350 ms target and 150 ms tolerance. Its lead-in is 1.25 seconds and playback rate 0.75.

## Export boundary

HTML export requires embedded video and a trusted built runtime string between a nontrivial minimum and 4 × 1024 × 1024 characters. The runtime is a build artifact, not an imported lesson field. Authored text is escaped for JSON/HTML embedding.

A portable file may contain the entire original recording. Base64 makes its encoded size larger than the media file itself. The optional localhost helper accepts one HTML file up to 128 MiB and serves only that selected file.

Keep a copy of your original lesson when trying a later application version. A change to cue or scoring semantics should be reviewed with the saved format, not hidden as a presentation-only change.
