/**
 * zipcloud.js
 * 郵便番号API連携・住所補完・住所検証
 */

import { fetchJson, API_TIMEOUT_MS } from './http.js';

const ZIPCLOUD_URL = 'https://zipcloud.ibsnet.co.jp/api/search';

/**
 * 全角を NFKC 正規化し、空白を除去する。文字や余分な桁は捨てない。
 */
function compactZip(input) {
  return String(input ?? '').normalize('NFKC').replace(/\s/g, '');
}

/** 入力表示用の整形。数字だけなら4桁目以降の前にハイフンを挿入する。 */
function formatZipInput(input) {
  const compact = compactZip(input);
  return /^[0-9]{4,}$/.test(compact) ? `${compact.slice(0, 3)}-${compact.slice(3)}` : compact;
}

/**
 * 7桁数字、または3桁-4桁の表記のみを7桁数字に正規化する。
 * 桁不足・桁超過・文字混在・不正なハイフンは空文字列を返す。
 *
 * @param {string} input
 * @returns {string}
 */
function normalizeZip(input) {
  const compact = compactZip(input);
  return /^[0-9]{3}-?[0-9]{4}$/.test(compact) ? compact.replace('-', '') : '';
}

/**
 * 郵便番号を検索し、該当なしと通信/API エラーを区別する。
 *
 * @param {string} zipcode - 7桁数字（ハイフンあり/なし両対応）
 * @returns {Promise<{status: 'success', address: object}|{status: 'not-found'|'error'}>}
 */
async function lookupDetailed(zipcode) {
  const zip = normalizeZip(zipcode);
  if (!zip) return { status: 'not-found' };
  try {
    const data = await fetchJson(`${ZIPCLOUD_URL}?zipcode=${zip}`, { timeoutMs: API_TIMEOUT_MS.zipcloud });
    if (!data || data.status !== 200) return { status: 'error' };
    if (data.results === null || (Array.isArray(data.results) && data.results.length === 0)) {
      return { status: 'not-found' };
    }
    if (!Array.isArray(data.results)) return { status: 'error' };
    const r = data.results[0];
    if (!r || typeof r.address1 !== 'string' || !r.address1 ||
        typeof r.address2 !== 'string' || !r.address2 || typeof r.address3 !== 'string') {
      return { status: 'error' };
    }
    return {
      status: 'success',
      address: {
        zipcode:  r.zipcode,
        pref:     r.address1,
        city:     r.address2,
        town:     r.address3,
        prefKana: r.kana1,
        cityKana: r.kana2,
        townKana: r.kana3,
        prefcode: r.prefcode,
      },
    };
  } catch {
    return { status: 'error' };
  }
}

/** 既存の住所オブジェクト / null を返す API は互換性を維持する。 */
async function lookup(zipcode) {
  const result = await lookupDetailed(zipcode);
  return result.status === 'success' ? result.address : null;
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
  const result = await lookupDetailed(zipcode);
  if (result.status === 'error') return 'skip';
  if (result.status === 'not-found') return 'mismatch';
  return result.address.pref === pref && result.address.city === city ? 'match' : 'mismatch';
}

export const ZipCloud = { normalizeZip, formatZipInput, lookup, lookupDetailed, validate };
export default ZipCloud;
