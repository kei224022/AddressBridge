/**
 * main.js
 * アプリケーションのエントリーポイント。各モジュールを統合しイベントを管理する。
 */

import { ZipCloud }      from './zipcloud.js';
import { Geocoder }      from './geocoder.js';
import { convertAll }    from './converter.js';
import { MapController } from './map.js';

// ─── DOM 参照 ────────────────────────────────────────────────────────────────

const inputZip   = document.getElementById('input-zip');
const inputPref  = document.getElementById('input-pref');
const inputCity  = document.getElementById('input-city');
const inputTown  = document.getElementById('input-town');
const inputBldg  = document.getElementById('input-bldg');
const btnConvert = document.getElementById('btn-convert');
const warningEl   = document.getElementById('warning-banner');
const snackbarEl  = document.getElementById('snackbar');

const resultSection  = document.getElementById('result-section');
const previewSection = document.getElementById('preview-section');
const resultTextEl   = document.getElementById('result-text');
const resultAuxEl    = document.getElementById('result-aux');
const auxTextEl      = document.getElementById('aux-text');
const resultLangEl   = document.getElementById('result-lang-label');
const previewLocaleEl = document.getElementById('preview-locale-label');

// ─── 定数 ────────────────────────────────────────────────────────────────────

const LOCALE_LABEL = {
  'us':    'American English',
  'uk':    'British English',
  'fr':    'French',
  'de':    'German',
  'it':    'Italian',
  'ca-en': 'Canadian English',
  'ca-fr': 'Canadian French',
  'kr':    '한국어',
  'tw':    '繁體中文',
};

const LOCALE_KEY = {
  'us':    'us',
  'uk':    'uk',
  'fr':    'fr',
  'de':    'de',
  'it':    'it',
  'ca-en': 'caEn',
  'ca-fr': 'caFr',
  'kr':    'kr',
  'tw':    'tw',
};

const LOCALE_AUX_KEY = { 'kr': 'krAux', 'tw': 'twAux' };
const AUX_LOCALES    = new Set(['kr', 'tw']);

const FLAG_MAP = {
  'us': '🇺🇸', 'uk': '🇬🇧', 'fr': '🇫🇷', 'de': '🇩🇪', 'it': '🇮🇹',
  'ca-en': '🇨🇦', 'ca-fr': '🇨🇦', 'kr': '🇰🇷', 'tw': '🇹🇼',
};

// ─── 状態 ────────────────────────────────────────────────────────────────────

let currentLocale  = 'us';
let convResult     = null;
let snackTimer     = null;
let storedKana     = { prefKana: '', cityKana: '', townKana: '' };

// ─── 初期化 ──────────────────────────────────────────────────────────────────

// Google Maps API が async で先に読み込まれた場合と、モジュールが先に実行された場合の
// 両方に対応するため _mapsApiReady フラグで判定する
if (window._mapsApiReady) {
  MapController.init('map-container');
} else {
  window.initMap = () => MapController.init('map-container');
}

// ─── イベント登録 ─────────────────────────────────────────────────────────────

inputZip.addEventListener('input', onZipInput);
btnConvert.addEventListener('click', onConvert);

// 入力時にエラーをクリア
['zip', 'pref', 'city', 'town'].forEach(key => {
  document.getElementById(`input-${key}`)
    ?.addEventListener('input', () => clearFieldError(key));
});

// 都道府県・市区町村を手動変更した場合はカナをリセット
inputPref.addEventListener('input', () => { storedKana.prefKana = ''; });
inputCity.addEventListener('input', () => { storedKana.cityKana = ''; });

// 言語タブ
document.querySelectorAll('.lang-tab').forEach(btn => {
  btn.addEventListener('click', () => onTabChange(btn.dataset.locale));
});

// プレビュータブ
document.querySelectorAll('.preview-tab').forEach(btn => {
  btn.addEventListener('click', () => onPreviewChange(btn.dataset.preview));
});

