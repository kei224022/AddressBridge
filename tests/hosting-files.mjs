/** Validate the exact file list used by the installed Firebase CLI before deploying. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const bin = process.env.FIREBASE_BIN ?? (process.env.PATH ?? '').split(delimiter)
  .map(directory => join(directory, 'firebase')).find(path => existsSync(path));
assert.ok(bin, 'Set FIREBASE_BIN to the Firebase CLI executable, or add firebase to PATH');
const requireFirebase = createRequire(realpathSync(bin));
// Use the same enumerator as firebase-tools/lib/deploy/hosting/deploy.js.
const { listFiles } = requireFirebase('../listFiles.js');
const { hosting } = JSON.parse(readFileSync(join(repo, 'firebase.json'), 'utf8'));
const expected = [
  'index.html', 'css/style.css', 'assets/favicon.svg', 'assets/ogp.png',
  ...readdirSync(join(repo, 'js')).filter(name => name.endsWith('.js') && name !== 'config.example.js')
    .map(name => `js/${name}`),
];
assert.ok(expected.includes('js/config.js'), 'Runtime config.js must be present before deploying');
assert.deepEqual(listFiles(join(repo, hosting.public), hosting.ignore).sort(), expected.sort(),
  'Hosting must publish only application files; exclude Git, hidden directories, notes, logs and tests');
console.log(`PASS: Firebase deploys exactly ${expected.length} application files, including runtime config`);
