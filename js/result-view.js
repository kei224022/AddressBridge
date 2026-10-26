/** 変換結果・言語タブ・宛先プレビューの描画を管理する。 */
import { LOCALE_CONFIG } from './locales.js';

export function createResultView() {
  const resultSection  = document.getElementById('result-section');
  const previewSection = document.getElementById('preview-section');
  const resultTextEl   = document.getElementById('result-text');
  const resultAuxEl    = document.getElementById('result-aux');
  const auxTextEl      = document.getElementById('aux-text');
  const resultLangEl   = document.getElementById('result-lang-label');
  const previewLocaleEl = document.getElementById('preview-locale-label');

  let currentLocale = 'us';
  let convResult = null;

  // 言語タブ
  document.querySelectorAll('.lang-tab').forEach(btn => {
    btn.addEventListener('click', () => onTabChange(btn.dataset.locale));
  });

  // プレビュータブ
  document.querySelectorAll('.preview-tab').forEach(btn => {
    btn.addEventListener('click', () => onPreviewChange(btn.dataset.preview));
  });

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
    return convResult[LOCALE_CONFIG[locale]?.resultKey] ?? '';
  }

  function getAuxText(locale) {
    if (!convResult) return '';
    return convResult[LOCALE_CONFIG[locale]?.auxKey] ?? '';
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
    if (resultLangEl) resultLangEl.textContent = LOCALE_CONFIG[locale]?.label ?? '';

    // 補助表示（KR / TW のみ）
    if (LOCALE_CONFIG[locale]?.auxKey) {
      auxTextEl.textContent = getAuxText(locale);
      resultAuxEl.style.display = '';
    } else {
      resultAuxEl.style.display = 'none';
    }

    // プレビュー表示ラベル更新
    if (previewLocaleEl) {
      const flag = LOCALE_CONFIG[locale]?.flag ?? '';
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

  function render(address, result) {
    convResult = result;
    renderPreviews(address);
    resultSection.style.display = '';
    previewSection.style.display = '';
    onTabChange('us');
    onPreviewChange('envelope');
  }

  return { render, getText: () => getResultText(currentLocale) };
}
