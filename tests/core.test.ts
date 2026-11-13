import { describe, expect, it } from 'vitest';
import {
  exportLessonHtml,
  inputLabel,
  sampleLesson,
  scoreResponse,
  shuffledCues,
  summarize,
  validateLesson,
  type Cue,
  type Lesson,
  type TrialResult,
} from '../src/core';

const webm = 'data:video/webm;base64,GkXfowAAAAA=';
const mp4 = 'data:video/mp4;base64,AAAAGGZ0eXBpc29tAAAAAA==';
const timing = (): Cue => ({
  id: 'cue',
  title: 'Cue',
  time: 1,
  expectedInput: 'Space',
  mode: 'timing',
  targetDelayMs: 350,
  toleranceMs: 100,
});

describe('lesson boundaries and local media', () => {
  it('validates and copies the original sample metadata', () => {
    const sample = sampleLesson();
    const copy = validateLesson({ ...sample, userCode: 'alert(1)' }, 8);
    expect(copy.cues.map((cue) => cue.time)).toEqual([2, 4, 6]);
    expect(copy).not.toHaveProperty('userCode');
    expect(copy.cues).not.toBe(sample.cues);
    expect(copy.videoDataUrl).toBeUndefined();
  });
  it('accepts matching WebM and MP4 signatures', () => {
    expect(validateLesson({ ...sampleLesson(), videoDataUrl: webm }).videoDataUrl).toBe(webm);
    expect(validateLesson({ ...sampleLesson(), videoDataUrl: mp4 }).videoDataUrl).toBe(mp4);
  });
  it.each([
    (p: Lesson) => ({ ...p, cues: [] }),
    (p: Lesson) => ({ ...p, cues: [...p.cues, p.cues[0]] }),
    (p: Lesson) => ({ ...p, cues: [{ ...p.cues[0], expectedInput: 'Escape' }] }),
    (p: Lesson) => ({ ...p, cues: [{ ...p.cues[0], expectedInput: 'Gamepad16' }] }),
    (p: Lesson) => ({ ...p, cues: [{ ...p.cues[0], time: NaN }] }),
    (p: Lesson) => ({ ...p, cues: [{ ...p.cues[0], time: 21601 }] }),
    (p: Lesson) => ({ ...p, cues: [{ ...p.cues[0], targetDelayMs: 5001 }] }),
    (p: Lesson) => ({ ...p, cues: [{ ...p.cues[0], toleranceMs: 19 }] }),
    (p: Lesson) => ({ ...p, cues: [{ ...p.cues[0], mode: 'automatic' }] }),
    (p: Lesson) => ({ ...p, leadInSeconds: 0.24 }),
    (p: Lesson) => ({ ...p, playbackRate: 2.01 }),
    (p: Lesson) => ({ ...p, videoDataUrl: 'https://example.com/clip.webm' }),
    (p: Lesson) => ({ ...p, videoDataUrl: 'data:text/html;base64,PHNjcmlwdD4=' }),
    (p: Lesson) => ({ ...p, videoDataUrl: 'data:video/webm;base64,PHNjcmlwdD4=' }),
    (p: Lesson) => ({ ...p, videoDataUrl: 'data:video/mp4;base64,GkXfowAAAAA=' }),
  ])('rejects a malformed or out-of-bounds lesson variation', (change) =>
    expect(() => validateLesson(change(sampleLesson()))).toThrow(),
  );
  it('refuses cues at or past the actual loaded duration', () => {
    expect(() => validateLesson(sampleLesson(), 6)).toThrow(/before.*ends/);
    expect(() => validateLesson(sampleLesson(), Infinity)).toThrow(/known/);
  });
  it('supports the complete keyboard and standard gamepad whitelist', () => {
    for (const input of [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
      'KeyA',
      'KeyZ',
      'Digit0',
      'Digit9',
      'Gamepad0',
      'Gamepad15',
    ]) {
      const lesson = sampleLesson();
      lesson.cues[0]!.expectedInput = input;
      expect(validateLesson(lesson).cues[0]!.expectedInput).toBe(input);
      expect(inputLabel(input)).not.toBe('Unsupported input');
    }
    expect(inputLabel('<script>')).toBe('Unsupported input');
    expect(inputLabel('__proto__')).toBe('Unsupported input');
    expect(inputLabel('constructor')).toBe('Unsupported input');
  });
});

