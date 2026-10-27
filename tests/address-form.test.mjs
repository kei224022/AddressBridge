import assert from 'node:assert/strict';
import test from 'node:test';
import { createAddressForm } from '../js/address-form.js';
import { ZipCloud } from '../js/zipcloud.js';

const tokyo = { pref: '東京都', city: '渋谷区', town: '渋谷', prefKana: 'トウキョウト', cityKana: 'シブヤク', townKana: 'シブヤ' };
const akita = { pref: '秋田県', city: '秋田市', town: '手形山崎町', prefKana: 'アキタケン', cityKana: 'アキタシ', townKana: 'テガタヤマザキチョウ' };
const emptyKana = { prefKana: '', cityKana: '', townKana: '' };
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(t) {
  const notices = [], requests = [];
  let active = null, focusCount = 0;
  class Input extends EventTarget {
    value = '';
    textContent = '';
    classList = { add() {}, remove() {} };
    focus() { active = this; focusCount++; }
    setSelectionRange() {}
  }
  const elements = Object.fromEntries(['zip', 'pref', 'city', 'town', 'bldg'].flatMap(key => [
    [`input-${key}`, new Input()], [`error-${key}`, new Input()],
  ]));
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: id => elements[id] } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else delete globalThis.document;
  });
  t.mock.method(ZipCloud, 'lookupDetailed', zip => new Promise((resolve, reject) => requests.push({ zip, resolve, reject })));
  const form = createAddressForm(message => notices.push(message));
  return {
    form, requests, notices, elements,
    input(key, value) {
      elements[`input-${key}`].value = value;
      elements[`input-${key}`].dispatchEvent(new Event('input'));
    },
    focus(key) { elements[`input-${key}`].focus(); },
    get active() { return active; },
    get focusCount() { return focusCount; },
  };
}

function assertAddress(state, address) {
  const actual = state.form.read();
  for (const [key, value] of Object.entries(address)) assert.equal(actual[key], value, key);
}

test('B completing before A preserves B address, kana and the current focus', async t => {
  const state = setup(t);
  state.input('zip', '1500002');
  state.input('zip', '0100854');
  assert.deepEqual(state.requests.map(request => request.zip), ['1500002', '0100854']);
  state.requests[1].resolve({ status: 'success', address: akita });
  await flush();
  assertAddress(state, akita);
  assert.equal(state.active, state.elements['input-town']);
  state.focus('bldg');
  const focusCount = state.focusCount;
  state.requests[0].resolve({ status: 'success', address: tokyo });
  await flush();
  assertAddress(state, akita);
  assert.equal(state.active, state.elements['input-bldg']);
  assert.equal(state.focusCount, focusCount);
  assert.deepEqual(state.notices, []);
});

for (const status of ['not-found', 'error', 'rejected']) {
  test(`a stale ${status} response cannot notify or move focus`, async t => {
    const state = setup(t);
    state.input('zip', '1500002');
    state.input('zip', '0100854');
    state.requests[1].resolve({ status: 'success', address: akita });
    await flush();
    const count = state.focusCount;
    if (status === 'rejected') state.requests[0].reject(new Error('old failure'));
    else state.requests[0].resolve({ status });
    await flush();
    assertAddress(state, akita);
    assert.deepEqual(state.notices, []);
    assert.equal(state.focusCount, count);
  });
}

for (const zip of ['', '150']) {
  test(`deleting or shortening the zip to ${JSON.stringify(zip)} invalidates a pending lookup`, async t => {
    const state = setup(t);
    state.input('zip', '1500002');
    state.input('zip', zip);
    state.requests[0].resolve({ status: 'success', address: tokyo });
    await flush();
    assertAddress(state, { pref: '', city: '', town: '', ...emptyKana });
    assert.equal(state.requests.length, 1);
    assert.equal(state.focusCount, 0);
  });
}

test('re-entering the same zip accepts only the newest request', async t => {
  const state = setup(t);
  state.input('zip', '1500002');
  state.input('zip', '');
  state.input('zip', '1500002');
  state.requests[0].resolve({ status: 'success', address: tokyo });
  await flush();
  assert.equal(state.form.read().pref, '');
  state.requests[1].resolve({ status: 'success', address: tokyo });
  await flush();
  assertAddress(state, tokyo);
  assert.equal(state.focusCount, 1);
});

test('repeated input with an unchanged zip still supersedes the previous request', async t => {
  const state = setup(t);
  state.input('zip', '1500002');
  state.input('zip', '150-0002');
  state.requests[0].resolve({ status: 'not-found' });
  await flush();
  assert.deepEqual(state.notices, []);
  state.requests[1].resolve({ status: 'success', address: tokyo });
  await flush();
  assertAddress(state, tokyo);
});

for (const key of ['pref', 'city', 'town', 'bldg']) {
  test(`editing ${key} while a lookup is pending prevents all autocomplete updates`, async t => {
    const state = setup(t);
    state.input('zip', '1500002');
    state.input(key, '手動入力');
    state.requests[0].resolve({ status: 'success', address: tokyo });
    await flush();
    assert.equal(state.form.read()[key], '手動入力');
    assert.equal(state.focusCount, 0);
    assert.deepEqual(state.notices, []);
    assertAddress(state, emptyKana);
  });
}

test('editing and restoring an address still invalidates the pending request', async t => {
  const state = setup(t);
  state.input('zip', '1500002');
  state.input('town', 'temporary');
  state.input('town', '');
  state.requests[0].resolve({ status: 'error' });
  await flush();
  assert.deepEqual(state.notices, []);
  assert.equal(state.focusCount, 0);
});

test('programmatic address changes without input events also prevent overwrites', async t => {
  const state = setup(t);
  state.input('zip', '1500002');
  state.elements['input-city'].value = '手動入力';
  state.requests[0].resolve({ status: 'success', address: tokyo });
  await flush();
  assert.equal(state.form.read().city, '手動入力');
  assert.equal(state.focusCount, 0);
});

test('programmatic zip changes are checked before applying a response', async t => {
  const state = setup(t);
  state.input('zip', '1500002');
  state.elements['input-zip'].value = '0100854';
  state.requests[0].resolve({ status: 'success', address: tokyo });
  await flush();
  assert.equal(state.form.read().pref, '');
});

for (const nextZip of ['0100854', '', '150']) {
  test(`changing a completed lookup's zip to ${JSON.stringify(nextZip)} immediately clears all kana`, async t => {
    const state = setup(t);
    state.input('zip', '1500002');
    state.requests[0].resolve({ status: 'success', address: tokyo });
    await flush();
    assertAddress(state, tokyo);
    state.input('zip', nextZip);
    assertAddress(state, emptyKana);
  });
}
