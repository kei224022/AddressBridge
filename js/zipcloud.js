/**
 * zipcloud.js
 * 郵便番号API連携・住所補完・住所検証
 */

const ZIPCLOUD_URL = 'https://zipcloud.ibsnet.co.jp/api/search';

/**
 * 入力文字列を7桁数字に正規化する（全角・ハイフン・スペースを除去）。
 * 7桁未満の場合は空文字列を返す。
 *
 * @param {string} input
 * @returns {string}
 */
function normalizeZip(input) {
  if (!input) return '';
  const norm = String(input).normalize('NFKC');
  const digits = norm.replace(/[^0-9]/g, '');
  return digits.length >= 7 ? digits.slice(0, 7) : '';
}

/**
 * 郵便番号から住所情報を取得する。
 * ネットワーク障害時・API エラー時は null を返す（例外をスローしない）。
 *
 * @param {string} zipcode - 7桁数字（ハイフンあり/なし両対応）
 * @returns {Promise<ZipResult|null>}
 */
async function lookup(zipcode) {
  const zip = normalizeZip(zipcode);
  if (!zip) return null;
  try {
    const res = await fetch(`${ZIPCLOUD_URL}?zipcode=${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || !data.results[0]) return null;
    const r = data.results[0];
    return {
      zipcode:  r.zipcode,
      pref:     r.address1,
      city:     r.address2,
      town:     r.address3,
      prefKana: r.kana1,
      cityKana: r.kana2,
      townKana: r.kana3,
      prefcode: r.prefcode,
    };
  } catch {
    return null;
  }
}

/**
 * 郵便番号と入力した都道府県・市区町村の整合性を検証する。
 *
 * @param {string} zipcode
 * @param {string} pref
 * @param {string} city
 * @returns {Promise<'match'|'mismatch'|'skip'>}
 */
async function validate(zipcode, pref, city) {
  try {
    const result = await lookup(zipcode);
    if (!result) return 'mismatch';
    if (result.pref === pref && result.city === city) return 'match';
    return 'mismatch';
  } catch {
    return 'skip';
  }
}

export const ZipCloud = { normalizeZip, lookup, validate };
export default ZipCloud;
