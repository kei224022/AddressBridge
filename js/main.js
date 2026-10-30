/** アプリケーションの初期化と住所変換フロー。 */
import { ZipCloud } from './zipcloud.js';
import { Geocoder } from './geocoder.js';
import { convertAll } from './converter.js';
import { MapController } from './map.js';
import { createAddressForm } from './address-form.js';
import { createResultView } from './result-view.js';
import { bindCopyButtons } from './clipboard.js';
import { createSnackbar, setLoading } from './ui.js';

const btnConvert = document.getElementById('btn-convert');
const warningEl = document.getElementById('warning-banner');
const form = createAddressForm(createSnackbar(document.getElementById('snackbar')));
const results = createResultView();
let conversionId = 0;

// async API と ES Module のどちらが先に読み込まれても初期化できるようにする。
if (window._mapsApiReady) {
  MapController.init('map-container');
} else {
  window.initMap = () => MapController.init('map-container');
}

bindCopyButtons(results.getText);
btnConvert.addEventListener('click', onConvert);

async function onConvert() {
  if (btnConvert.disabled || !form.validate()) return;

  const requestId = ++conversionId;
  setLoading(btnConvert, true, '変換中...');
  warningEl.style.display = 'none';
  const address = form.read();
  MapController.showLoading();

  try {
    const validation = await ZipCloud.validate(address.zip, address.pref, address.city);
    if (validation === 'mismatch') warningEl.style.display = '';

    const converted = await convertAll(address);
    results.render(address, converted);
    document.getElementById('result-section').scrollIntoView({ behavior: 'smooth' });
    // 地図の待機中もコピー・タブ操作・次の変換を利用できるようにする。
    void updateMap(address, requestId);
  } finally {
    setLoading(btnConvert, false);
  }
}

async function updateMap(address, requestId) {
  try {
    const position = await Geocoder.search(address);
    if (requestId !== conversionId) return;
    if (position) {
      const label = [address.pref, address.city, address.town, address.bldg]
        .filter(Boolean).join('');
      MapController.show(position.lat, position.lon, label);
    } else {
      MapController.showError();
    }
  } catch {
    if (requestId === conversionId) MapController.showError();
  }
}
