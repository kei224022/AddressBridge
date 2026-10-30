import assert from 'node:assert/strict';
import test from 'node:test';
import { ZipCloud } from '../js/zipcloud.js';

const valid = [
  ['1500002', '1500002'],
  ['150-0002', '1500002'],
  ['１５００００２', '1500002'],
  ['１５０－０００２', '1500002'],
  ['１５０-０００２', '1500002'],
  [' 150 0002 ', '1500002'],
  ['１５０　－　０００２', '1500002'],
  ['\t150-\t0002\n', '1500002'],
  ['000-0000', '0000000'],
];
for (const [input, expected] of valid) {
  test(`supported postal code ${JSON.stringify(input)} is normalized before the request`, async t => {
    assert.equal(ZipCloud.normalizeZip(input), expected);
    assert.equal(ZipCloud.formatZipInput(input), `${expected.slice(0, 3)}-${expected.slice(3)}`);
    const fetch = t.mock.method(globalThis, 'fetch', async url => {
      assert.equal(new URL(url).searchParams.get('zipcode'), expected);
      return new Response(JSON.stringify({ status: 200, results: null }));
    });
    assert.deepEqual(await ZipCloud.lookupDetailed(input), { status: 'not-found' });
    assert.equal(fetch.mock.callCount(), 1);
  });
}

const invalid = [
  '', ' ', '150', '150000', '15000028', '150-00028', 'abc1500002', '150a0002',
  '1500002!', '〒1500002', '1-500002', '150--0002', '1500002-', '150−0002', null,
];
for (const input of invalid) {
  test(`invalid postal code ${JSON.stringify(input)} never requests the API`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected request'); });
    assert.equal(ZipCloud.normalizeZip(input), '');
    assert.equal(ZipCloud.normalizeZip(ZipCloud.formatZipInput(input)), '');
    assert.deepEqual(await ZipCloud.lookupDetailed(input), { status: 'not-found' });
    assert.equal(await ZipCloud.lookup(input), null);
    assert.equal(await ZipCloud.validate(input, '東京都', '渋谷区'), 'mismatch');
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test('input formatting keeps extra digits and invalid characters visible', () => {
  assert.equal(ZipCloud.formatZipInput('150'), '150');
  assert.equal(ZipCloud.formatZipInput('１５００'), '150-0');
  assert.equal(ZipCloud.formatZipInput('15000028'), '150-00028');
  assert.equal(ZipCloud.formatZipInput('150-00028'), '150-00028');
  assert.equal(ZipCloud.formatZipInput('abc1500002'), 'abc1500002');
  assert.equal(ZipCloud.formatZipInput('150--0002'), '150--0002');
});
