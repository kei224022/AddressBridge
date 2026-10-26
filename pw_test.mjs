import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  if (msg.type() === 'error') logs.push(`[console.error] ${msg.text()}`);
});
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

// IPv6 localhost + domcontentloaded（Google Maps等の長時間リクエストを待たない）
await page.goto('http://[::1]:5000', { waitUntil: 'domcontentloaded', timeout: 15000 });
console.log('✓ ページ読み込み完了');

// 郵便番号を入力
await page.fill('#input-zip', '010-0854');
console.log('✓ 郵便番号入力（秋田市手形山崎町）');

// zipcloud 自動補完を待つ
await page.waitForFunction(() => {
  const pref = document.getElementById('input-pref');
  return pref && pref.value.length > 0;
}, { timeout: 8000 });

const pref = await page.inputValue('#input-pref');
const city = await page.inputValue('#input-city');
const town = await page.inputValue('#input-town');
console.log(`  pref: "${pref}"`);
console.log(`  city: "${city}"`);
console.log(`  town: "${town}"`);

// 町名・番地に番地を追記
const townWithBanchi = town ? town + '9-14' : '手形山崎町9-14';
await page.fill('#input-town', townWithBanchi);

// 変換ボタンをクリック
await page.click('#btn-convert');
console.log('✓ 変換ボタンクリック');

// 変換結果が表示されるまで待つ
await page.waitForFunction(() => {
  const el = document.getElementById('result-section');
  return el && el.style.display !== 'none';
}, { timeout: 15000 });
await page.waitForTimeout(500);

// 各タブの結果を取得
const hasKana = s => /[ぁ-ゟァ-ヿｦ-ﾟ]/.test(s);
const results = {};
for (const locale of ['us', 'uk', 'fr', 'de', 'it', 'kr', 'tw']) {
  await page.click(`[data-locale="${locale}"]`);
  await page.waitForTimeout(150);
  results[locale] = (await page.textContent('#result-text')).trim();
}

console.log('\n========== 変換結果 ==========');
for (const [locale, text] of Object.entries(results)) {
  const kana = hasKana(text);
  console.log(`\n[${locale.toUpperCase()}] ${kana ? '⚠ カタカナ/カナ含む!' : '✓ OK'}`);
  console.log(text);
}

if (logs.length > 0) {
  console.log('\n========== ブラウザエラー ==========');
  logs.forEach(l => console.log(l));
}

await browser.close();
