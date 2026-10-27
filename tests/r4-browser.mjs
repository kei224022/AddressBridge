/** R-4: test real HTTP caching with Firebase Hosting emulator and an unchanged browser context. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, readdir, writeFile, cp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('..', import.meta.url));
const firebaseBin = process.env.FIREBASE_BIN ?? 'firebase';
const fixture = await mkdtemp(join(tmpdir(), 'addressbridge-cache-'));
const publicDir = join(fixture, 'public');
const configPath = join(fixture, 'firebase.json');
const hosting = JSON.parse(await readFile(join(repo, 'firebase.json'), 'utf8')).hosting;
const html = await readFile(join(repo, 'index.html'), 'utf8');
const modules = (await readdir(join(repo, 'js'))).filter(name => name.endsWith('.js') && name !== 'config.example.js');
if (!modules.includes('config.js')) modules.push('config.js');
const sources = {};
for (const name of modules) {
  // Never copy or print personal API keys into test fixtures.
  sources[name] = name === 'config.js'
    ? "export const GOOGLE_MAPS_API_KEY = ''; export const DEEPL_API_KEY = '';"
    : await readFile(join(repo, 'js', name), 'utf8');
}
const css = await readFile(join(repo, 'css/style.css'), 'utf8');
let emulator, browser;

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const emulators = {
  hosting: { host: '127.0.0.1', port },
  hub: { host: '127.0.0.1', port: await freePort() },
  logging: { host: '127.0.0.1', port: await freePort() },
  ui: { enabled: false },
};

async function prepare(release, legacy = false) {
  await mkdir(join(publicDir, 'js'), { recursive: true });
  await mkdir(join(publicDir, 'css'), { recursive: true });
  let page = html
    .replace(/<link\b[^>]*href="https:[^"]*"[^>]*>/g, '')
    .replace(/<script\b[^>]*src="https:[^"]*"[^>]*><\/script>/g, '');
  if (legacy) {
    page = page.replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
      .replace('js/main.js?v=r4', 'js/main.js')
      .replace('css/style.css?v=r4', 'css/style.css?v=2');
  }
  await writeFile(join(publicDir, 'index.html'), page);
  for (const name of modules) {
    await writeFile(join(publicDir, 'js', name), `${sources[name]}\nwindow.loadedRelease ??= {}; window.loadedRelease[${JSON.stringify(name)}] = ${JSON.stringify(release)};\n`);
  }
  await writeFile(join(publicDir, 'css/style.css'), `${css}\nbody { --cache-test-release: ${release}; }\n`);
}

async function start(legacy = false) {
  const legacyHeaders = [
    { source: '**/*.@(js|css)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000' }] },
    ...['/', '**/*.html'].map(source => ({ source, headers: [{ key: 'Cache-Control', value: 'no-cache' }] })),
  ];
  await writeFile(configPath, JSON.stringify({
    hosting: { public: 'public', headers: legacy ? legacyHeaders : hosting.headers },
    emulators,
  }));
  emulator = spawn(firebaseBin, [
    'emulators:start', '--only', 'hosting', '--project', 'demo-addressbridge-cache',
    '--config', configPath, '--non-interactive',
  ], { cwd: fixture, env: { ...process.env, FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', spawnError;
  emulator.stdout.on('data', chunk => { output = (output + chunk).slice(-5000); });
  emulator.stderr.on('data', chunk => { output = (output + chunk).slice(-5000); });
  emulator.on('error', error => { spawnError = error; });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (emulator.exitCode !== null) throw new Error(`Hosting emulator exited: ${output}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { await response.text(); return; }
    } catch { /* Wait for the local emulator to bind its port. */ }
    await delay(100);
  }
  throw new Error(`Hosting emulator did not start: ${output}`);
}

async function stop() {
  if (!emulator || emulator.exitCode !== null) return;
  const child = emulator;
  const exited = once(child, 'exit');
  const force = setTimeout(() => child.kill('SIGKILL'), 5000);
  child.kill('SIGINT');
  try { await exited; } finally { clearTimeout(force); emulator = null; }
}

async function assertRelease(page, release) {
  await page.waitForFunction(() => window.loadedRelease?.['main.js']);
  const loaded = await page.evaluate(() => window.loadedRelease);
  assert.deepEqual(Object.keys(loaded).sort(), [...modules].sort());
  for (const [name, actual] of Object.entries(loaded)) assert.equal(actual, release, name);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--cache-test-release').trim()), release);
}

try {
  await cp(join(repo, 'assets'), join(publicDir, 'assets'), { recursive: true });
  await prepare('legacy', true);
  await start(true);
  assert.match((await fetch(`${origin}/js/config.js`)).headers.get('cache-control'), /max-age=31536000/);
  assert.match((await fetch(`${origin}/css/style.css?v=2`)).headers.get('cache-control'), /max-age=31536000/);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Do not add Playwright routes or disable browser caching in this test.
  await page.goto(`${origin}/?visit=1`, { waitUntil: 'load' });
  await assertRelease(page, 'legacy');
  await prepare('probe', true);
  await page.goto(`${origin}/?visit=2`, { waitUntil: 'load' });
  await assertRelease(page, 'legacy');
  console.log('PASS: old JS, transitive modules, config and CSS stay in the real one-year browser cache');

  await stop();
  await prepare('r4');
  await start();
  const paths = ['/', '/index.html', '/css/style.css?v=r4', ...modules.map(name => `/js/${name}?v=r4`)];
  for (const path of paths) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('cache-control'), 'no-cache', path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
    await response.arrayBuffer();
  }
  console.log(`PASS: Firebase serves no-cache for HTML, CSS and all ${modules.length} modules, including config`);
  await page.reload({ waitUntil: 'load' });
  await assertRelease(page, 'r4');
  console.log('PASS: ordinary reload migrates the same browser from old cached URLs to R-4');

  await prepare('future');
  await page.reload({ waitUntil: 'load' });
  await assertRelease(page, 'future');
  assert.deepEqual(errors, []);
  console.log('PASS: subsequent release is loaded on ordinary reload with unchanged R-4 URLs');
} finally {
  if (browser) await browser.close();
  await stop();
  await rm(fixture, { recursive: true, force: true });
}
