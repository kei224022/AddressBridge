/** Compare real UI and clipboard contents against the pre-R-5/R-6/R-7 release. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { record } from './fixtures/addresses.mjs';
import { test, baseURL, origin } from './support/fixtures.mjs';

const baseline = JSON.parse(await readFile(new URL('./fixtures/common-results.json', import.meta.url), 'utf8'));
// Keep expected result keys independent of the application's locale configuration.
const locales = { us: 'us', uk: 'uk', fr: 'fr', de: 'de', it: 'it', 'ca-en': 'caEn', 'ca-fr': 'caFr', kr: 'kr', tw: 'tw' };
const previews = { envelope: 'envelope-to-address', postcard: 'postcard-address', label: 'label-address' };
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function prepare(page, context, scenario, fallback = false) {
  const languages = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === '/js/config.js') {
      return route.fulfill({ contentType: 'text/javascript', body:
        "export const GOOGLE_MAPS_API_KEY = ''; export const DEEPL_API_KEY = 'ci-dummy';" });
    }
    if (url.hostname === 'zipcloud.ibsnet.co.jp') {
      return route.fulfill({ json: { status: 200, results: [record] } });
    }
    if (url.hostname === 'api-free.deepl.com') {
      const { target_lang: language } = route.request().postDataJSON();
      languages.push(language);
      return scenario.name === 'building-translated'
        ? route.fulfill({ json: { translations: [{ text: baseline.translations[language] }] } })
        : route.fulfill({ status: 503, body: 'Translation unavailable' });
    }
    return route.fallback();
  });
  await context.addInitScript(fallback => {
    window.resetClipboard = navigator.clipboard.writeText.bind(navigator.clipboard);
    if (fallback) {
      window.fallbackCopies = 0;
      navigator.clipboard.writeText = async () => { throw new Error('Clipboard API unavailable'); };
      const exec = document.execCommand.bind(document);
      document.execCommand = (...args) => {
        if (args[0] === 'copy') window.fallbackCopies++;
        return exec(...args);
      };
    }
  }, fallback);
  await page.goto(baseURL);
  await page.fill('#input-zip', scenario.address.zip);
  await page.waitForFunction(() => document.getElementById('input-city').value === '渋谷区');
  await page.fill('#input-town', scenario.address.town);
  await page.fill('#input-bldg', scenario.address.bldg);
  await page.click('#btn-convert');
  await page.waitForFunction(() => !document.getElementById('btn-convert').disabled &&
    document.getElementById('result-section').style.display !== 'none');
  assert.deepEqual([...languages].sort(), scenario.address.bldg ? Object.keys(baseline.translations).sort() : []);
  const from = ['〒150-0002', '東京都渋谷区渋谷1-2-3', scenario.address.bldg].filter(Boolean).join('\n');
  for (const id of ['from-address', 'label-from']) assert.equal(await page.textContent(`#${id}`), from);
  return errors;
}

async function verifyLocale(page, scenario, locale, resultKey) {
  const expected = scenario.expected[resultKey];
  await page.click(`[data-locale="${locale}"]`);
  assert.equal(await page.getAttribute(`[data-locale="${locale}"]`, 'aria-selected'), 'true');
  assert.equal(await page.locator('.lang-tab.active').count(), 1);
  assert.equal(await page.textContent('#result-text'), expected);
  const auxiliary = locale === 'kr' || locale === 'tw';
  assert.equal(await page.locator('#result-aux').isVisible(), auxiliary);
  if (auxiliary) assert.equal(await page.textContent('#aux-text'), scenario.expected[`${locale}Aux`]);

  async function copy(id) {
    // Reset first, so stale clipboard contents cannot make a broken copy pass.
    await page.evaluate(() => window.resetClipboard('__before_copy__'));
    await page.click(`#${id}`);
    await page.waitForFunction(expected => navigator.clipboard.readText().then(text => text === expected), expected);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected);
    assert.match(await page.textContent(`#${id}`), /コピーしました/);
  }
  await copy('copy-result');
  for (const [type, addressId] of Object.entries(previews)) {
    await page.click(`[data-preview="${type}"]`);
    for (const other of Object.keys(previews)) {
      assert.equal(await page.locator(`#preview-${other}`).isVisible(), other === type);
    }
    assert.equal(await page.textContent(`#${addressId}`), expected);
    await copy(`copy-${type}`);
  }
}

for (const scenario of baseline.cases) {
  for (const [locale, key] of Object.entries(locales)) {
    test(`Common: ${scenario.name} ${locale} matches baseline, previews and clipboard`, async ({ page, context }) => {
      const errors = await prepare(page, context, scenario);
      await verifyLocale(page, scenario, locale, key);
      assert.deepEqual(errors, []);
    });
  }
}

test('Common: clipboard fallback copies every locale and cleans up temporary fields', async ({ page, context }) => {
  const scenario = baseline.cases[0];
  const errors = await prepare(page, context, scenario, true);
  for (const [locale, key] of Object.entries(locales)) await verifyLocale(page, scenario, locale, key);
  assert.equal(await page.evaluate(() => window.fallbackCopies), 36);
  assert.equal(await page.locator('textarea').count(), 0);
  assert.deepEqual(errors, []);
});
