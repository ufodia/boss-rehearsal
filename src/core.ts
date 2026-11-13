export interface Cue {
  id: string;
  title: string;
  time: number;
  expectedInput: string;
  mode: 'decision' | 'timing';
  targetDelayMs: number;
  toleranceMs: number;
}
export interface Lesson {
  version: 1;
  name: string;
  description: string;
  videoName: string;
  videoDataUrl?: string;
  cues: Cue[];
  leadInSeconds: number;
  playbackRate: number;
}
export interface ResponseScore {
  correctInput: boolean;
  withinWindow: boolean;
  success: boolean;
  deltaMs: number;
  latencyMs: number;
}
export interface TrialResult {
  cueId: string;
  cueTitle: string;
  mode: Cue['mode'];
  expectedInput: string;
  input: string | null;
  latencyMs: number | null;
  deltaMs: number | null;
  correctInput: boolean;
  withinWindow: boolean;
  success: boolean;
  skipped: boolean;
}
export interface SessionSummary {
  total: number;
  answered: number;
  skipped: number;
  decision: {
    attempts: number;
    correct: number;
    accuracy: number | null;
    medianLatencyMs: number | null;
  };
  timing: { attempts: number; successful: number; successRate: number | null };
}

export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const INPUT = /^(?:Arrow(?:Up|Down|Left|Right)|Space|Key[A-Z]|Digit[0-9]|Gamepad(?:[0-9]|1[0-5]))$/;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

function text(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (!allowEmpty && !value.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw new Error(`${label} must contain ${allowEmpty ? '0' : '1'}–${max} readable characters.`);
  return value.trim();
}

/** Imported media stays data, never a remote URL, an HTML document or user code. */
export function validateLesson(value: unknown, duration?: number): Lesson {
  if (!object(value) || value.version !== 1)
    throw new Error('Choose a Boss Rehearsal version 1 lesson.');
  if (duration !== undefined && (!finite(duration) || duration <= 0 || duration > 21600))
    throw new Error('Use a video with a known, positive duration no longer than six hours.');
  if (!Array.isArray(value.cues) || value.cues.length < 1 || value.cues.length > 32)
    throw new Error('A lesson needs 1–32 cues.');
  const ids = new Set<string>();
  const cues = value.cues.map((raw: unknown): Cue => {
    if (!object(raw)) throw new Error('Every cue must be an object.');
    const id = text(raw.id, 'Cue id', 48);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id))
      throw new Error('Cue ids must be unique letters, numbers, dashes or underscores.');
    ids.add(id);
    if (
      !finite(raw.time) ||
      raw.time < 0 ||
      raw.time > 21600 ||
      (duration !== undefined && raw.time >= duration)
    )
      throw new Error(
        'Every cue must be between zero and six hours, and before the loaded video ends.',
      );
    if (typeof raw.expectedInput !== 'string' || !INPUT.test(raw.expectedInput))
      throw new Error('Choose an arrow, Space, A–Z, 0–9, or standard gamepad button 0–15.');
    if (raw.mode !== 'decision' && raw.mode !== 'timing')
      throw new Error('Choose decision or timing mode.');
    if (
      !finite(raw.targetDelayMs) ||
      !Number.isInteger(raw.targetDelayMs) ||
      raw.targetDelayMs < 0 ||
      raw.targetDelayMs > 5000
    )
      throw new Error('Target delay must be a whole number from 0 to 5,000 ms.');
    if (
      !finite(raw.toleranceMs) ||
      !Number.isInteger(raw.toleranceMs) ||
      raw.toleranceMs < 20 ||
      raw.toleranceMs > 2000
    )
      throw new Error('Tolerance must be a whole number from 20 to 2,000 ms.');
    return {
      id,
      title: text(raw.title, 'Cue title', 80),
      time: raw.time,
      expectedInput: raw.expectedInput,
      mode: raw.mode,
      targetDelayMs: raw.targetDelayMs,
      toleranceMs: raw.toleranceMs,
    };
  });
  if (!finite(value.leadInSeconds) || value.leadInSeconds < 0.25 || value.leadInSeconds > 10)
    throw new Error('Lead-in must be between 0.25 and 10 seconds.');
  if (!finite(value.playbackRate) || value.playbackRate < 0.25 || value.playbackRate > 2)
    throw new Error('Playback rate must be between 0.25× and 2×.');
  const lesson: Lesson = {
    version: 1,
    name: text(value.name, 'Lesson name', 120),
    description: text(value.description, 'Lesson description', 800, true),
    videoName: text(value.videoName, 'Video name', 160),
    cues,
    leadInSeconds: value.leadInSeconds,
    playbackRate: value.playbackRate,
  };
  if (value.videoDataUrl !== undefined) {
    const raw = value.videoDataUrl;
    const maxCharacters = 4 * Math.ceil(MAX_VIDEO_BYTES / 3) + 100;
    if (
      typeof raw !== 'string' ||
      raw.length > maxCharacters ||
      !/^data:video\/(?:mp4|webm);base64,[A-Za-z0-9+/]+={0,2}$/.test(raw)
    )
      throw new Error(
        'Embed an MP4 or WebM video no larger than 80 MiB. Remote media URLs are not supported.',
      );
    const comma = raw.indexOf(',');
    const data = raw.slice(comma + 1);
    const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
    if (data.length % 4 !== 0 || (data.length / 4) * 3 - padding > MAX_VIDEO_BYTES)
      throw new Error('The embedded video is malformed or larger than 80 MiB.');
    let signature = '';
    try {
      signature = atob(data.slice(0, 32));
    } catch {
      throw new Error('The embedded video is malformed.');
    }
    if (
      raw.startsWith('data:video/webm')
        ? !signature.startsWith('\x1a\x45\xdf\xa3')
        : signature.slice(4, 8) !== 'ftyp'
    )
      throw new Error('The embedded media does not match its declared MP4 or WebM format.');
    lesson.videoDataUrl = raw;
  }
  return lesson;
}

