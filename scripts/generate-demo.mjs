import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, readFile, rename, unlink, rmdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Original vector animation by ufodia, rendered at exact 30 fps timestamps.
// Frame generation is independent of wall-clock speed and browser RAF throttling.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public/demo/training.webm');
const temporaryRoot = path.join(root, 'test-results');
await mkdir(path.dirname(output), { recursive: true });
await mkdir(temporaryRoot, { recursive: true });
const frames = await mkdtemp(path.join(temporaryRoot, 'demo-frames-'));
const remuxed = path.join(frames, 'training.webm');
const generated = [];
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="960" height="540"></canvas>');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    window.drawTrainingFrame = (t) => {
      ctx.fillStyle = '#10141d';
      ctx.fillRect(0, 0, 960, 540);
      ctx.strokeStyle = '#222d3c';
      ctx.lineWidth = 1;
      for (let x = 0; x < 960; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 540);
        ctx.stroke();
      }
      for (let y = 0; y < 540; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(960, y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#344457';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(480, 325, 345, 135, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#dce5f1';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('TRAINING ARENA / ORIGINAL DEMO', 36, 44);
      ctx.fillStyle = '#8598b2';
      ctx.font = '13px monospace';
      ctx.fillText('BOSS REHEARSAL · UFODIA', 36, 68);
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.min(t, 8).toFixed(2)} s`, 922, 44);
      ctx.textAlign = 'left';
      const pulse = 1 + Math.sin(t * 3) * 0.04;
      ctx.fillStyle = '#293448';
      ctx.beginPath();
      ctx.arc(480, 214, 70 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff686b';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#ff686b';
      ctx.fillRect(450, 201, 17, 8);
      ctx.fillRect(493, 201, 17, 8);
      ctx.strokeStyle = '#dce5f1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(463, 240);
      ctx.lineTo(497, 240);
      ctx.stroke();
      ctx.fillStyle = '#87d5cb';
      ctx.beginPath();
      ctx.arc(480, 388, 15, 0, Math.PI * 2);
      ctx.fill();
      let caption = 'Watch the approach.';
      if (t > 1.05 && t < 2.55) {
        const k = Math.min(1, (t - 1.05) / 1.45);
        const x = 900 - k * 450;
        ctx.fillStyle = '#ffbb67';
        ctx.beginPath();
        ctx.moveTo(x, 290);
        ctx.lineTo(x + 75, 330);
        ctx.lineTo(x, 370);
        ctx.closePath();
        ctx.fill();
        caption = 'A sweep approaches from the right.';
      }
      if (t > 3.05 && t < 4.55) {
        const k = Math.min(1, (t - 3.05) / 1.45);
        const x = 30 + k * 440;
        ctx.fillStyle = '#bca2f6';
        ctx.fillRect(x, 292, 65, 74);
        caption = 'A slab approaches from the left.';
      }
      if (t > 5.05 && t < 6.65) {
        const k = Math.min(1, (t - 5.05) / 1.6);
        ctx.strokeStyle = t >= 6 ? '#fff1bc' : '#ff686b';
        ctx.lineWidth = 4 + k * 8;
        ctx.beginPath();
        ctx.arc(480, 214, 76 + k * 55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ff686b';
        ctx.globalAlpha = 0.3 + k * 0.5;
        ctx.fillRect(150, 367, 660, 12);
        ctx.globalAlpha = 1;
        caption = 'The core flashes. Prepare the guard.';
      }
      ctx.fillStyle = '#a9bbcf';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(caption, 480, 480);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#64758b';
      ctx.fillText('Annotate the tell. Practice the decision.', 480, 507);
      ctx.textAlign = 'left';
      return canvas.toDataURL('image/jpeg', 0.98).split(',')[1];
    };
  });
  for (let frame = 0; frame < 240; frame++) {
    const png = await page.evaluate((t) => window.drawTrainingFrame(t), frame / 30);
    const filename = path.join(frames, `${String(frame).padStart(4, '0')}.jpg`);
    await writeFile(filename, Buffer.from(png, 'base64'));
    generated.push(filename);
  }
} finally {
  await browser.close();
}

const ffmpeg = process.argv[2] ?? process.env.BOSS_FFMPEG_PATH ?? 'ffmpeg';
const result = spawnSync(
  ffmpeg,
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'image2pipe',
    '-c:v',
    'mjpeg',
    '-framerate',
    '30',
    '-i',
    'pipe:0',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '0',
    '-crf',
    '32',
    '-g',
    '30',
    '-threads',
    '2',
    '-pix_fmt',
    'yuv420p',
    '-an',
    remuxed,
  ],
  {
    encoding: 'utf8',
    windowsHide: true,
    input: Buffer.concat(await Promise.all(generated.map((filename) => readFile(filename)))),
  },
);
if (result.status !== 0)
  throw new Error(
    `FFmpeg VP9 encoding failed. The committed clip is unchanged; frames remain in ${frames}. ${result.stderr ?? ''}`,
  );
await rename(remuxed, output);
// Delete only the exact files generated by this run, then its empty directory.
for (const filename of generated) await unlink(filename);
await rmdir(frames);
console.log(`Original 8-second, 240-frame demo written: ${output}`);