// コピーボタン
['copy-result', 'copy-envelope', 'copy-postcard', 'copy-label'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => onCopy(id));
});

// ─── 郵便番号入力 ──────────────────────────────────────────────────────────────

function onZipInput() {
  const raw = inputZip.value.replace(/[^0-9]/g, '').slice(0, 7);
  const formatted = raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
  if (inputZip.value !== formatted) inputZip.value = formatted;
  if (raw.length === 7) doAutocomplete();
}

async function doAutocomplete() {
  const zip = ZipCloud.normalizeZip(inputZip.value);
  if (!zip) return;

  try {
    const result = await ZipCloud.lookup(zip);
    if (result) {
      inputPref.value = result.pref;
      inputCity.value = result.city;
      if (result.town) inputTown.value = result.town;
      storedKana = {
        prefKana: result.prefKana,
        cityKana: result.cityKana,
        townKana: result.townKana,
      };
      clearFieldError('pref');
      clearFieldError('city');
      inputTown.focus();
      // 追記しやすいようカーソルを末尾へ移動する
      inputTown.setSelectionRange(inputTown.value.length, inputTown.value.length);
    } else {
      showSnackbar('郵便番号が見つかりませんでした');
    }
  } catch {
    showSnackbar('郵便番号の補完に失敗しました');
  }
}

// ─── バリデーション ───────────────────────────────────────────────────────────

function validate() {
  const fields = [
    ['zip',  inputZip,  '郵便番号を入力してください'],
    ['pref', inputPref, '都道府県を入力してください'],
    ['city', inputCity, '市区町村を入力してください'],
    ['town', inputTown, '町名・番地を入力してください'],
  ];
  let valid = true;
  for (const [key, el, msg] of fields) {
    if (!el.value.trim()) {
      showFieldError(key, msg);
      valid = false;
    } else {
      clearFieldError(key);
    }
  }
  return valid;
}

function showFieldError(key, msg) {
  document.getElementById(`input-${key}`)?.classList.add('error');
  const err = document.getElementById(`error-${key}`);
  if (err) err.textContent = msg;
}

function clearFieldError(key) {
  document.getElementById(`input-${key}`)?.classList.remove('error');
  const err = document.getElementById(`error-${key}`);
  if (err) err.textContent = '';
}

// ─── 変換処理 ─────────────────────────────────────────────────────────────────

async function onConvert() {
  if (!validate()) return;

  setLoading(btnConvert, true, '変換中...');
  warningEl.style.display = 'none';

  const addressInput = {
    zip:  ZipCloud.normalizeZip(inputZip.value),
    pref: inputPref.value.trim(),
    city: inputCity.value.trim(),
    town: inputTown.value.trim(),
    bldg: inputBldg.value.trim(),
    ...storedKana,
  };

  try {
    // 住所検証（zipcloud）
    const validation = await ZipCloud.validate(
      addressInput.zip, addressInput.pref, addressInput.city
    );
    if (validation === 'mismatch') warningEl.style.display = '';

    // 変換（全ロケール一括）
    convResult = await convertAll(addressInput);

    // ジオコーディング
    const pos = await Geocoder.search(addressInput);
    if (pos) {
      MapController.show(pos.lat, pos.lon, buildJaLabel(addressInput));
    } else {
      MapController.showError();
    }

    // 結果描画
    renderPreviews(addressInput);
    resultSection.style.display  = '';
    previewSection.style.display = '';

    onTabChange('us');
    onPreviewChange('envelope');

    // 地図エリアへスクロール
    const mapSection = document.getElementById('map-section');
    const scrollTo   = (mapSection && mapSection.style.display !== 'none')
      ? mapSection : resultSection;
    scrollTo.scrollIntoView({ behavior: 'smooth' });

  } finally {
    setLoading(btnConvert, false);
  }
}