export function inputLabel(input: string): string {
  const arrows: Record<string, string> = {
    ArrowUp: '↑ Up',
    ArrowDown: '↓ Down',
    ArrowLeft: '← Left',
    ArrowRight: '→ Right',
    Space: 'Space',
  };
  if (Object.hasOwn(arrows, input)) return arrows[input]!;
  if (/^Key[A-Z]$/.test(input)) return input.slice(3);
  if (/^Digit[0-9]$/.test(input)) return input.slice(5);
  if (/^Gamepad(?:[0-9]|1[0-5])$/.test(input)) return `Gamepad button ${input.slice(7)}`;
  return 'Unsupported input';
}

/** Delays are elapsed browser milliseconds, independent of video playback speed. */
export function scoreResponse(cue: Cue, input: string, latencyMs: number): ResponseScore {
  if (
    !finite(latencyMs) ||
    latencyMs < 0 ||
    !finite(cue.targetDelayMs) ||
    !finite(cue.toleranceMs) ||
    cue.toleranceMs < 0
  )
    throw new Error('Response time and timing settings must be finite, non-negative milliseconds.');
  const correctInput = input === cue.expectedInput;
  const deltaMs = latencyMs - cue.targetDelayMs;
  const withinWindow = Math.abs(deltaMs) <= cue.toleranceMs;
  return {
    correctInput,
    withinWindow,
    success: correctInput && (cue.mode === 'decision' || withinWindow),
    deltaMs,
    latencyMs,
  };
}

/** A seeded Fisher–Yates shuffle; copies both the array and its cue records. */
export function shuffledCues(cues: Cue[], seed: number): Cue[] {
  if (!finite(seed)) throw new Error('Shuffle seed must be a finite number.');
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
  const result = cues.map((cue) => ({ ...cue }));
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Interrupted trials never enter this list. Skips are excluded from accuracy. */
export function summarize(results: TrialResult[]): SessionSummary {
  const answered = results.filter((result) => !result.skipped);
  const decisions = answered.filter((result) => result.mode === 'decision');
  const timing = answered.filter((result) => result.mode === 'timing');
  const correctDecisions = decisions.filter((result) => result.correctInput);
  const latencies = correctDecisions
    .map((result) => result.latencyMs)
    .filter((value): value is number => finite(value) && value >= 0)
    .sort((a, b) => a - b);
  const middle = Math.floor(latencies.length / 2);
  const medianLatencyMs = latencies.length
    ? latencies.length % 2
      ? latencies[middle]!
      : (latencies[middle - 1]! + latencies[middle]!) / 2
    : null;
  return {
    total: results.length,
    answered: answered.length,
    skipped: results.length - answered.length,
    decision: {
      attempts: decisions.length,
      correct: correctDecisions.length,
      accuracy: decisions.length ? correctDecisions.length / decisions.length : null,
      medianLatencyMs,
    },
    timing: {
      attempts: timing.length,
      successful: timing.filter((result) => result.success).length,
      successRate: timing.length
        ? timing.filter((result) => result.success).length / timing.length
        : null,
    },
  };
}

export function sampleLesson(): Lesson {
  return {
    version: 1,
    name: 'Read the tell',
    description:
      'Three cues from an original practice animation. Read the direction, choose your response, then rehearse one precise timing window.',
    videoName: 'training.webm',
    leadInSeconds: 1.25,
    playbackRate: 0.75,
    cues: [
      {
        id: 'left-sweep',
        title: 'Left sweep',
        time: 2,
        expectedInput: 'ArrowLeft',
        mode: 'decision',
        targetDelayMs: 0,
        toleranceMs: 150,
      },
      {
        id: 'right-sweep',
        title: 'Right sweep',
        time: 4,
        expectedInput: 'ArrowRight',
        mode: 'decision',
        targetDelayMs: 0,
        toleranceMs: 150,
      },
      {
        id: 'core-flash',
        title: 'Core flash',
        time: 6,
        expectedInput: 'Space',
        mode: 'timing',
        targetDelayMs: 350,
        toleranceMs: 150,
      },
    ],
  };
}

export function exportLessonHtml(input: Lesson, runtimeScript: string): string {
  const lesson = validateLesson(input);
  if (!lesson.videoDataUrl)
    throw new Error('Embed the local video before exporting a standalone lesson.');
  if (
    typeof runtimeScript !== 'string' ||
    runtimeScript.trim().length < 10 ||
    runtimeScript.length > 4 * 1024 * 1024
  )
    throw new Error('The standalone player bundle is unavailable. Rebuild the app and try again.');
  const json = JSON.stringify(lesson)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const runtime = runtimeScript.replace(/<\/script/gi, '<\\/script');
  const notice = `MIT License\n\nCopyright (c) 2026 ufodia\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeHtml(lesson.name)} — Boss Rehearsal</title></head><body><main id="boss-player"><noscript>This local practice lesson needs JavaScript. Its embedded video stays on this device.</noscript></main><script id="boss-lesson" type="application/json">${json}</script><script>${runtime}</script><footer style="max-width:1200px;margin:20px auto;padding:20px;color:#a6a9b9;font:12px system-ui,sans-serif"><p>Boss Rehearsal · Copyright (c) 2026 ufodia · Browser-measured practice estimates are not a measure of in-game skill.</p><details><summary>MIT License</summary><pre style="white-space:pre-wrap">${escapeHtml(notice)}</pre></details></footer></body></html>`;
}
