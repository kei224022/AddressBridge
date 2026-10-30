/** Mutate only a temporary app copy and prove a real regression fails with diagnostics. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, cp, readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'addressbridge-failure-'));
const results = join(root, 'failure-proof-results');
const report = join(root, 'failure-proof-report');
const require = createRequire(import.meta.url);
const listener = createServer();
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

try {
  for (const path of ['index.html', 'js', 'css', 'assets']) {
    await cp(join(root, path), join(fixture, path), {
      recursive: true, filter: source => !source.endsWith('/config.js'),
    });
  }
  const converter = join(fixture, 'js/converter.js');
  const source = await readFile(converter, 'utf8');
  assert.ok(source.includes('const zip = formatZip(address.zip);'));
  async function runProbe(name) {
    let output = '';
    const cli = join(dirname(require.resolve('playwright/package.json')), 'cli.js');
    const child = spawn(process.execPath, [cli, 'test',
      'tests/r6-browser.mjs', '--grep', 'R-6: valid paste "1500002"', '--timeout=30000'], {
      cwd: root,
      env: { ...process.env, TEST_PORT: String(port), TEST_APP_ROOT: fixture,
        TEST_OUTPUT_DIR: join(results, name), TEST_REPORT_DIR: join(report, name) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    await mkdir(results, { recursive: true });
    await writeFile(join(results, `${name}.log`), output);
    return { code, output };
  }
  const baseline = await runProbe('without-config');
  assert.equal(baseline.code, 0, `The clean app without config.js must pass: ${baseline.output}`);
  await writeFile(converter, source.replace('const zip = formatZip(address.zip);', "const zip = '999-9999';"));
  const { code, output } = await runProbe('regression');
  assert.equal(code, 1, `Expected an actual test failure, got ${code}: ${output}`);
  assert.match(output, /999-9999/, 'The assertion must detect the injected postal-code regression');
  const artifacts = await files(results);
  assert.ok(artifacts.some(path => path.endsWith('.png')), 'A failure screenshot must be saved');
  assert.ok(artifacts.some(path => path.endsWith('trace.zip')), 'A failure trace must be saved');
  assert.ok((await files(report)).some(path => path.endsWith('index.html')), 'An HTML report must be saved');
  let serverAlive = false;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/__health`, { signal: AbortSignal.timeout(500) });
    await response.text();
    serverAlive = true;
  } catch { /* The test runner must have stopped its local server on failure. */ }
  assert.equal(serverAlive, false, 'The web server must stop even on a failing test');
  console.log('PASS: injected app regression exits 1; screenshot, trace and report exist; server stopped');
} finally {
  await rm(fixture, { recursive: true, force: true });
}
