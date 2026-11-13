import { build } from 'vite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildPlayer(watch = false) {
  return build({
    root,
    configFile: false,
    publicDir: false,
    build: {
      target: 'es2022',
      lib: {
        entry: path.join(root, 'src/player.ts'),
        name: 'BossRehearsalRuntime',
        formats: ['iife'],
        fileName: () => 'player.js',
      },
      outDir: path.join(root, '.generated'),
      emptyOutDir: true,
      minify: true,
      ...(watch ? { watch: {} } : {}),
    },
  });
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  await buildPlayer();
