/** R-2 regression: a local server is required; no real external API is used. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5000';
const origin = new URL(baseURL).origin;
const tokyo = { pref: '東京都', city: '渋谷区', town: '渋谷', prefKana: 'トウキョウト', cityKana: 'シブヤク', townKana: 'シブヤ' };
const akita = { pref: '秋田県', city: '秋田市', town: '手形山崎町', prefKana: 'アキタケン', cityKana: 'アキタシ', townKana: 'テガタヤマザキチョウ' };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) return route.abort();
  if (url.pathname === '/js/config.js') {
    return route.fulfill({ contentType: 'text/javascript', body: "export const GOOGLE_MAPS_API_KEY = ''; export const DEEPL_API_KEY = '';" });
  }
  return route.continue();
});

async function freshPage() {
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { ZipCloud } = await import('/js/zipcloud.js');
    window.requests = [];
    ZipCloud.lookupDetailed = zip => new Promise((resolve, reject) => window.requests.push({ zip, resolve, reject }));
  });
  return page;
}

async function respond(page, index, response) {
  await page.evaluate(({ index, response }) => window.requests[index].resolve(response), { index, response });
}

try {
  {
    const page = await freshPage();
    await page.fill('#input-zip', '1500002');
    await page.fill('#input-zip', '0100854');
    await respond(page, 1, { status: 'success', address: akita });
    assert.equal(await page.inputValue('#input-city'), '秋田市');
    await page.focus('#input-bldg');
    await respond(page, 0, { status: 'success', address: tokyo });
    assert.equal(await page.inputValue('#input-city'), '秋田市');
    assert.equal(await page.inputValue('#input-town'), '手形山崎町');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input-bldg');
    console.log('PASS: reversed responses preserve the newest address and focus');
    await page.close();
  }
  for (const status of ['not-found', 'error']) {
    const page = await freshPage();
    await page.fill('#input-zip', '1500002');
    await page.fill('#input-zip', '0100854');
    await respond(page, 1, { status: 'success', address: akita });
    await page.focus('#input-bldg');
    await respond(page, 0, { status });
    assert.equal(await page.locator('#snackbar').textContent(), '');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input-bldg');
    console.log(`PASS: stale ${status} cannot notify or move focus`);
    await page.close();
  }
  {
    const page = await freshPage();
    await page.fill('#input-zip', '1500002');
    await page.fill('#input-zip', '');
    await respond(page, 0, { status: 'success', address: tokyo });
    assert.equal(await page.inputValue('#input-pref'), '');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input-zip');
    console.log('PASS: deleting input discards a pending success');
    await page.close();
  }
  {
    const page = await freshPage();
    await page.fill('#input-zip', '1500002');
    await page.fill('#input-zip', '');
    await page.fill('#input-zip', '1500002');
    await respond(page, 0, { status: 'success', address: akita });
    assert.equal(await page.inputValue('#input-pref'), '');
    await respond(page, 1, { status: 'success', address: tokyo });
    assert.equal(await page.inputValue('#input-city'), '渋谷区');
    console.log('PASS: re-entering the same zip only accepts its latest request');
    await page.close();
  }
  for (const key of ['pref', 'city', 'town', 'bldg']) {
    const page = await freshPage();
    await page.fill('#input-zip', '1500002');
    await page.fill(`#input-${key}`, '手動入力');
    await respond(page, 0, { status: 'success', address: tokyo });
    assert.equal(await page.inputValue(`#input-${key}`), '手動入力');
    assert.equal(await page.evaluate(() => document.activeElement.id), `input-${key}`);
    assert.equal(await page.locator('#snackbar').textContent(), '');
    console.log(`PASS: editing ${key} prevents autocomplete and focus changes`);
    await page.close();
  }
} finally {
  await browser.close();
}
