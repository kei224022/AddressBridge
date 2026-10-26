/** 住所入力・郵便番号補完・入力検証を管理する。 */
import { ZipCloud } from './zipcloud.js';

export function createAddressForm(showSnackbar) {
  const inputZip   = document.getElementById('input-zip');
  const inputPref  = document.getElementById('input-pref');
  const inputCity  = document.getElementById('input-city');
  const inputTown  = document.getElementById('input-town');
  const inputBldg  = document.getElementById('input-bldg');
  let storedKana = { prefKana: '', cityKana: '', townKana: '' };

  inputZip.addEventListener('input', onZipInput);

  // 入力時にエラーをクリア
  ['zip', 'pref', 'city', 'town'].forEach(key => {
    document.getElementById(`input-${key}`)
      ?.addEventListener('input', () => clearFieldError(key));
  });

  // 都道府県・市区町村を手動変更した場合はカナをリセット
  inputPref.addEventListener('input', () => { storedKana.prefKana = ''; });
  inputCity.addEventListener('input', () => { storedKana.cityKana = ''; });

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

  function read() {
    return {
      zip:  ZipCloud.normalizeZip(inputZip.value),
      pref: inputPref.value.trim(),
      city: inputCity.value.trim(),
      town: inputTown.value.trim(),
      bldg: inputBldg.value.trim(),
      ...storedKana,
    };
  }

  return { read, validate };
}
