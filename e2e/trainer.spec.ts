import { test, expect } from '@playwright/test';
import { exportTrainer, importLesson, lessonFixture, readyEditor, sessionRecord } from './fixtures';

test('standalone lesson keeps hostile strings inert and decodes its embedded video offline', async ({
  page,
  browser,
}, info) => {
  await readyEditor(page);
  const lesson = await lessonFixture('</script><img src=x onerror=alert(1)>');
  lesson.cues[0]!.title = '<svg onload=alert(2)>';
  await importLesson(page, lesson);
  const trainer = await exportTrainer(page, info);
  expect(trainer.html).not.toMatch(/<script\s+[^>]*src\s*=/i);
  const context = await browser.newContext({ offline: true });
  try {
    const player = await context.newPage();
    const requests: string[] = [];
    const errors: string[] = [];
    const dialogs: string[] = [];
    player.on('request', (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    player.on('pageerror', (error) => errors.push(error.message));
    player.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await player.goto(trainer.url);
    await expect(player.getByRole('button', { name: 'Start session', exact: true })).toBeEnabled();
    expect(JSON.parse((await player.locator('#boss-lesson').textContent())!)).toEqual(lesson);
    await expect(player.locator('img[onerror], svg[onload]')).toHaveCount(0);
    const duration = await player
      .locator('#training-video')
      .evaluate((element) => (element as HTMLVideoElement).duration);
    expect(Number.isFinite(duration) && duration > 6).toBe(true);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    expect(dialogs).toEqual([]);
  } finally {
    await context.close();
  }
});

test('real video trials enforce fresh input, separate scores, interruption, skip, and restart', async ({
  page,
  browser,
}, info) => {
  await readyEditor(page);
  await importLesson(page, await lessonFixture());
  const trainer = await exportTrainer(page, info);
  const context = await browser.newContext({ offline: true });
  try {
    const player = await context.newPage();
    const errors: string[] = [];
    player.on('pageerror', (error) => errors.push(error.message));
    await player.goto(trainer.url);
    const phase = player.locator('#boss-player');
    await expect(player.getByRole('button', { name: 'Start session', exact: true })).toBeEnabled();
    await player.getByLabel('Shuffle cues this session', { exact: true }).uncheck();
    await player.getByRole('button', { name: 'Start session', exact: true }).click();
    await expect(phase).toHaveAttribute('data-phase', 'lead-in');
    await player.keyboard.down('ArrowLeft');
    await expect(phase).toHaveAttribute('data-phase', 'armed');
    expect(
      await player.locator('#training-video').evaluate((element) => {
        const video = element as HTMLVideoElement;
        return (
          video.paused &&
          !video.seeking &&
          video.readyState >= 2 &&
          Math.abs(video.currentTime - 2) < 0.05
        );
      }),
    ).toBe(true);
    await player.keyboard.down('ArrowLeft'); // repeat of the held lead-in key
    await expect(phase).toHaveAttribute('data-phase', 'armed');
    // Losing focus can also lose keyup. Recovery must not leave Resume locked,
    // and a repeating old key must still not count as a fresh response.
    await player.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(phase).toHaveAttribute('data-phase', 'interrupted');
    await expect(player.getByRole('button', { name: 'Resume trial', exact: true })).toBeEnabled();
    await player.getByRole('button', { name: 'Resume trial', exact: true }).click();
    await expect(phase).toHaveAttribute('data-phase', 'armed');
    await player.keyboard.down('ArrowLeft');
    await expect(phase).toHaveAttribute('data-phase', 'armed');
    await player.keyboard.up('ArrowLeft');
    await player.keyboard.down('ArrowLeft');
    await expect(phase).toHaveAttribute('data-phase', 'feedback');
    await expect(player.locator('#feedback-message')).toContainText('Correct decision');
    await expect(player.getByRole('button', { name: 'Next cue', exact: true })).toBeDisabled();
    await player.keyboard.up('ArrowLeft');
    await expect(player.getByRole('button', { name: 'Next cue', exact: true })).toBeEnabled();
    await player.screenshot({ path: 'docs/assets/player.png', fullPage: true });
    await player.getByRole('button', { name: 'Next cue', exact: true }).click();
    await expect(phase).toHaveAttribute('data-phase', 'armed');
    await player.getByRole('button', { name: 'Pause trial', exact: true }).click();
    await expect(phase).toHaveAttribute('data-phase', 'interrupted');
    await expect(player.locator('#feedback-message')).toContainText('unscored');
    await player.getByRole('button', { name: 'Resume trial', exact: true }).click();
    await expect(player.locator('#current-cue')).toHaveText('Practice the timing');
    await expect(phase).toHaveAttribute('data-phase', 'armed');
    await player.keyboard.press('Space');
    await expect(phase).toHaveAttribute('data-phase', 'feedback');
    await expect(player.locator('#feedback-message')).toContainText('inside the timing window');
    await player.getByRole('button', { name: 'Next cue', exact: true }).click();
    await expect(phase).toHaveAttribute('data-phase', 'lead-in');
    await player.getByRole('button', { name: 'Skip cue', exact: true }).click();
    await expect(phase).toHaveAttribute('data-phase', 'feedback');
    await player.getByRole('button', { name: 'View summary', exact: true }).click();
    await expect(player.locator('#session-summary')).toBeVisible();
    await expect(player.locator('#decision-accuracy')).toHaveText('100%');
    await expect(player.locator('#timing-success')).toHaveText('100%');
    await expect(player.locator('#skip-count')).toHaveText('1');
    const record = await sessionRecord(player);
    expect(record.results).toHaveLength(3);
    expect(record.results.map((result: { cueId: string }) => result.cueId)).toEqual([
      'decision',
      'timing',
      'skip',
    ]);
    expect(record.results[0]).toMatchObject({
      input: 'ArrowLeft',
      correctInput: true,
      success: true,
      skipped: false,
    });
    expect(record.results[1]).toMatchObject({
      input: 'Space',
      mode: 'timing',
      withinWindow: true,
      success: true,
      skipped: false,
    });
    expect(record.results[1].latencyMs).toBeGreaterThanOrEqual(0);
    expect(record.results[1].deltaMs).toBeCloseTo(record.results[1].latencyMs - 1000, 3);
    expect(record.results[2]).toMatchObject({ input: null, skipped: true });
    expect(record.summary).toMatchObject({
      total: 3,
      answered: 2,
      skipped: 1,
      decision: { attempts: 1, correct: 1 },
      timing: { attempts: 1, successful: 1 },
    });
    await player.getByRole('button', { name: 'Restart session', exact: true }).click();
    await expect(phase).toHaveAttribute('data-phase', 'ready');
    await expect(player.locator('#session-summary')).toBeHidden();
    await expect(player.getByRole('button', { name: 'Save results', exact: true })).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('synthetic standard gamepad uses a release-to-press edge rather than first-seen held input', async ({
  page,
  browser,
}, info) => {
  await readyEditor(page);
  const lesson = await lessonFixture('Synthetic gamepad practice');
  lesson.cues = [{ ...lesson.cues[0]!, expectedInput: 'Gamepad0' }];
  await importLesson(page, lesson);
  const trainer = await exportTrainer(page, info);
  const context = await browser.newContext({ offline: true });
  try {
    await context.addInitScript(() => {
      const state = window as typeof window & { testPad: { connected: boolean; down: boolean } };
      state.testPad = { connected: false, down: false };
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: () =>
          state.testPad.connected
            ? [
                {
                  id: 'Synthetic standard controller',
                  index: 0,
                  connected: true,
                  mapping: 'standard',
                  timestamp: performance.now(),
                  axes: [0, 0, 0, 0],
                  buttons: Array.from({ length: 16 }, (_, index) => ({
                    pressed: index === 0 && state.testPad.down,
                    touched: index === 0 && state.testPad.down,
                    value: index === 0 && state.testPad.down ? 1 : 0,
                  })),
                },
              ]
            : [],
      });
    });
    const player = await context.newPage();
    await player.goto(trainer.url);
    const phase = player.locator('#boss-player');
    await expect(player.getByRole('button', { name: 'Start session', exact: true })).toBeEnabled();
    await player.getByRole('button', { name: 'Start session', exact: true }).click();
    await expect(phase).toHaveAttribute('data-phase', 'armed');
    await player.evaluate(() => {
      (window as typeof window & { testPad: { connected: boolean; down: boolean } }).testPad = {
        connected: true,
        down: true,
      };
    });
    await expect(player.locator('#gamepad-status')).toContainText('1 standard gamepad');
    await expect(player.locator('#release-hint')).toContainText('Release all controls');
    await expect(phase).toHaveAttribute('data-phase', 'armed');
    await player.evaluate(() => {
      (window as typeof window & { testPad: { down: boolean } }).testPad.down = false;
    });
    await expect(player.locator('#release-hint')).toHaveText('');
    await player.evaluate(() => {
      (window as typeof window & { testPad: { down: boolean } }).testPad.down = true;
    });
    await expect(phase).toHaveAttribute('data-phase', 'feedback');
    await expect(player.locator('#feedback-message')).toContainText('Correct decision');
    await expect(player.getByRole('button', { name: 'View summary', exact: true })).toBeDisabled();
    await player.evaluate(() => {
      (window as typeof window & { testPad: { down: boolean } }).testPad.down = false;
    });
    await player.getByRole('button', { name: 'View summary', exact: true }).click();
    const record = await sessionRecord(player);
    expect(record.results).toHaveLength(1);
    expect(record.results[0]).toMatchObject({
      input: 'Gamepad0',
      correctInput: true,
      success: true,
    });
  } finally {
    await context.close();
  }
});
