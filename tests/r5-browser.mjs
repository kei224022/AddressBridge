/** Offline regression suite. Playwright starts and stops its local server. */
import assert from 'node:assert/strict';
import { test, baseURL, origin } from './support/fixtures.mjs';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

function scenario(name, run, mapsReady = true) {
  test(`R-5: ${name}`, async ({ page, context }) => {
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.fallback();
      if (url.pathname === '/js/config.js') return route.fulfill({
        contentType: 'text/javascript', body: "export const GOOGLE_MAPS_API_KEY = ''; export const DEEPL_API_KEY = '';",
      });
      return route.fallback();
    });
    await context.addInitScript(mapsReady => {
      window.scrollTargets = [];
      const scroll = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function(options) {
        window.scrollTargets.push({ id: this.id, behavior: options?.behavior });
        scroll.call(this, options);
      };
      window._mapsApiReady = mapsReady;
      if (mapsReady) window.google = { maps: {
        // Real map initialization may replace container children: overlays must be siblings.
        Map: class { constructor(element) { element.replaceChildren(); } setCenter() {} setZoom() {} },
        Marker: class {
          constructor({ position }) { window.markerPosition = position; }
          setPosition(position) { window.markerPosition = position; }
          addListener() {}
        },
        InfoWindow: class { setContent(content) { window.markerLabel = content.textContent; } open() {} },
      } };
    }, mapsReady);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const { ZipCloud } = await import('/js/zipcloud.js');
      const { Geocoder } = await import('/js/geocoder.js');
      ZipCloud.lookupDetailed = async () => ({ status: 'success', address: {
        pref: '東京都', city: '渋谷区', town: '渋谷', prefKana: 'トウキョウト', cityKana: 'シブヤク', townKana: 'シブヤ',
      } });
      ZipCloud.validate = async () => 'match';
      window.geoRequests = [];
      Geocoder.search = address => new Promise((resolve, reject) => window.geoRequests.push({ address, resolve, reject }));
    });
    await page.fill('#input-zip', '1500002');
    await page.waitForFunction(() => document.getElementById('input-pref').value === '東京都');
    await run(page);
    assert.deepEqual(errors, []);
  });
}

async function convert(page, town, count) {
  await page.fill('#input-town', town);
  await page.click('#btn-convert');
  await page.waitForFunction(count => window.geoRequests.length === count &&
    document.getElementById('result-section').style.display !== 'none' &&
    !document.getElementById('btn-convert').disabled, count);
}

async function complete(page, index, position, reject = false) {
  await page.evaluate(({ index, position, reject }) => {
    const request = window.geoRequests[index];
    if (reject) request.reject(new Error('geocoder failed'));
    else request.resolve(position);
  }, { index, position, reject });
}

async function state(page) {
  return page.getAttribute('#map-section', 'data-state');
}

async function copyAndCheck(page) {
  const text = await page.textContent('#result-text');
  await page.click('#copy-result');
  await page.waitForFunction(() => document.getElementById('copy-result').textContent.includes('コピーしました'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), text);
}

