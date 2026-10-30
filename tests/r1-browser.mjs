/** Offline regression suite. Playwright starts and stops its local server. */
import assert from 'node:assert/strict';
import { test, baseURL, origin } from './support/fixtures.mjs';

import { record } from './fixtures/addresses.mjs';
const failureNotice = '郵便番号の検索に失敗しました。通信状況を確認して再試行してください';
const cases = [
  { name: 'matching address', payload: { status: 200, results: [record] }, warning: false },
  { name: 'mismatched address', payload: { status: 200, results: [record] }, mismatch: true, warning: true },
  { name: 'no results', payload: { status: 200, results: null }, notice: '郵便番号が見つかりませんでした', warning: true },
  { name: 'HTTP error', httpStatus: 503, payload: {}, notice: failureNotice, warning: false },
  { name: 'network failure', offline: true, notice: failureNotice, warning: false },
  { name: 'invalid JSON', body: '{broken', notice: failureNotice, warning: false },
  { name: 'API error', payload: { status: 400, results: null }, notice: failureNotice, warning: false },
];

for (const input of cases) {
  test(`R-1: ${input.name}`, async ({ page, context }) => {
    const scenario = { ...input };
  // No real API keys, fonts, map scripts or geocoding requests are needed.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      if (url.pathname === '/js/config.js') {
        return route.fulfill({ contentType: 'text/javascript', body: "export const GOOGLE_MAPS_API_KEY = ''; export const DEEPL_API_KEY = '';" });
      }
      return route.fallback();
    }
    if (url.hostname === 'zipcloud.ibsnet.co.jp') {
      if (scenario.offline) return route.abort();
      return route.fulfill({
        status: scenario.httpStatus ?? 200,
        contentType: 'application/json',
        body: scenario.body ?? JSON.stringify(scenario.payload),
      });
    }
    return route.fallback();
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.fill('#input-zip', '150-0002');
  if (scenario.notice) {
    await page.waitForFunction(text => document.getElementById('snackbar').textContent === text, scenario.notice);
    assert.equal(await page.locator('#snackbar').isVisible(), true);
    assert.equal(await page.inputValue('#input-pref'), '');
  } else {
    await page.waitForFunction(() => document.getElementById('input-pref').value === '東京都');
    assert.equal(await page.inputValue('#input-city'), '渋谷区');
    assert.equal(await page.inputValue('#input-town'), '渋谷');
  }
  await page.fill('#input-pref', scenario.mismatch ? '大阪府' : '東京都');
  await page.fill('#input-city', scenario.mismatch ? '大阪市北区' : '渋谷区');
  await page.fill('#input-town', scenario.mismatch ? '梅田1-1-1' : '渋谷1-2-3');
  await page.click('#btn-convert');
  await page.waitForFunction(() => {
    return document.getElementById('result-section').style.display !== 'none' &&
      !document.getElementById('btn-convert').disabled;
  });
  assert.equal(await page.locator('#warning-banner').isVisible(), scenario.warning);
  assert.equal(await page.locator('#preview-section').isVisible(), true);
  assert.match(await page.textContent('#result-text'), /JAPAN/);
  assert.deepEqual(errors, []);

  // A previous mismatch warning must disappear if the next validation fails to connect.
  if (scenario.mismatch) {
    scenario.offline = true;
    await page.click('#btn-convert');
    await page.waitForFunction(() => !document.getElementById('btn-convert').disabled);
    assert.equal(await page.locator('#warning-banner').isVisible(), false);
    assert.match(await page.textContent('#result-text'), /JAPAN/);
  }
  });
}
