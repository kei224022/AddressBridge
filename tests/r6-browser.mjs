/** Offline regression suite. Playwright starts and stops its local server. */
import assert from 'node:assert/strict';
import { record } from './fixtures/addresses.mjs';
import { test, baseURL, origin } from './support/fixtures.mjs';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
const valid = ['1500002', '150-0002', '１５００００２', '１５０－０００２', ' １５０　－　０００２ '];
const invalid = [
  ['', ''], ['　 ', ''], ['150000', '150-000'], ['15000028', '150-00028'],
  ['150-00028', '150-00028'], ['abc1500002', 'abc1500002'], ['1500002!', '1500002!'],
  ['150--0002', '150--0002'], ['1-500002', '1-500002'],
];

function scenario(name, run) {
  test(`R-6: ${name}`, async ({ page, context }) => {
    const requests = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) {
        if (url.pathname === '/js/config.js') return route.fulfill({
          contentType: 'text/javascript', body: "export const GOOGLE_MAPS_API_KEY = ''; export const DEEPL_API_KEY = '';",
        });
        return route.fallback();
      }
      if (url.hostname === 'zipcloud.ibsnet.co.jp') {
        requests.push(url.searchParams.get('zipcode'));
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 200, results: [record] }) });
      }
      // An invalid form must never reach translation or geocoding, either.
      if (url.pathname.includes('/geocode/') || url.hostname.includes('deepl')) {
        requests.push(url.pathname);
        return route.abort();
      }
      return route.fallback();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.getAttribute('#input-zip', 'maxlength'), null);
    await run(page, requests);
    assert.deepEqual(errors, []);
  });
}

async function paste(page, input) {
  await page.bringToFront();
  await page.evaluate(text => navigator.clipboard.writeText(text), input);
  await page.focus('#input-zip');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
}

async function fillAddress(page) {
  await page.fill('#input-pref', '東京都');
  await page.fill('#input-city', '渋谷区');
  await page.fill('#input-town', '渋谷1-2-3');
}

async function assertInvalid(page, requests, empty = false) {
  await fillAddress(page);
  await page.click('#btn-convert');
  const message = await page.textContent('#error-zip');
  assert.equal(message, empty ? '郵便番号を入力してください' : '郵便番号は7桁の数字で入力してください（例: 150-0002）');
  assert.equal(await page.locator('#result-section').isVisible(), false);
  assert.equal(await page.locator('#btn-convert').isDisabled(), false);
  assert.deepEqual(requests, []);
}

for (const input of valid) {
    scenario(`valid paste ${JSON.stringify(input)} is normalized and autocompletes`, async (page, requests) => {
      await paste(page, input);
      await page.waitForFunction(() => document.getElementById('input-pref').value === '東京都');
      assert.equal(await page.inputValue('#input-zip'), '150-0002');
      assert.deepEqual(requests, ['1500002']);
      await page.fill('#input-town', '渋谷1-2-3');
      await page.click('#btn-convert');
      await page.waitForFunction(() => document.getElementById('result-section').style.display !== 'none' && !document.getElementById('btn-convert').disabled);
      assert.equal(await page.textContent('#error-zip'), '');
      assert.match(await page.textContent('#result-text'), /150-0002/);
      assert.deepEqual(requests.filter(value => value === '1500002'), ['1500002', '1500002']);
    });
  }
  for (const [input, expected] of invalid) {
    scenario(`invalid paste ${JSON.stringify(input)} blocks conversion and all API requests`, async (page, requests) => {
      if (input) await paste(page, input);
      assert.equal(await page.inputValue('#input-zip'), expected);
      await assertInvalid(page, requests, !expected);
    });
  }

  scenario('typing keeps all extra digits; invalid edits do not request again', async (page, requests) => {
    await page.focus('#input-zip');
    await page.keyboard.type('150000');
    assert.equal(await page.inputValue('#input-zip'), '150-000');
    assert.deepEqual(requests, []);
    await page.keyboard.type('2');
    await page.waitForFunction(() => document.getElementById('input-pref').value === '東京都');
    await page.focus('#input-zip');
    await page.press('#input-zip', 'End');
    await page.keyboard.type('8');
    assert.equal(await page.inputValue('#input-zip'), '150-00028');
    await fillAddress(page);
    await page.click('#btn-convert');
    assert.match(await page.textContent('#error-zip'), /7桁/);
    assert.deepEqual(requests, ['1500002']);
  });

  scenario('correcting invalid input clears the error and enables conversion', async (page, requests) => {
    await paste(page, '15000028');
    await assertInvalid(page, requests);
    await page.fill('#input-zip', '１５０－０００２');
    await page.waitForFunction(() => document.getElementById('input-pref').value === '東京都');
    assert.equal(await page.textContent('#error-zip'), '');
    await page.fill('#input-town', '渋谷1-2-3');
    await page.click('#btn-convert');
    await page.waitForFunction(() => document.getElementById('result-section').style.display !== 'none' && !document.getElementById('btn-convert').disabled);
    assert.match(await page.textContent('#result-text'), /150-0002/);
  });

  scenario('IME input is preserved without a request until composition ends', async (page, requests) => {
    await page.focus('#input-zip');
    await page.evaluate(() => {
      const input = document.getElementById('input-zip');
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      input.value = '１５００００２';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
    });
    assert.equal(await page.inputValue('#input-zip'), '１５００００２');
    assert.deepEqual(requests, []);
    await page.evaluate(() => document.getElementById('input-zip').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    await page.waitForFunction(() => document.getElementById('input-pref').value === '東京都');
    assert.equal(await page.inputValue('#input-zip'), '150-0002');
    assert.deepEqual(requests, ['1500002']);
  });
