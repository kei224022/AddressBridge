/**
 * geocoder.js
 * Google Maps Geocoding API連携（住所→緯度経度）
 */

import { GOOGLE_MAPS_API_KEY } from './config.js';

const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * 住所オブジェクトから検索クエリ文字列を生成する。
 *
 * @param {{pref:string, city:string, town:string}} address
 * @returns {string}
 */
function buildGeoQuery(address) {
  return [address.town, address.city, address.pref, '日本']
    .filter(Boolean)
    .join(', ');
}

/**
 * 住所オブジェクトから緯度経度を取得する。
 * ヒットなし・ネットワーク障害時は null を返す（例外をスローしない）。
 *
 * @param {{pref:string, city:string, town:string}} address
 * @returns {Promise<{lat:number, lon:number}|null>}
 */
async function search(address) {
  const q = buildGeoQuery(address);
  try {
    const url = `${GEOCODING_URL}?address=${encodeURIComponent(q)}&key=${GOOGLE_MAPS_API_KEY}&language=ja&region=JP`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.results || data.results.length === 0) return null;
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lon: lng };
  } catch {
    return null;
  }
}

export const Geocoder = { search };
export default Geocoder;
