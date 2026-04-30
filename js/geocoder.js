/**
 * geocoder.js
 * Nominatim API連携（住所→緯度経度）
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT    = 'AddressBridge/1.0 (ishikawa224022@gmail.com)';

/**
 * 住所オブジェクトから Nominatim 検索クエリ文字列を生成する。
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
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=jp`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':      USER_AGENT,
        'Accept-Language': 'ja',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export const Geocoder = { search };
export default Geocoder;
