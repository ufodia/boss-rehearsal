import { test, expect, type Page, type Locator } from '@playwright/test';
import { readyEditor } from './fixtures';
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 100; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw Error('Control is not reachable with Tab');
}
test('editing a cue keeps the next Tab target visible in a short viewport', async ({ page }) => {
  for (const viewport of [
    { width: 640, height: 512 },
    { width: 320, height: 256 },
  ]) {
    await page.setViewportSize(viewport);
    await readyEditor(page);
    const title = page.getByRole('textbox', { name: 'Cue title', exact: true });
    const time = page.getByRole('spinbutton', { name: 'Cue time in seconds', exact: true });
    await tabTo(page, title);
    await title.evaluate((el) => {
      window.scrollBy(0, el.getBoundingClientRect().bottom - (innerHeight - 8));
    });
    await expect(title).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('End');
    await page.keyboard.type(' edited');
    await page.keyboard.press('Tab');
    await expect(time).toBeFocused();
    await expect
      .soft(time, `Tab target at ${viewport.width}x${viewport.height}`)
      .toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Shift+Tab');
    await expect(title).toBeFocused();
    await expect(title).toBeInViewport({ ratio: 1 });
  }
});

test('reflow and keyboard cue editing retain the current control', async ({ page }) => {
  await readyEditor(page);
  const name = page.getByRole('textbox', { name: 'Lesson name', exact: true });
  await tabTo(page, name);
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Keyboard practice');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('textbox', { name: 'Lesson description', exact: true }),
  ).toBeFocused();
  await tabTo(page, name);
  await page.keyboard.press('End');
  await page.keyboard.type(' reverse');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.support-button')).toBeFocused();
  const title = page.getByRole('textbox', { name: 'Cue title', exact: true });
  await tabTo(page, title);
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Keyboard cue');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('spinbutton', { name: 'Cue time in seconds', exact: true }),
  ).toBeFocused();
  const add = page.getByRole('button', { name: 'Add cue at playhead', exact: true });
  await tabTo(page, add);
  await page.keyboard.press('Enter');
  await expect(add).toBeFocused();
  await expect(page.getByTestId('cue-list').locator('article')).toHaveCount(4);
  const practice = page.getByRole('button', { name: 'Start practice', exact: true });
  await tabTo(page, practice);
  await page.keyboard.press('Enter');
  const close = page.getByRole('button', { name: 'Close practice', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(practice).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(practice).toBeFocused();
  const remove = page.locator('[data-action="remove-cue"]').last();
  await tabTo(page, remove);
  await page.keyboard.press('Enter');
  await expect(page.locator('.cue-select[aria-current="true"]')).toBeFocused();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.getByRole('button', { name: 'Open lesson', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 640, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(640);
});
