import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testPort, baseURL } from './settings.mjs';

const root = process.env.TEST_APP_ROOT ?? fileURLToPath(new URL('../..', import.meta.url));
const dummyConfig = await readFile(new URL('../fixtures/config.js', import.meta.url));
const mime = { js: 'text/javascript', css: 'text/css', html: 'text/html', svg: 'image/svg+xml', png: 'image/png' };
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const pathname = new URL(request.url, baseURL).pathname;
    if (pathname === '/__health') return response.end('ready');
    if (pathname === '/js/config.js') {
      response.setHeader('Content-Type', 'text/javascript');
      return response.end(dummyConfig);
    }
    const file = pathname === '/' ? '/index.html' : pathname;
    // This server exposes only application assets, never the workspace or private config.
    if (!/^\/(?:index\.html|js\/[a-z-]+\.js|css\/style\.css|assets\/(?:favicon\.svg|ogp\.png))$/.test(file)) {
      response.writeHead(404);
      return response.end('Not found');
    }
    const content = await readFile(resolve(root, `.${file}`));
    response.setHeader('Content-Type', mime[file.split('.').at(-1)]);
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.listen(testPort, '127.0.0.1', () => console.log(`Test server ready at ${baseURL}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
  });
}
