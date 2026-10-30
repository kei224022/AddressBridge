/** Offline regression suite. Playwright starts and stops its local server. */
import assert from 'node:assert/strict';
import { test, baseURL } from './support/fixtures.mjs';

import { tokyo, akita } from './fixtures/addresses.mjs';
async function preparePage(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { ZipCloud } = await import('/js/zipcloud.js');
    window.requests = [];
    ZipCloud.lookupDetailed = zip => new Promise((resolve, reject) => window.requests.push({ zip, resolve, reject }));
  });
}

async function respond(page, index, response) {
  await page.evaluate(({ index, response }) => window.requests[index].resolve(response), { index, response });
}

test('R-2: reversed responses', async ({ page }) => {
    await preparePage(page);
    await page.fill('#input-zip', '1500002');
    await page.fill('#input-zip', '0100854');
    await respond(page, 1, { status: 'success', address: akita });
    assert.equal(await page.inputValue('#input-city'), '秋田市');
    await page.focus('#input-bldg');
    await respond(page, 0, { status: 'success', address: tokyo });
    assert.equal(await page.inputValue('#input-city'), '秋田市');
    assert.equal(await page.inputValue('#input-town'), '手形山崎町');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input-bldg');
  });
  for (const status of ['not-found', 'error']) test(`R-2: stale ${status}`, async ({ page }) => {
    await preparePage(page);
    await page.fill('#input-zip', '1500002');
    await page.fill('#input-zip', '0100854');
    await respond(page, 1, { status: 'success', address: akita });
    await page.focus('#input-bldg');
    await respond(page, 0, { status });
    assert.equal(await page.locator('#snackbar').textContent(), '');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input-bldg');
  });
  test('R-2: input deletion', async ({ page }) => {
    await preparePage(page);
    await page.fill('#input-zip', '1500002');
    await page.fill('#input-zip', '');
    await respond(page, 0, { status: 'success', address: tokyo });
    assert.equal(await page.inputValue('#input-pref'), '');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input-zip');
  });
  test('R-2: re-entering the same zip', async ({ page }) => {
    await preparePage(page);
    await page.fill('#input-zip', '1500002');
    await page.fill('#input-zip', '');
    await page.fill('#input-zip', '1500002');
    await respond(page, 0, { status: 'success', address: akita });
    assert.equal(await page.inputValue('#input-pref'), '');
    await respond(page, 1, { status: 'success', address: tokyo });
    assert.equal(await page.inputValue('#input-city'), '渋谷区');
  });
  for (const key of ['pref', 'city', 'town', 'bldg']) test(`R-2: manual edit ${key}`, async ({ page }) => {
    await preparePage(page);
    await page.fill('#input-zip', '1500002');
    await page.fill(`#input-${key}`, '手動入力');
    await respond(page, 0, { status: 'success', address: tokyo });
    assert.equal(await page.inputValue(`#input-${key}`), '手動入力');
    assert.equal(await page.evaluate(() => document.activeElement.id), `input-${key}`);
    assert.equal(await page.locator('#snackbar').textContent(), '');
  });
