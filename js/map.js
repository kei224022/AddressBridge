/**
 * map.js
 * Leaflet地図操作モジュール
 */

let map    = null;
let marker = null;

/**
 * 地図を初期化する。
 *
 * @param {string} elementId - 地図を描画する DOM 要素の ID
 */
function init(elementId) {
  map = L.map(elementId).setView([36.2, 138.2], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:     19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

/**
 * 指定座標にマーカーを立て、地図エリアを表示する。
 *
 * @param {number} lat
 * @param {number} lon
 * @param {string} label - ポップアップに表示するテキスト
 */
function show(lat, lon, label) {
  const section = document.getElementById('map-section');
  if (section) section.style.display = '';

  const errEl = document.getElementById('map-error');
  if (errEl) errEl.style.display = 'none';

  if (marker) {
    marker.setLatLng([lat, lon]).setPopupContent(label);
  } else {
    marker = L.marker([lat, lon]).addTo(map).bindPopup(label);
  }

  map.setView([lat, lon], 15);
  marker.openPopup();
  // display:none から表示に切り替わった直後にサイズを再計算させる
  setTimeout(() => map.invalidateSize(), 0);
}

/**
 * 地図エリアを非表示にする。
 */
function hide() {
  const section = document.getElementById('map-section');
  if (section) section.style.display = 'none';
}

/**
 * ジオコーディング失敗時のエラー表示に切り替える。
 */
function showError() {
  const section = document.getElementById('map-section');
  if (section) section.style.display = '';

  const errEl = document.getElementById('map-error');
  if (errEl) errEl.style.display = '';

  if (map) setTimeout(() => map.invalidateSize(), 0);
}

export const MapController = { init, show, hide, showError };
export default MapController;