scenario('results, tabs, previews and clipboard work before geocoding finishes', async page => {
    assert.equal(await page.locator('#map-section').isVisible(), false);
    await convert(page, '渋谷1-2-3', 1);
    assert.equal(await state(page), 'loading');
    assert.equal(await page.getAttribute('#map-section', 'aria-busy'), 'true');
    assert.equal(await page.locator('#map-loading').isVisible(), true);
    assert.equal(await page.locator('#map-container').isVisible(), false);
    assert.equal(await page.locator('#map-error').isVisible(), false);
    assert.match(await page.textContent('#result-text'), /1-2-3/);
    for (const locale of ['us', 'uk', 'fr', 'de', 'it', 'ca-en', 'ca-fr', 'kr', 'tw']) {
      await page.click(`[data-locale="${locale}"]`);
      assert.match(await page.textContent('#result-text'), /150-0002/);
    }
    await page.click('[data-locale="fr"]');
    await page.click('[data-preview="postcard"]');
    assert.equal(await page.locator('#preview-postcard').isVisible(), true);
    await copyAndCheck(page);
    await complete(page, 0, { lat: 35, lon: 139 });
    assert.equal(await state(page), 'ready');
    assert.equal(await page.getAttribute('#map-section', 'aria-busy'), 'false');
    assert.equal(await page.locator('#map-loading').isVisible(), false);
    assert.equal(await page.locator('#map-container').isVisible(), true);
    assert.match(await page.textContent('#result-text'), /JAPON/);
    assert.equal(await page.locator('#preview-postcard').isVisible(), true);
  });

  scenario('a new conversion immediately hides the old map until the new position is ready', async page => {
    await convert(page, '渋谷1-2-3', 1);
    await complete(page, 0, { lat: 35, lon: 139 });
    assert.equal(await state(page), 'ready');
    await convert(page, '渋谷4-5-6', 2);
    assert.equal(await state(page), 'loading');
    assert.equal(await page.locator('#map-container').isVisible(), false);
    assert.match(await page.textContent('#result-text'), /4-5-6/);
    await complete(page, 1, { lat: 36, lon: 140 });
    assert.equal(await state(page), 'ready');
    assert.deepEqual(await page.evaluate(() => window.markerPosition), { lat: 36, lng: 140 });
    assert.match(await page.evaluate(() => window.markerLabel), /4-5-6/);
  });

  for (const outcome of ['success', 'not-found', 'rejected']) {
    scenario(`an old ${outcome} cannot replace a newer map or result`, async page => {
      await convert(page, '渋谷1-2-3', 1);
      await convert(page, '渋谷4-5-6', 2);
      await complete(page, 1, { lat: 36, lon: 140 });
      await complete(page, 0, outcome === 'success' ? { lat: 35, lon: 139 } : null, outcome === 'rejected');
      assert.equal(await state(page), 'ready');
      assert.deepEqual(await page.evaluate(() => window.markerPosition), { lat: 36, lng: 140 });
      assert.match(await page.textContent('#result-text'), /4-5-6/);
      assert.equal(await page.locator('#map-error').isVisible(), false);
    });
  }

  scenario('a new conversion invalidates the old map while address validation is still pending', async page => {
    await convert(page, '渋谷1-2-3', 1);
    await page.evaluate(async () => {
      const { ZipCloud } = await import('/js/zipcloud.js');
      ZipCloud.validate = () => new Promise(resolve => { window.finishValidation = resolve; });
    });
    await page.fill('#input-town', '渋谷4-5-6');
    await page.click('#btn-convert');
    assert.equal(await page.locator('#btn-convert').isDisabled(), true);
    await complete(page, 0, { lat: 35, lon: 139 });
    assert.equal(await state(page), 'loading');
    assert.equal(await page.locator('#map-container').isVisible(), false);
    await page.evaluate(() => window.finishValidation('match'));
    await page.waitForFunction(() => window.geoRequests.length === 2 && !document.getElementById('btn-convert').disabled);
    await complete(page, 1, { lat: 36, lon: 140 });
    assert.deepEqual(await page.evaluate(() => window.markerPosition), { lat: 36, lng: 140 });
  });

  for (const reject of [false, true]) {
    scenario(`current map ${reject ? 'exception' : 'failure'} preserves the result and copy action`, async page => {
      await convert(page, '渋谷1-2-3', 1);
      await complete(page, 0, null, reject);
      assert.equal(await state(page), 'error');
      assert.equal(await page.getAttribute('#map-section', 'aria-busy'), 'false');
      assert.equal(await page.locator('#map-loading').isVisible(), false);
      assert.equal(await page.locator('#map-error').isVisible(), true);
      assert.equal(await page.locator('#map-container').isVisible(), false);
      assert.match(await page.textContent('#result-text'), /JAPAN/);
      await copyAndCheck(page);
    });
  }

  scenario('unavailable Maps API still shows the error overlay outside its container', async page => {
    await convert(page, '渋谷1-2-3', 1);
    await complete(page, 0, { lat: 35, lon: 139 });
    assert.equal(await state(page), 'error');
    assert.equal(await page.locator('#map-error').isVisible(), true);
    assert.match(await page.textContent('#result-text'), /JAPAN/);
  }, false);

  scenario('only result rendering scrolls; a late map update keeps the settled scroll position', async page => {
    await convert(page, '渋谷1-2-3', 1);
    const before = await page.evaluate(async () => {
      let last = scrollY, stable = 0;
      while (stable < 5) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        stable = Math.abs(scrollY - last) < 0.1 ? stable + 1 : 0;
        last = scrollY;
      }
      return { y: scrollY, height: document.getElementById('map-section').offsetHeight, targets: window.scrollTargets };
    });
    assert.deepEqual(before.targets, [{ id: 'result-section', behavior: 'smooth' }]);
    await complete(page, 0, { lat: 35, lon: 139 });
    assert.equal(await page.evaluate(() => document.getElementById('map-section').offsetHeight), before.height);
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - before.y) < 1);
    assert.deepEqual(await page.evaluate(() => window.scrollTargets), before.targets);
  });
