/**
 * staging_test.mjs — ステージング URL 検証
 * https://addressconversion-93436.web.app で全機能を確認する
 */
import { chromium } from 'playwright';

const STAGING = 'https://addressconversion-93436.web.app';
const hasKana = s => /[ぁ-ゟァ-ヿｦ-ﾟ]/.test(s);
let passed = 0, failed = 0;
const failList = [];

function log(id, ok, detail = '') {
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${id}${detail ? ': ' + detail : ''}`);
  if (ok) passed++; else { failed++; failList.push(`${id}: ${detail}`); }
}

const browser = await chromium.launch({ headless: true });
const page    = await browser.newPage();
const errs    = [];
page.on('pageerror', e => errs.push(e.message));

console.log(`\nステージング URL: ${STAGING}\n`);

// ── ページ読み込み ──
await page.goto(STAGING, { waitUntil: 'domcontentloaded', timeout: 30000 });
log('S-01', true, 'ページ読み込み成功');

// ── favicon ──
const faviconHref = await page.$eval('link[rel="icon"]', el => el.href).catch(() => '');
log('S-02', faviconHref.includes('favicon.svg'), `favicon: ${faviconHref}`);

// ── OGP タグ ──
const ogImage = await page.$eval('meta[property="og:image"]', el => el.content).catch(() => '');
log('S-03', ogImage.includes('ogp.png'), `og:image: ${ogImage}`);

// ── タイトル ──
const title = await page.title();
log('S-04', title.includes('AddressBridge'), `title: "${title}"`);

// ── 郵便番号補完（実際の zipcloud API） ──
await page.fill('#input-pref', '');
await page.fill('#input-zip', '150-0002');
await page.waitForFunction(() => {
  const p = document.getElementById('input-pref');
  return p && p.value === '東京都';
}, { timeout: 8000 }).catch(() => {});
const pref = await page.inputValue('#input-pref');
const city = await page.inputValue('#input-city');
log('S-05', pref === '東京都' && city === '渋谷区', `補完: pref="${pref}" city="${city}"`);

// ── 変換（全9タブ検証） ──
const town = await page.inputValue('#input-town');
await page.fill('#input-town', town + '1丁目2番3号');
await page.click('#btn-convert');
await page.waitForFunction(() => {
  const el = document.getElementById('result-section');
  return el && el.style.display !== 'none';
}, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(500);

const LOCALES = {
  'us': 'JAPAN', 'uk': 'JAPAN', 'fr': 'JAPON', 'de': 'JAPAN', 'it': 'GIAPPONE',
  'ca-en': 'JAPAN', 'ca-fr': 'JAPON', 'kr': '일본', 'tw': '日本',
};
for (const [locale, country] of Object.entries(LOCALES)) {
  await page.click(`[data-locale="${locale}"]`);
  await page.waitForTimeout(150);
  const text = (await page.textContent('#result-text')).trim();
  const ok = text.includes(country) && text.includes('150-0002') && !hasKana(text);
  log(`S-06-${locale}`, ok, ok ? `"${country}" OK` : `NG: "${text.slice(0,50)}"`);
}

// ── プレビュー切り替え ──
await page.click('[data-locale="us"]'); await page.waitForTimeout(200);
await page.click('[data-preview="postcard"]'); await page.waitForTimeout(200);
log('S-07', await page.isVisible('#preview-postcard'), 'はがきプレビュー');
await page.click('[data-preview="envelope"]');

// ── コピーボタン ──
await page.click('#copy-envelope'); await page.waitForTimeout(400);
const copyLabel = (await page.textContent('#copy-envelope')).trim();
log('S-08', copyLabel.includes('コピーしました'), `コピー: "${copyLabel}"`);

// ── 地図セクション ──
const mapShown = await page.evaluate(() => {
  const s = document.getElementById('map-section');
  return s && s.style.display !== 'none';
});
log('S-09', mapShown, '地図セクション表示');

// ── favicon ファイルが 200 で取得できる ──
const favRes = await page.evaluate(async () => {
  const r = await fetch('/assets/favicon.svg');
  return r.status;
});
log('S-10', favRes === 200, `favicon HTTP ${favRes}`);

// ── OGP 画像ファイルが 200 で取得できる ──
const ogpRes = await page.evaluate(async () => {
  const r = await fetch('/assets/ogp.png');
  return r.status;
});
log('S-11', ogpRes === 200, `OGP image HTTP ${ogpRes}`);

// ── SP レイアウト ──
await page.setViewportSize({ width: 375, height: 812 });
await page.reload({ waitUntil: 'domcontentloaded' });
const tabsScroll = await page.evaluate(() => {
  const el = document.querySelector('.lang-tabs');
  return el && getComputedStyle(el).overflowX === 'auto';
});
log('S-12', tabsScroll, 'SP: 言語タブ横スクロール');

// ── ページエラーなし ──
const relevantErrs = errs.filter(e => !e.includes('400') && !e.includes('adsbygoogle'));
log('S-13', relevantErrs.length === 0,
  relevantErrs.length > 0 ? `エラー: ${relevantErrs[0]}` : 'JS エラーなし');

await browser.close();

// ── サマリー ──
console.log('\n' + '═'.repeat(55));
console.log(`  STAGING: ${STAGING}`);
console.log(`  TOTAL: ${passed + failed} / PASS: ${passed} / FAIL: ${failed}`);
if (failed > 0) {
  console.log('\n  失敗:');
  failList.forEach(f => console.log(`    ✗ ${f}`));
}
console.log('═'.repeat(55));
process.exit(failed > 0 ? 1 : 0);