// ─── ラベル・FROM住所生成 ────────────────────────────────────────────────────

function buildJaLabel(addr) {
  return [addr.pref, addr.city, addr.town, addr.bldg].filter(Boolean).join('');
}

function buildFromAddress(addr) {
  const zipFmt = addr.zip.length === 7
    ? `〒${addr.zip.slice(0, 3)}-${addr.zip.slice(3)}`
    : `〒${addr.zip}`;
  const main = [addr.pref, addr.city, addr.town].filter(Boolean).join('');
  return [zipFmt, main, addr.bldg].filter(Boolean).join('\n');
}

// ─── 描画 ─────────────────────────────────────────────────────────────────────

function renderPreviews(addressInput) {
  const fromAddr = buildFromAddress(addressInput);
  const fromEl   = document.getElementById('from-address');
  const labelFrom = document.getElementById('label-from');
  if (fromEl) fromEl.textContent   = fromAddr;
  if (labelFrom) labelFrom.textContent = fromAddr;
}

function getResultText(locale) {
  if (!convResult) return '';
  return convResult[LOCALE_KEY[locale]] ?? '';
}

function getAuxText(locale) {
  if (!convResult) return '';
  return convResult[LOCALE_AUX_KEY[locale]] ?? '';
}

// ─── タブ切り替え ────────────────────────────────────────────────────────────

function onTabChange(locale) {
  currentLocale = locale;

  // タブ UI 更新
  document.querySelectorAll('.lang-tab').forEach(btn => {
    const active = btn.dataset.locale === locale;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  // 結果テキスト更新
  const text = getResultText(locale);
  resultTextEl.textContent = text;
  if (resultLangEl) resultLangEl.textContent = LOCALE_LABEL[locale] ?? '';

  // 補助表示（KR / TW のみ）
  if (AUX_LOCALES.has(locale)) {
    auxTextEl.textContent = getAuxText(locale);
    resultAuxEl.style.display = '';
  } else {
    resultAuxEl.style.display = 'none';
  }

  // プレビュー表示ラベル更新
  if (previewLocaleEl) {
    const flag = FLAG_MAP[locale] ?? '';
    previewLocaleEl.textContent = `(現在選択中: ${flag} ${locale.toUpperCase()})`;
  }

  // プレビュー住所更新
  updatePreviewAddresses(text);
}

function updatePreviewAddresses(text) {
  const ids = ['envelope-to-address', 'postcard-address', 'label-address'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
}

// ─── プレビュー切り替え ──────────────────────────────────────────────────────

function onPreviewChange(type) {
  document.querySelectorAll('.preview-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preview === type);
  });
  document.querySelectorAll('.preview-pane').forEach(pane => {
    pane.style.display = pane.id === `preview-${type}` ? '' : 'none';
  });
}

// ─── コピー ──────────────────────────────────────────────────────────────────

function onCopy(btnId) {
  const text = getResultText(currentLocale);
  const btn  = document.getElementById(btnId);
  const orig = btnId === 'copy-result' ? '📋 コピー' : '📋 宛先住所をコピー';

  const writeText = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // フォールバック: execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      Object.assign(ta.style, { position: 'fixed', opacity: '0' });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (btn) {
      btn.textContent = '✓ コピーしました';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
  };

  writeText();
}

// ─── UI ヘルパー ──────────────────────────────────────────────────────────────

function setLoading(btn, loading, loadingText = '') {
  if (loading) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.innerHTML = loadingText
      ? `<span class="spinner"></span>${loadingText}`
      : '<span class="spinner"></span>';
  } else {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    if (btn === btnConvert) btn.textContent = '変換する';
  }
}

function showSnackbar(msg) {
  if (snackTimer) clearTimeout(snackTimer);
  snackbarEl.textContent = msg;
  snackbarEl.classList.add('show');
  snackTimer = setTimeout(() => snackbarEl.classList.remove('show'), 3000);
}
