import { createServer } from 'vite';
import { buildPlayer } from './build-player.mjs';

let port = 5173;
let strictPort = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && /^\d+$/.test(args[i + 1] ?? '')) port = Number(args[++i]);
  else if (args[i] === '--strictPort') strictPort = true;
  else throw new Error('Usage: npm run dev -- [--port 5173] [--strictPort]');
}
if (port < 1 || port > 65535) throw new Error('Choose a port from 1 to 65535.');

await buildPlayer();
const watcher = await buildPlayer(true);
const server = await createServer({ server: { host: '127.0.0.1', port, strictPort } });
await server.listen();
server.printUrls();
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await watcher.close();
  await server.close();
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
