/**
 * phase4_test.mjs — AddressBridge フェーズ4 ブラウザ自動テスト
 * Playwright (Chromium headless) で TC-A / V / C / P / M / T / E / N / Z を実施
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5000';
const hasKana  = s => /[ぁ-ゟァ-ヿｦ-ﾟ]/.test(s);

let passed = 0, failed = 0;
const failList = [];

function log(id, ok, detail = '') {
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${id}${detail ? ': ' + detail : ''}`);
  if (ok) passed++; else { failed++; failList.push(`${id}: ${detail}`); }
}

// ── ヘルパー ─────────────────────────────────────────────────────
async function freshPage(browser) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console',   m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  return { page, errs };
}

/** 郵便番号補完を使った住所入力（正規フロー）*/
async function fillViaZip(page, zip, extraTown = '', bldg = '') {
  // pref を一度クリアして「新しく補完された」ことを検出できるようにする
  await page.fill('#input-pref', '');
  await page.fill('#input-zip', zip);
  await page.waitForFunction(() => {
    const p = document.getElementById('input-pref');
    return p && p.value.length > 0;
  }, { timeout: 8000 }).catch(() => {});
  const town = await page.inputValue('#input-town');
  if (extraTown) await page.fill('#input-town', town + extraTown);
  if (bldg)      await page.fill('#input-bldg', bldg);
}

/** 変換実行して result-section が表示されるまで待つ */
async function doConvert(page, timeout = 15000) {
  await page.click('#btn-convert');
  await page.waitForFunction(() => {
    const el = document.getElementById('result-section');
    return el && el.style.display !== 'none';
  }, { timeout }).catch(() => {});
  await page.waitForTimeout(300);
}

/** 指定タブのテキストを取得 */
async function tabText(page, locale) {
  await page.click(`[data-locale="${locale}"]`);
  await page.waitForTimeout(150);
  return (await page.textContent('#result-text')).trim();
}

// ═══════════════════════════════════════════════════════════════
const browser = await chromium.launch({ headless: true });

// ── TC-Z: zipcloud API 連携 ─────────────────────────────────────
console.log('\n── TC-Z: zipcloud API 連携 ──');
{
  const { page } = await freshPage(browser);

  // TC-Z-001: 実在する郵便番号（150-0002）
  await page.fill('#input-zip', '150-0002');
  await page.waitForFunction(() => {
    const p = document.getElementById('input-pref');
    return p && p.value === '東京都';
  }, { timeout: 6000 }).catch(() => {});
  const z1pref = await page.inputValue('#input-pref');
  const z1city = await page.inputValue('#input-city');
  const z1town = await page.inputValue('#input-town');
  log('TC-Z-001', z1pref === '東京都' && z1city === '渋谷区',
    `pref="${z1pref}" city="${z1city}" town="${z1town}"`);

  // TC-Z-002: 存在しない郵便番号 → snackbar / フィールド不変
  const prefBefore = await page.inputValue('#input-pref');
  await page.fill('#input-zip', '000-0000');
  await page.waitForTimeout(3500);
  const snack = await page.isVisible('#snackbar');
  log('TC-Z-002', snack, 'スナックバー表示');

  // TC-Z-003: validate — 郵便番号と住所が不一致で警告
  await page.fill('#input-zip', '150-0002');
  await page.waitForFunction(() => {
    const p = document.getElementById('input-pref'); return p && p.value.length > 0;
  }, { timeout: 6000 }).catch(() => {});
  await page.fill('#input-pref', '大阪府');
  await page.fill('#input-city', '大阪市北区');
  await page.fill('#input-town', '梅田1-1-1');
  await doConvert(page);
  const warn = await page.isVisible('#warning-banner');
  log('TC-Z-003', warn, '不一致警告バナー表示');
  await page.close();
}

