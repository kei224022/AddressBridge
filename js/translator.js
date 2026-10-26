/**
 * translator.js
 * DeepL API 連携（建物名翻訳）
 *
 * 対象: 建物名・部屋番号フィールドのみ。
 * API キー未設定またはエラー時は null を返しローマ字フォールバックを使用する。
 */

import { DEEPL_API_KEY } from './config.js';
import { CONVERSION_LOCALES } from './locales.js';

const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';

/**
 * ロケールコードから DeepL ターゲット言語コードへのマッピング。
 * ca-en は EN-US、ca-fr は FR として扱う。
 * kr-aux / tw-aux は kr / tw と同言語。
 */
const LOCALE_TO_LANG = Object.fromEntries(
  CONVERSION_LOCALES.map(({ locale, language }) => [locale, language])
);

/**
 * テキストを指定言語に翻訳する。
 * DEEPL_API_KEY が空、またはネットワーク障害・API エラー時は null を返す。
 *
 * @param {string} text       - 翻訳対象テキスト
 * @param {string} targetLang - DeepL ターゲット言語コード (例: 'EN-US', 'KO')
 * @returns {Promise<string|null>}
 */
async function translate(text, targetLang) {
  if (!DEEPL_API_KEY || !text) return null;
  try {
    const res = await fetch(DEEPL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [text], target_lang: targetLang }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data.translations?.[0]?.text ?? null;
    // 翻訳結果にひらがな・カタカナが残っている場合はローマ字フォールバックに委ねる
    if (translated && /[぀-ヿ]/.test(translated)) return null;
    return translated;
  } catch {
    return null;
  }
}

export const DeepL = { translate, LOCALE_TO_LANG };
export default DeepL;
