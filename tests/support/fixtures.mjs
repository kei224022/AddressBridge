import assert from 'node:assert/strict';
import { test as base } from 'playwright/test';
import { baseURL, origin } from './settings.mjs';

export { baseURL, origin };
export const test = base.extend({
  // R-4 must keep the browser's real cache; route interception disables caching.
  cacheTest: [false, { option: true }],
  offlineChecks: [async ({ context, cacheTest }, use, testInfo) => {
    const unexpected = [], logs = [];
    context.on('page', page => {
      page.on('console', message => logs.push(`[${message.type()}] ${message.text()}`));
      page.on('pageerror', error => logs.push(`[pageerror] ${error.message}`));
    });
    if (cacheTest) {
      context.on('request', request => {
        const url = new URL(request.url());
        if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
          unexpected.push(`${url.origin}${url.pathname}`);
        }
      });
    } else {
      // Scenario routes use fallback for real local files, fulfill/abort for mocked APIs.
      // Unhandled external URLs can never escape this final boundary.
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
        if (url.hostname === 'fonts.gstatic.com') return route.abort();
        if (url.hostname === 'maps.googleapis.com' && url.pathname === '/maps/api/js') {
          return route.fulfill({ contentType: 'text/javascript', body: '/* Maps API disabled in offline tests */' });
        }
        if (url.hostname === 'maps.googleapis.com' && url.pathname === '/maps/api/geocode/json') {
          return route.fulfill({ json: { status: 'ZERO_RESULTS', results: [] } });
        }
        unexpected.push(`${url.origin}${url.pathname}`);
        return route.abort();
      });
    }
    try {
      await use();
      assert.deepEqual(unexpected, [], 'An external URL was not mocked');
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('browser-console', { body: logs.join('\n'), contentType: 'text/plain' });
        await testInfo.attach('unmocked-network', { body: JSON.stringify(unexpected), contentType: 'application/json' });
      }
    }
  }, { auto: true }],
});