// ── TC-A: 住所補完フロー ────────────────────────────────────────
console.log('\n── TC-A: 住所補完フロー ──');
{
  const { page } = await freshPage(browser);

  // TC-A-001: 3桁後のハイフン自動挿入
  // TC-A-001: 4桁目入力時にハイフンが自動挿入される（実装は raw.length > 3 で判定）
  await page.click('#input-zip');
  await page.keyboard.type('1500', { delay: 50 });
  await page.waitForTimeout(300);
  const zipVal = await page.inputValue('#input-zip');
  log('TC-A-001', zipVal === '150-0', `4桁目入力でハイフン自動挿入 (got "${zipVal}")`);

  // TC-A-002: 正常補完
  await page.fill('#input-zip', '150-0002');
  await page.waitForFunction(() => {
    const p = document.getElementById('input-pref'); return p && p.value.length > 0;
  }, { timeout: 6000 }).catch(() => {});
  const pref = await page.inputValue('#input-pref');
  const city = await page.inputValue('#input-city');
  const town = await page.inputValue('#input-town');
  log('TC-A-002a', pref === '東京都',      `都道府県補完 pref="${pref}"`);
  log('TC-A-002b', city === '渋谷区',      `市区町村補完 city="${city}"`);
  log('TC-A-002c', town.includes('渋谷'), `町域名補完 town="${town}"`);

  // フォーカスが town フィールドへ移動しているか
  const focusedId = await page.evaluate(() => document.activeElement?.id);
  log('TC-A-002d', focusedId === 'input-town', `フォーカス→town (got "${focusedId}")`);

  // TC-A-003: 補完失敗 snackbar
  await page.fill('#input-zip', '000-0000');
  await page.waitForTimeout(3500);
  const snack = await page.isVisible('#snackbar');
  log('TC-A-003', snack, '無効zip→スナックバー表示');
  await page.close();
}

// ── TC-V: バリデーション ─────────────────────────────────────────
console.log('\n── TC-V: バリデーション ──');
{
  const { page } = await freshPage(browser);

  // TC-V-001: 全必須フィールド空で変換
  await page.click('#btn-convert');
  await page.waitForTimeout(300);
  log('TC-V-001a', await page.isVisible('#error-zip'),  '郵便番号エラー表示');
  log('TC-V-001b', await page.isVisible('#error-pref'), '都道府県エラー表示');
  log('TC-V-001c', await page.isVisible('#error-city'), '市区町村エラー表示');
  log('TC-V-001d', await page.isVisible('#error-town'), '町名番地エラー表示');

  // TC-V-002: 建物名は任意 → エラーなし
  const noBldgErr = !(await page.evaluate(() =>
    !!document.getElementById('error-bldg')?.textContent?.trim()
  ));
  log('TC-V-002', noBldgErr, '建物名エラーなし（任意）');

  // TC-V-003: フィールド入力後エラークリア
  await page.keyboard.press('Tab'); // focus
  await page.fill('#input-pref', '東京都');
  await page.waitForTimeout(100);
  const prefErrCleared = !(await page.evaluate(() => {
    const el = document.getElementById('error-pref');
    return el && el.textContent.trim().length > 0;
  }));
  log('TC-V-003', prefErrCleared, '入力後エラークリア');
  await page.close();
}

