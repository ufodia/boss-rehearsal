import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readyEditor } from './fixtures';

test('finite original video supports cue CRUD, portable save/reopen, and embedded practice', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await readyEditor(page);
  const video = page.getByTestId('video-editor');
  await expect
    .poll(() =>
      video.evaluate((element) => Number.isFinite((element as HTMLVideoElement).duration)),
    )
    .toBe(true);
  expect(await video.evaluate((element) => (element as HTMLVideoElement).duration)).toBeGreaterThan(
    6,
  );
  await page.getByLabel('Lesson name', { exact: true }).fill('Personal practice set');
  await page.getByLabel('Lesson name', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Add cue at playhead', exact: true }).click();
  await expect(page.getByTestId('cue-list').locator('article')).toHaveCount(4);
  await page.getByLabel('Cue title', { exact: true }).fill('Delayed dodge');
  await page.getByLabel('Cue title', { exact: true }).press('Tab');
  await page.getByLabel('Cue time in seconds', { exact: true }).fill('1.5');
  await page.getByLabel('Cue time in seconds', { exact: true }).press('Tab');
  await page.getByLabel('Expected input', { exact: true }).selectOption('KeyD');
  await page.getByLabel('Practice mode', { exact: true }).selectOption('timing');
  await page.getByLabel('Target delay in milliseconds', { exact: true }).fill('500');
  await page.getByLabel('Target delay in milliseconds', { exact: true }).press('Tab');
  await page.getByLabel('Timing tolerance in milliseconds', { exact: true }).fill('200');
  await page.getByLabel('Timing tolerance in milliseconds', { exact: true }).press('Tab');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save lesson', exact: true }).click();
  const saved = await pending;
  const json = await readFile((await saved.path())!, 'utf8');
  const lesson = JSON.parse(json);
  expect(lesson.name).toBe('Personal practice set');
  expect(lesson.videoDataUrl).toMatch(/^data:video\/webm;base64,/);
  expect(lesson.cues.find((cue: { title: string }) => cue.title === 'Delayed dodge')).toMatchObject(
    { time: 1.5, expectedInput: 'KeyD', mode: 'timing', targetDelayMs: 500, toleranceMs: 200 },
  );
  await page.getByRole('button', { name: 'Delete Delayed dodge cue', exact: true }).click();
  await expect(page.getByTestId('cue-list').locator('article')).toHaveCount(3);
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByLabel('Import lesson', { exact: true })
    .setInputFiles({ name: 'saved.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.getByTestId('cue-list').locator('article')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.getByTestId('player-frame')).toBeVisible();
  await expect(
    page
      .frameLocator('[data-testid="player-frame"]')
      .getByRole('button', { name: 'Start session', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Close practice', exact: true }).click();
  await expect(page.getByTestId('player-frame')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load sample', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: /^Seek to Left sweep at/ }).click();
  await expect
    .poll(() =>
      page.getByTestId('video-editor').evaluate((element) => {
        const media = element as HTMLVideoElement;
        return !media.seeking && media.readyState >= 2 && Math.abs(media.currentTime - 2) < 0.05;
      }),
    )
    .toBe(true);
  await page.getByTestId('video-editor').scrollIntoViewIfNeeded();
  const presented = await page.getByTestId('video-editor').evaluate(async (element) => {
    const media = element as HTMLVideoElement;
    media.pause();
    // A paused seek can leave Chromium's old composited frame/spinner visible.
    // Present the real cue through native playback, then pause its actual frame.
    const seek = (time: number) =>
      new Promise<void>((resolve) => {
        media.addEventListener('seeked', () => resolve(), { once: true });
        media.currentTime = time;
      });
    await seek(1.8);
    const frame = new Promise<number>((resolve) => {
      const observe: VideoFrameRequestCallback = (_now, metadata) => {
        if (metadata.mediaTime >= 2) {
          media.pause();
          resolve(metadata.mediaTime);
        } else media.requestVideoFrameCallback(observe);
      };
      media.requestVideoFrameCallback(observe);
    });
    await media.play();
    const mediaTime = await frame;
    if (media.readyState < 3)
      await new Promise<void>((resolve) =>
        media.addEventListener('canplay', () => resolve(), { once: true }),
      );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return {
      mediaTime,
      currentTime: media.currentTime,
      paused: media.paused,
      readyState: media.readyState,
    };
  });
  expect(presented.mediaTime).toBeGreaterThanOrEqual(2);
  expect(presented.mediaTime).toBeLessThan(2.15);
  expect(presented.currentTime).toBeCloseTo(presented.mediaTime, 1);
  expect(presented.paused).toBe(true);
  expect(presented.readyState).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: 'docs/assets/workspace.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/mobile-editor.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('metadata-only lessons request their video and invalid imports preserve the lesson', async ({
  page,
}) => {
  await readyEditor(page);
  await page.getByLabel('Include video when saving the lesson', { exact: true }).uncheck();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save lesson', exact: true }).click();
  const saved = await pending;
  const json = await readFile((await saved.path())!, 'utf8');
  expect(JSON.parse(json)).not.toHaveProperty('videoDataUrl');
  await page.getByLabel('Import lesson', { exact: true }).setInputFiles({
    name: 'metadata.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('Reload');
  await page
    .getByLabel('Upload practice video', { exact: true })
    .setInputFiles('public/demo/training.webm');
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeEnabled();
  const name = await page.getByLabel('Lesson name', { exact: true }).inputValue();
  await page.getByLabel('Import lesson', { exact: true }).setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.getByRole('status')).toContainText(/version 1|lesson/i);
  await expect(page.getByLabel('Lesson name', { exact: true })).toHaveValue(name);
});
