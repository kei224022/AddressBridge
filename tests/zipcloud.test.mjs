import assert from 'node:assert/strict';
import test from 'node:test';
import { ZipCloud } from '../js/zipcloud.js';

const record = {
  zipcode: '1500002', prefcode: '13',
  address1: '東京都', address2: '渋谷区', address3: '渋谷',
  kana1: 'ﾄｳｷｮｳﾄ', kana2: 'ｼﾌﾞﾔｸ', kana3: 'ｼﾌﾞﾔ',
};
const address = {
  zipcode: '1500002', prefcode: '13',
  pref: '東京都', city: '渋谷区', town: '渋谷',
  prefKana: 'ﾄｳｷｮｳﾄ', cityKana: 'ｼﾌﾞﾔｸ', townKana: 'ｼﾌﾞﾔ',
};
const json = payload => new Response(JSON.stringify(payload));

test('successful lookup preserves the existing address shape and normalizes the request', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'https://zipcloud.ibsnet.co.jp/api/search?zipcode=1500002');
    return json({ status: 200, results: [record] });
  });
  assert.deepEqual(await ZipCloud.lookupDetailed('１５０-０００２'), { status: 'success', address });
  assert.deepEqual(await ZipCloud.lookup('1500002'), address);
  assert.equal(await ZipCloud.validate('1500002', '東京都', '渋谷区'), 'match');
  assert.equal(await ZipCloud.validate('1500002', '大阪府', '渋谷区'), 'mismatch');
  assert.equal(await ZipCloud.validate('1500002', '東京都', '新宿区'), 'mismatch');
});

for (const results of [null, []]) {
  test(`a successful response with ${JSON.stringify(results)} means not found`, async t => {
    t.mock.method(globalThis, 'fetch', async () => json({ status: 200, results }));
    assert.deepEqual(await ZipCloud.lookupDetailed('0000000'), { status: 'not-found' });
    assert.equal(await ZipCloud.lookup('0000000'), null);
    assert.equal(await ZipCloud.validate('0000000', '東京都', '渋谷区'), 'mismatch');
  });
}

const failures = {
  'HTTP error': () => new Response('', { status: 503 }),
  'network failure': () => { throw new TypeError('offline'); },
  'invalid JSON': () => new Response('{broken'),
  'API error over HTTP 200': () => json({ status: 400, message: 'API error', results: null }),
  'missing API status': () => json({ results: [record] }),
  'null response': () => json(null),
  'missing results': () => json({ status: 200 }),
  'invalid results type': () => json({ status: 200, results: {} }),
  'invalid address record': () => json({ status: 200, results: [{}] }),
};

for (const [name, response] of Object.entries(failures)) {
  test(`${name} skips validation and preserves lookup's null fallback`, async t => {
    t.mock.method(globalThis, 'fetch', async () => response());
    assert.deepEqual(await ZipCloud.lookupDetailed('1500002'), { status: 'error' });
    assert.equal(await ZipCloud.lookup('1500002'), null);
    assert.equal(await ZipCloud.validate('1500002', '東京都', '渋谷区'), 'skip');
  });
}

test('incomplete input keeps its previous fallback without requesting the API', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected request'); });
  assert.deepEqual(await ZipCloud.lookupDetailed('150'), { status: 'not-found' });
  assert.equal(await ZipCloud.lookup('150'), null);
  assert.equal(fetch.mock.callCount(), 0);
});