describe('independent elapsed-time scoring', () => {
  it('includes timing-window boundaries and requires the correct input', () => {
    const cue = timing();
    expect(scoreResponse(cue, 'Space', 250)).toMatchObject({ success: true, deltaMs: -100 });
    expect(scoreResponse(cue, 'Space', 450)).toMatchObject({ success: true, deltaMs: 100 });
    expect(scoreResponse(cue, 'Space', 450.01).success).toBe(false);
    expect(scoreResponse(cue, 'ArrowLeft', 350)).toMatchObject({
      correctInput: false,
      withinWindow: true,
      success: false,
    });
  });
  it('decision correctness does not depend on an authored timing window', () => {
    const cue = { ...timing(), mode: 'decision' as const };
    expect(scoreResponse(cue, 'Space', 8000)).toMatchObject({
      correctInput: true,
      withinWindow: false,
      success: true,
      latencyMs: 8000,
    });
  });
  it.each([-1, NaN, Infinity])('rejects invalid response latency %s', (latency) =>
    expect(() => scoreResponse(timing(), 'Space', latency)).toThrow(),
  );
});

describe('repeatable practice order', () => {
  it('shuffles deterministically without mutating input records', () => {
    const cues = sampleLesson().cues;
    const before = JSON.stringify(cues);
    expect(shuffledCues(cues, 123)).toEqual(shuffledCues(cues, 123));
    expect(new Set(shuffledCues(cues, 0).map((cue) => cue.id))).toEqual(
      new Set(cues.map((cue) => cue.id)),
    );
    const shuffled = shuffledCues(cues, 4);
    shuffled[0]!.title = 'Changed';
    expect(JSON.stringify(cues)).toBe(before);
    expect(() => shuffledCues(cues, NaN)).toThrow();
  });
});

describe('honest session summaries', () => {
  const result = (
    mode: Cue['mode'],
    correct: boolean,
    latency: number | null,
    skipped = false,
  ): TrialResult => ({
    cueId: 'cue',
    cueTitle: 'Cue',
    mode,
    expectedInput: 'Space',
    input: skipped ? null : 'Space',
    latencyMs: latency,
    deltaMs: null,
    correctInput: correct,
    withinWindow: correct,
    success: correct,
    skipped,
  });
  it('keeps decision accuracy, timing success and skips separate', () => {
    const summary = summarize([
      result('decision', true, 100),
      result('decision', false, 20),
      result('decision', true, 300),
      result('timing', true, 350),
      result('timing', false, 900),
      result('decision', false, null, true),
    ]);
    expect(summary).toEqual({
      total: 6,
      answered: 5,
      skipped: 1,
      decision: { attempts: 3, correct: 2, accuracy: 2 / 3, medianLatencyMs: 200 },
      timing: { attempts: 2, successful: 1, successRate: 0.5 },
    });
  });
  it('reports absent denominators as unavailable, not perfect or zero scores', () => {
    expect(summarize([]).decision.accuracy).toBeNull();
    expect(summarize([]).timing.successRate).toBeNull();
    expect(summarize([result('decision', false, null, true)]).decision.medianLatencyMs).toBeNull();
  });
});

describe('safe standalone packaging', () => {
  it('requires an embedded local video', () =>
    expect(() => exportLessonHtml(sampleLesson(), 'console.log(1)')).toThrow(/Embed/));
  it('escapes hostile names and closing script data without external resources', () => {
    const lesson = {
      ...sampleLesson(),
      name: '</script><img src=x onerror=alert(1)>',
      videoDataUrl: webm,
    };
    const html = exportLessonHtml(lesson, 'console.log("</script>");');
    expect(html).toContain('id="boss-lesson"');
    expect(html).toContain('\\u003c/script>');
    expect(html).toContain('console.log("<\\/script>");');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toMatch(/<(?:script|link|video)[^>]+(?:src|href)="https?:/);
    expect(html).toContain('Permission is hereby granted');
  });
});