// ── TC-C: 変換フロー E2E ────────────────────────────────────────
console.log('\n── TC-C: 変換フロー E2E ──');
{
  const { page } = await freshPage(browser);

  // TC-C-001: 標準変換（渋谷）
  await fillViaZip(page, '150-0002', '1丁目2番3号');
  await doConvert(page);

  const resultVisible  = await page.evaluate(() => document.getElementById('result-section')?.style.display !== 'none');
  const previewVisible = await page.evaluate(() => document.getElementById('preview-section')?.style.display !== 'none');
  log('TC-C-001a', resultVisible,  '変換結果セクション表示');
  log('TC-C-001b', previewVisible, 'プレビューセクション表示');

  const usText = (await page.textContent('#result-text')).trim();
  log('TC-C-001c', usText.includes('JAPAN'),    `US出力にJAPAN含む`);
  log('TC-C-001d', usText.includes('150-0002'), 'US出力に郵便番号含む');
  log('TC-C-001e', !hasKana(usText), `US出力カナなし (抜粋: "${usText.split('\n')[0]}")`);

  // TC-C-002: 住所不一致警告
  await page.fill('#input-zip', '150-0002');
  await page.waitForTimeout(3000);
  await page.fill('#input-pref', '大阪府');
  await page.fill('#input-city', '大阪市北区');
  await page.fill('#input-town', '梅田1-1-1');
  await doConvert(page);
  log('TC-C-002', await page.isVisible('#warning-banner'), '不一致→警告バナー');

  // TC-C-003: 建物名なし
  const { page: p3 } = await freshPage(browser);
  await fillViaZip(p3, '150-0002', '1丁目2番3号', '');
  await doConvert(p3);
  const t3 = (await p3.textContent('#result-text')).trim();
  log('TC-C-003', !t3.includes('Bldg') && t3.includes('JAPAN'), '建物名なし: Bldg行なし');
  await p3.close();

  // TC-C-004: 連続変換（秋田に変更）
  // result-section は既に表示済みのため、テキスト変化で判定する
  await fillViaZip(page, '010-0854', '9-14');
  await page.click('#btn-convert');
  await page.waitForFunction(() => {
    const t = document.getElementById('result-text')?.textContent ?? '';
    return t.includes('010-0854');
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const akitaText = (await page.textContent('#result-text')).trim();
  log('TC-C-004a', akitaText.includes('010-0854'), '連続変換: 秋田郵便番号');
  log('TC-C-004b', !hasKana(akitaText), `連続変換: カナなし (抜粋: "${akitaText.split('\n')[0]}")`);
  log('TC-C-004c', akitaText.includes('Akita'), '連続変換: Akita含む');
  await page.close();
}

// ── TC-T: 全タブ表示確認 ────────────────────────────────────────
console.log('\n── TC-T: 全9タブ表示 ──');
{
  const { page } = await freshPage(browser);
  await fillViaZip(page, '150-0002', '1丁目2番3号');
  await doConvert(page);

  const LOCALES = {
    'us':    { country: 'JAPAN',    },
    'uk':    { country: 'JAPAN',    },
    'fr':    { country: 'JAPON',    },
    'de':    { country: 'JAPAN',    },
    'it':    { country: 'GIAPPONE', },
    'ca-en': { country: 'JAPAN',    },
    'ca-fr': { country: 'JAPON',    },
    'kr':    { country: '일본',      },
    'tw':    { country: '日本',      },
  };

  for (const [locale, { country }] of Object.entries(LOCALES)) {
    const text = await tabText(page, locale);
    const ok = text.includes(country) && text.includes('150-0002') && !hasKana(text);
    log(`TC-T-001-${locale}`, ok,
      ok ? `"${country}" / 150-0002` : `カナあり or 国名なし: "${text.slice(0,50)}"`);
  }

  // TC-T-002: KR/TW で補助表示エリア、FR では非表示
  await page.click('[data-locale="kr"]'); await page.waitForTimeout(200);
  log('TC-T-002-kr', await page.isVisible('#result-aux'), 'KR補助表示あり');

  await page.click('[data-locale="tw"]'); await page.waitForTimeout(200);
  log('TC-T-002-tw', await page.isVisible('#result-aux'), 'TW補助表示あり');

  await page.click('[data-locale="fr"]'); await page.waitForTimeout(200);
  log('TC-T-002-fr-noaux', !(await page.isVisible('#result-aux')), 'FR補助表示なし');
  await page.close();
}

// ── TC-P: プレビュー・コピー ─────────────────────────────────────
console.log('\n── TC-P: プレビュー・コピー ──');
{
  const { page } = await freshPage(browser);
  await fillViaZip(page, '150-0002', '1丁目2番3号');
  await doConvert(page);
  await page.click('[data-locale="us"]'); await page.waitForTimeout(200);

  // TC-P-001: プレビュー切り替え
  await page.click('[data-preview="postcard"]'); await page.waitForTimeout(200);
  log('TC-P-001a', await page.isVisible('#preview-postcard'), 'はがき表示');
  log('TC-P-001b', !(await page.isVisible('#preview-envelope')), '封筒非表示');
  await page.click('[data-preview="label"]'); await page.waitForTimeout(200);
  log('TC-P-001c', await page.isVisible('#preview-label'), '伝票表示');
  await page.click('[data-preview="envelope"]'); await page.waitForTimeout(200);

  // TC-P-002: 言語切り替えでプレビュー連動
  await page.click('[data-locale="kr"]'); await page.waitForTimeout(300);
  const envToKr = await page.textContent('#envelope-to-address');
  log('TC-P-002', envToKr.includes('일본'), `KR→封筒TO更新 ("${envToKr.trim().slice(0,30)}")`);

  // TC-P-003: コピーボタンラベル変化
  await page.click('[data-locale="us"]'); await page.waitForTimeout(200);
  await page.click('#copy-envelope');
  await page.waitForTimeout(400);
  const copyLabel = (await page.textContent('#copy-envelope')).trim();
  log('TC-P-003', copyLabel.includes('コピーしました'), `コピー後ラベル ("${copyLabel}")`);

  // TC-P-004: 2秒後リセット
  await page.waitForTimeout(2200);
  const resetLabel = (await page.textContent('#copy-envelope')).trim();
  log('TC-P-004', resetLabel.includes('コピー') && !resetLabel.includes('しました'),
    `ラベルリセット ("${resetLabel}")`);
  await page.close();
}

// ── TC-M: 地図表示 ───────────────────────────────────────────────
console.log('\n── TC-M: 地図表示 ──');
{
  const { page } = await freshPage(browser);

  // TC-M-001a: 変換前は非表示
  const hiddenBefore = await page.evaluate(() => {
    const s = document.getElementById('map-section');
    return !s || s.style.display === 'none' || s.style.display === '';
  });
  log('TC-M-001a', hiddenBefore, '変換前: 地図セクション非表示');

  // TC-M-001b: 変換後は表示
  await fillViaZip(page, '150-0002', '1丁目2番3号');
  await doConvert(page);
  await page.waitForFunction(() => {
    const s = document.getElementById('map-section');
    return s && s.style.display !== 'none';
  }, { timeout: 12000 }).catch(() => {});
  const shownAfter = await page.evaluate(() => {
    const s = document.getElementById('map-section');
    return s && s.style.display !== 'none';
  });
  log('TC-M-001b', shownAfter, '変換後: 地図セクション表示');

  // TC-M-002: 地図コンテナ or エラーメッセージが見える
  const hasMap = await page.isVisible('#map-container');
  log('TC-M-002', hasMap, '地図コンテナ存在');
  await page.close();
}

// ── TC-E: エッジケース ───────────────────────────────────────────
console.log('\n── TC-E: エッジケース ──');
{
  // TC-E-001a: 番地なし（丁目まで）
  const { page: p1 } = await freshPage(browser);
  await fillViaZip(p1, '150-0002'); // 番地なし
  await doConvert(p1);
  const t1 = (await p1.textContent('#result-text')).trim();
  log('TC-E-001a', t1.includes('JAPAN') && !hasKana(t1), '番地なしでクラッシュしない');
  await p1.close();

  // TC-E-001b: 英数字混在建物名
  const { page: p2 } = await freshPage(browser);
  await fillViaZip(p2, '150-0002', '1丁目2番3号', 'ABC-123ビル10F');
  await doConvert(p2);
  const t2 = (await p2.textContent('#result-text')).trim();
  log('TC-E-001b', !t2.includes('undefined'), '英数字混在建物名: undefinedなし');
  await p2.close();

  // TC-E-001c: 郡部住所（西多摩郡奥多摩町）
  const { page: p3 } = await freshPage(browser);
  await fillViaZip(p3, '198-0212', '212');
  await doConvert(p3);
  const t3 = (await p3.textContent('#result-text')).trim();
  log('TC-E-001c', t3.includes('JAPAN') && !hasKana(t3), `郡部住所変換OK ("${t3.split('\n')[0]}")`);
  await p3.close();

  // TC-E-004: 変換中ボタン無効化（連打防止）
  const { page: p4 } = await freshPage(browser);
  await fillViaZip(p4, '150-0002', '1丁目2番3号');
  await p4.click('#btn-convert');
  await p4.waitForTimeout(100).catch(() => {});
  const disabledDuring = await p4.evaluate(() => {
    const btn = document.getElementById('btn-convert');
    return btn && (btn.disabled || btn.getAttribute('aria-disabled') === 'true');
  });
  log('TC-E-004', disabledDuring, '変換中ボタン無効化');
  await doConvert(p4).catch(() => {});
  await p4.close();
}

// ── TC-N: 非機能テスト ───────────────────────────────────────────
console.log('\n── TC-N: 非機能テスト ──');
{
  // TC-N-001: SP (375px) レイアウト
  const { page: mobile } = await freshPage(browser);
  await mobile.setViewportSize({ width: 375, height: 812 });
  await mobile.reload({ waitUntil: 'domcontentloaded' });

  const tabsScroll = await mobile.evaluate(() => {
    const el = document.querySelector('.lang-tabs');
    return el && getComputedStyle(el).overflowX === 'auto';
  });
  log('TC-N-001a', tabsScroll, 'SP: 言語タブ横スクロール');

  const oneCol = await mobile.evaluate(() => {
    const el = document.querySelector('.form-row');
    if (!el) return false;
    const cols = getComputedStyle(el).gridTemplateColumns;
    return !cols.includes(' '); // 1fr は空白なし
  });
  log('TC-N-001b', oneCol, 'SP: フォーム1カラム');

  const btnFull = await mobile.evaluate(() => {
    const btn = document.getElementById('btn-convert');
    if (!btn) return false;
    const bw = btn.getBoundingClientRect().width;
    // .form-actions コンテナ幅と一致すれば width:100% が効いている
    const fa = document.querySelector('.form-actions');
    if (fa) {
      const fw = fa.getBoundingClientRect().width;
      return Math.abs(bw - fw) < 2; // ピクセル誤差 2px 以内
    }
    return bw >= window.innerWidth * 0.7;
  });
  log('TC-N-001c', btnFull, 'SP: 変換ボタン全幅 (width:100% of .form-actions)');
  await mobile.close();

  // TC-N-004: <noscript> タグ存在
  const { page: ns } = await freshPage(browser);
  const hasNoscript = await ns.evaluate(() => document.querySelectorAll('noscript').length > 0);
  log('TC-N-004', hasNoscript, '<noscript>タグ存在');
  await ns.close();

  // TC-N-005: 自サーバーへの住所データ送信なし
  const { page: netPage } = await freshPage(browser);
  const unknownReqs = [];
  const allowedHosts = [
    'localhost', 'zipcloud', 'googleapis', 'fonts.g', 'deepl',
    'pagead2', 'openstreetmap', 'nominatim',
    'gstatic.com',          // Google Maps タイル・アセット
    'adtrafficquality',     // Google AdSense トラッキング（AdSense scriptから）
    'google.com/recaptcha', // Google reCAPTCHA（AdSense から）
    'doubleclick',          // Google 広告
  ];
  netPage.on('request', req => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    const allowed = allowedHosts.some(h => url.includes(h));
    if (!allowed) unknownReqs.push(url);
  });
  await fillViaZip(netPage, '150-0002', '1丁目2番3号');
  await doConvert(netPage);
  log('TC-N-005', unknownReqs.length === 0,
    unknownReqs.length > 0 ? `不明リクエスト: ${unknownReqs.join(' ')}` : '不審な外部送信なし');
  await netPage.close();
}

// ── lint ─────────────────────────────────────────────────────────
console.log('\n── npm run lint ──');
{
  const { execSync } = await import('child_process');
  try {
    execSync('npm run lint', { cwd: new URL('.', import.meta.url), stdio: 'pipe' });
    log('TC-N-lint', true, 'ESLint エラー 0');
  } catch (e) {
    log('TC-N-lint', false, `ESLint エラーあり: ${e.stdout?.toString().slice(0, 100)}`);
  }
}

// ═══════════════════════════════════════════════════════════════
await browser.close();

console.log('\n' + '═'.repeat(55));
console.log(`  TOTAL: ${passed + failed} / PASS: ${passed} / FAIL: ${failed}`);
if (failed > 0) {
  console.log('\n  失敗:');
  failList.forEach(f => console.log(`    ✗ ${f}`));
}
console.log('═'.repeat(55));
process.exit(failed > 0 ? 1 : 0);
