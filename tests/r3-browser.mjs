/** Offline regression suite. Playwright starts and stops its local server. */
import assert from 'node:assert/strict';
import { record } from './fixtures/addresses.mjs';
import { test, baseURL, origin } from './support/fixtures.mjs';

const cases = [
  { name: 'normal responses' },
  ...['zipcloud', 'deepl', 'geocoding', 'all'].flatMap(api =>
    ['response', 'body'].map(phase => ({ name: `${api}: hanging ${phase}`, api, phase }))),
];
for (const input of cases) {
  test(`R-3: ${input.name}`, async ({ page, context }) => {
    const scenario = { ...input };
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.fallback();
    if (url.pathname === '/js/config.js') {
      return route.fulfill({ contentType: 'text/javascript', body: "export const GOOGLE_MAPS_API_KEY = 'test-only'; export const DEEPL_API_KEY = 'test-only';" });
    }
    return route.fallback();
  });
  await context.addInitScript(scenario => {
    // Accelerate only the API deadlines. Snackbar/copy timers retain their normal duration.
    const setTimer = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => setTimer(callback, delay === 5000 ? 50 : delay, ...args);
    window._mapsApiReady = true;
    window.google = { maps: {
      Map: class { setCenter() {} setZoom() {} },
      InfoWindow: class { setContent() {} open() {} },
      Marker: class { addListener() {} setPosition() {} },
    } };
    window.apiRequests = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, options = {}) => {
      const url = new URL(input, location.href);
      const api = url.hostname === 'zipcloud.ibsnet.co.jp' ? 'zipcloud'
        : url.hostname === 'api-free.deepl.com' ? 'deepl'
          : url.hostname === 'maps.googleapis.com' ? 'geocoding' : null;
      if (!api) return originalFetch(input, options);
      const hanging = scenario.api === api || scenario.api === 'all';
      const request = { api, signal: options.signal, bodyStarted: false };
      window.apiRequests.push(request);
      // Deliberately ignore AbortSignal: the helper must still bound the caller's wait.
      if (hanging && scenario.phase === 'response') return new Promise(() => {});
      return Promise.resolve({ ok: true, json: () => {
        request.bodyStarted = true;
        if (hanging && scenario.phase === 'body') return new Promise(() => {});
        if (api === 'zipcloud') return Promise.resolve({ status: 200, results: [scenario.record] });
        if (api === 'deepl') return Promise.resolve({ translations: [{ text: `Translated ${JSON.parse(options.body).target_lang}` }] });
        return Promise.resolve({ status: 'OK', results: [{ geometry: { location: { lat: 35.658, lng: 139.702 } } }] });
      } });
    };
  }, { ...scenario, record });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.fill('#input-zip', '1500002');
  if (scenario.api === 'zipcloud' || scenario.api === 'all') {
    await page.waitForFunction(() => document.getElementById('snackbar').textContent.includes('検索に失敗'));
    assert.equal(await page.inputValue('#input-pref'), '');
  } else {
    await page.waitForFunction(() => document.getElementById('input-pref').value === '東京都');
  }
  await page.fill('#input-pref', '東京都');
  await page.fill('#input-city', '渋谷区');
  await page.fill('#input-town', '渋谷1-2-3');
  await page.fill('#input-bldg', 'Sky Bldg 3F');
  await page.click('#btn-convert');
  await page.waitForFunction(() => document.getElementById('result-section').style.display !== 'none' &&
    !document.getElementById('btn-convert').disabled);
  assert.equal(await page.locator('#warning-banner').isVisible(), false);
  assert.equal(await page.locator('#preview-section').isVisible(), true);
  const result = await page.textContent('#result-text');
  assert.match(result, /JAPAN/);
  assert.match(result, scenario.api === 'deepl' || scenario.api === 'all' ? /Sky Bldg 3F/ : /Translated EN-US/);
  await page.waitForFunction(() => ['ready', 'error'].includes(document.getElementById('map-section').dataset.state));
  assert.equal(await page.locator('#map-error').isVisible(), scenario.api === 'geocoding' || scenario.api === 'all');
  assert.equal(await page.getAttribute('#btn-convert', 'aria-disabled'), null);
  const requests = await page.evaluate(() => window.apiRequests.map(request => ({
    api: request.api, aborted: request.signal.aborted, bodyStarted: request.bodyStarted,
  })));
  for (const api of ['zipcloud', 'deepl', 'geocoding']) {
    const calls = requests.filter(request => request.api === api);
    assert.equal(calls.length, api === 'zipcloud' ? 2 : api === 'deepl' ? 7 : 1);
    const hanging = scenario.api === api || scenario.api === 'all';
    assert.ok(calls.every(call => call.aborted === hanging));
    if (hanging) assert.ok(calls.every(call => call.bodyStarted === (scenario.phase === 'body')));
  }
  // A second click must run a new conversion after timeout, not leave the button stuck.
  const previousCount = requests.length;
  await page.click('#btn-convert');
  await page.waitForFunction(count => window.apiRequests.length > count &&
    !document.getElementById('btn-convert').disabled, previousCount);
  await page.waitForFunction(() => ['ready', 'error'].includes(document.getElementById('map-section').dataset.state));
  assert.deepEqual(errors, []);
  });
}
