import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const input = process.argv[2];
const port = Number(process.argv[3] ?? 4180);
if (!input || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: npm run serve:player -- path/to/trainer.html [4180]');
  process.exit(1);
}
const filename = await realpath(path.resolve(input));
if (!/\.html?$/i.test(filename)) throw new Error('Choose an exported HTML trainer.');
const info = await stat(filename);
if (!info.isFile() || info.size > 128 * 1024 * 1024)
  throw new Error('Choose a trainer smaller than 128 MiB.');
const html = await readFile(filename);
if (html.byteLength > 128 * 1024 * 1024) throw new Error('Choose a trainer smaller than 128 MiB.');
const server = createServer((request, response) => {
  const suffix = port === 80 ? '' : `:${port}`;
  const hosts = [
    `127.0.0.1${suffix}`,
    `localhost${suffix}`,
    ...(port === 80 ? ['127.0.0.1:80', 'localhost:80'] : []),
  ];
  if (!hosts.includes((request.headers.host ?? '').toLowerCase())) {
    response.writeHead(403);
    response.end('Use the local address printed by the server.');
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method ?? '') || request.url !== '/') {
    response.writeHead(404);
    response.end('Only the selected trainer is served.');
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': html.byteLength,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=()',
  });
  response.end(request.method === 'HEAD' ? undefined : html);
});
server.listen(port, '127.0.0.1', () => {
  console.log(
    `\nBoss Rehearsal trainer: http://127.0.0.1:${port}/\nOnly ${path.basename(filename)} is served. Press Ctrl+C to stop.\n`,
  );
});
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE' ? 'That port is in use. Choose another port.' : error.message,
  );
  process.exitCode = 1;
});
const stop = () => {
  server.closeAllConnections();
  server.close(() => process.exit(0));
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
