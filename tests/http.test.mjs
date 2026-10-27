import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchJson, API_TIMEOUT_MS } from '../js/http.js';
import { ZipCloud } from '../js/zipcloud.js';

function clock(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clear = globalThis.clearTimeout;
  const cleared = t.mock.method(globalThis, 'clearTimeout', timer => clear(timer));
  return { tick: ms => t.mock.timers.tick(ms), cleared };
}

test('successful JSON preserves request options and clears its deadline', async t => {
  const timer = clock(t);
  let signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://example.test/api');
    assert.equal(options.method, 'POST');
    assert.equal(options.body, 'request');
    assert.deepEqual(options.headers, { 'Content-Type': 'text/plain' });
    assert.equal('timeoutMs' in options, false);
    signal = options.signal;
    return new Response('{"result":"ok"}');
  });
  assert.deepEqual(await fetchJson('https://example.test/api', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'request', timeoutMs: 50,
  }), { result: 'ok' });
  assert.equal(timer.cleared.mock.callCount(), 1);
  timer.tick(100);
  assert.equal(signal.aborted, false);
});

const failures = {
  HTTP: () => new Response('', { status: 503 }),
  JSON: () => new Response('{broken'),
  network: () => { throw new TypeError('offline'); },
};
for (const [name, response] of Object.entries(failures)) {
  test(`${name} failure clears the deadline and preserves the original error`, async t => {
    const timer = clock(t);
    let signal;
    t.mock.method(globalThis, 'fetch', async (_, options) => {
      signal = options.signal;
      return response();
    });
    await assert.rejects(fetchJson('https://example.test', { timeoutMs: 50 }), error => {
      assert.notEqual(error.name, 'TimeoutError');
      if (name === 'HTTP') assert.match(error.message, /503/);
      return true;
    });
    assert.equal(timer.cleared.mock.callCount(), 1);
    timer.tick(100);
    assert.equal(signal.aborted, false);
  });
}

for (const phase of ['response', 'body']) {
  test(`a hanging ${phase} is bounded even if the mock ignores AbortSignal`, async t => {
    const timer = clock(t);
    let signal, bodyStarted = false;
    t.mock.method(globalThis, 'fetch', async (_, options) => {
      signal = options.signal;
      if (phase === 'response') return new Promise(() => {});
      return { ok: true, json: () => { bodyStarted = true; return new Promise(() => {}); } };
    });
    const result = fetchJson('https://example.test', { timeoutMs: 50 });
    const rejected = assert.rejects(result, { name: 'TimeoutError' });
    await Promise.resolve();
    await Promise.resolve();
    if (phase === 'body') assert.equal(bodyStarted, true);
    timer.tick(49);
    assert.equal(signal.aborted, false);
    timer.tick(1);
    await rejected;
    assert.equal(signal.aborted, true);
    assert.equal(timer.cleared.mock.callCount(), 1);
  });
}

test('an abort-aware transport is cancelled with the timeout reason', async t => {
  const timer = clock(t);
  let aborted = false;
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); });
  }));
  const result = assert.rejects(fetchJson('https://example.test', { timeoutMs: 50 }), { name: 'TimeoutError' });
  timer.tick(50);
  await result;
  assert.equal(aborted, true);
  assert.equal(timer.cleared.mock.callCount(), 1);
});

for (const phase of ['response', 'body']) {
  test(`zipcloud ${phase} timeout uses the R-1 error / skip fallback`, async t => {
    const timer = clock(t);
    t.mock.method(globalThis, 'fetch', async () => phase === 'response'
      ? new Promise(() => {})
      : { ok: true, json: () => new Promise(() => {}) });
    for (const [request, expected] of [
      [() => ZipCloud.lookupDetailed('1500002'), { status: 'error' }],
      [() => ZipCloud.lookup('1500002'), null],
      [() => ZipCloud.validate('1500002', '東京都', '渋谷区'), 'skip'],
    ]) {
      const result = request();
      await Promise.resolve();
      await Promise.resolve();
      timer.tick(API_TIMEOUT_MS.zipcloud);
      assert.deepEqual(await result, expected);
    }
    assert.equal(timer.cleared.mock.callCount(), 3);
  });
}
