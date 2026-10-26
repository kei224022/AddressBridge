/**
 * map.js
 * Google Maps JavaScript API 地図操作モジュール
 */

let map        = null;
let marker     = null;
let infoWindow = null;

/**
 * 地図を初期化する。Google Maps JS API の callback=initMap から呼ばれる。
 *
 * @param {string} elementId - 地図を描画する DOM 要素の ID
 */
function init(elementId) {
  map = new google.maps.Map(document.getElementById(elementId), {
    center: { lat: 36.2, lng: 138.2 },
    zoom: 5,
  });
  infoWindow = new google.maps.InfoWindow();
}

/**
 * 指定座標にマーカーを立て、地図エリアを表示する。
 *
 * @param {number} lat
 * @param {number} lon
 * @param {string} label - InfoWindow に表示するテキスト
 */
function show(lat, lon, label) {
  if (!map) {
    showError();
    return;
  }

  const section = document.getElementById('map-section');
  if (section) section.style.display = '';

  const errEl = document.getElementById('map-error');
  if (errEl) errEl.style.display = 'none';

  const position = { lat, lng: lon };

  if (marker) {
    marker.setPosition(position);
  } else {
    marker = new google.maps.Marker({ position, map });
    marker.addListener('click', () => infoWindow.open({ anchor: marker, map }));
  }

  const content = document.createElement('div');
  content.textContent = label;
  infoWindow.setContent(content);
  map.setCenter(position);
  map.setZoom(15);
  infoWindow.open({ anchor: marker, map });
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
}

export const MapController = { init, show, hide, showError };
export default MapController;
