import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { expect, type Page, type TestInfo } from '@playwright/test';

export async function lessonFixture(name = 'Browser practice lesson') {
  const video = await readFile('public/demo/training.webm');
  return {
    version: 1,
    name,
    description: 'An original synthetic clip for browser workflow checks.',
    videoName: 'training.webm',
    videoDataUrl: `data:video/webm;base64,${video.toString('base64')}`,
    leadInSeconds: 1,
    playbackRate: 1,
    cues: [
      {
        id: 'decision',
        title: 'Choose left',
        time: 2,
        expectedInput: 'ArrowLeft',
        mode: 'decision',
        targetDelayMs: 0,
        toleranceMs: 150,
      },
      {
        id: 'timing',
        title: 'Practice the timing',
        time: 4,
        expectedInput: 'Space',
        mode: 'timing',
        targetDelayMs: 1000,
        toleranceMs: 2000,
      },
      {
        id: 'skip',
        title: 'Optional third cue',
        time: 6,
        expectedInput: 'ArrowRight',
        mode: 'decision',
        targetDelayMs: 0,
        toleranceMs: 150,
      },
    ],
  };
}

export async function readyEditor(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeEnabled();
}

export async function importLesson(
  page: Page,
  lesson: Awaited<ReturnType<typeof lessonFixture>>,
): Promise<void> {
  await page.getByLabel('Import lesson', { exact: true }).setInputFiles({
    name: 'browser.boss-rehearsal.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(lesson)),
  });
  await expect(page.getByLabel('Lesson name', { exact: true })).toHaveValue(lesson.name);
  await expect(page.getByRole('button', { name: 'Download trainer', exact: true })).toBeEnabled();
}

export async function exportTrainer(page: Page, info: TestInfo) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download trainer', exact: true }).click();
  const download = await pending;
  const filename = info.outputPath('standalone-trainer.html');
  await download.saveAs(filename);
  return { filename, url: pathToFileURL(filename).href, html: await readFile(filename, 'utf8') };
}

export async function sessionRecord(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save results', exact: true }).click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, 'utf8'));
}
