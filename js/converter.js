/**
 * converter.js
 * 住所変換メインロジック
 *
 * AddressInput → ParsedAddress → 各国フォーマット文字列
 *
 * 設計方針:
 *   - parseAddress() で一度だけ中間形式 ParsedAddress を生成する
 *   - 各ロケール固有の現地語地名（KR: 韓国語 / TW: 繁体字）は
 *     convertTo() / convertAll() 内で付与し、フォーマット関数に渡す
 *   - 都道府県ローマ字は「接尾語なし（prefRoman）」と
 *     「接尾語あり（prefRomanFull）」の2種を用意する
 *       - 欧米フォーマット → prefRoman  (例: Tokyo)
 *       - KR メイン       → prefRomanFull (例: Tokyo-to)
 *       - TW / KR補助    → prefLocal  (例: 東京都 / 도쿄도)
 */

import { convert, convertBanchi, convertBldg } from './romanize.js';
import { get as getFormat, lookupKr, toTraditional } from './formats.js';
import { DeepL } from './translator.js';

// ─── 都道府県 接尾語テーブル ─────────────────────────────────────────────────

/**
 * 都道府県の末尾漢字から「ローマ字接尾語」と「カナ接尾語の文字数」を返す。
 * 道（北海道）は ou→o の長音圧縮で自然に処理されるため kanaLen = 0。
 */
const PREF_SUFFIX = {
  '都': { roman: '-to',  kanaLen: 1 },
  '道': { roman: '',     kanaLen: 0 },
  '府': { roman: '-fu',  kanaLen: 1 },
  '県': { roman: '-ken', kanaLen: 2 },
};

/**
 * カナが取得できない場合の都道府県ローマ字フォールバック（47都道府県固定値）。
 * zipcloud 補完済みの通常フローでは使用しない。
 */
const PREF_FALLBACK = {
  '北海道': { short: 'Hokkaido',   suffix: '' },
  '青森県': { short: 'Aomori',     suffix: '-ken' },
  '岩手県': { short: 'Iwate',      suffix: '-ken' },
  '宮城県': { short: 'Miyagi',     suffix: '-ken' },
  '秋田県': { short: 'Akita',      suffix: '-ken' },
  '山形県': { short: 'Yamagata',   suffix: '-ken' },
  '福島県': { short: 'Fukushima',  suffix: '-ken' },
  '茨城県': { short: 'Ibaraki',    suffix: '-ken' },
  '栃木県': { short: 'Tochigi',    suffix: '-ken' },
  '群馬県': { short: 'Gunma',      suffix: '-ken' },
  '埼玉県': { short: 'Saitama',    suffix: '-ken' },
  '千葉県': { short: 'Chiba',      suffix: '-ken' },
  '東京都': { short: 'Tokyo',      suffix: '-to'  },
  '神奈川県':{ short: 'Kanagawa',  suffix: '-ken' },
  '新潟県': { short: 'Niigata',    suffix: '-ken' },
  '富山県': { short: 'Toyama',     suffix: '-ken' },
  '石川県': { short: 'Ishikawa',   suffix: '-ken' },
  '福井県': { short: 'Fukui',      suffix: '-ken' },
  '山梨県': { short: 'Yamanashi',  suffix: '-ken' },
  '長野県': { short: 'Nagano',     suffix: '-ken' },
  '岐阜県': { short: 'Gifu',       suffix: '-ken' },
  '静岡県': { short: 'Shizuoka',   suffix: '-ken' },
  '愛知県': { short: 'Aichi',      suffix: '-ken' },
  '三重県': { short: 'Mie',        suffix: '-ken' },
  '滋賀県': { short: 'Shiga',      suffix: '-ken' },
  '京都府': { short: 'Kyoto',      suffix: '-fu'  },
  '大阪府': { short: 'Osaka',      suffix: '-fu'  },
  '兵庫県': { short: 'Hyogo',      suffix: '-ken' },
  '奈良県': { short: 'Nara',       suffix: '-ken' },
  '和歌山県':{ short: 'Wakayama',  suffix: '-ken' },
  '鳥取県': { short: 'Tottori',    suffix: '-ken' },
  '島根県': { short: 'Shimane',    suffix: '-ken' },
  '岡山県': { short: 'Okayama',    suffix: '-ken' },
  '広島県': { short: 'Hiroshima',  suffix: '-ken' },
  '山口県': { short: 'Yamaguchi',  suffix: '-ken' },
  '徳島県': { short: 'Tokushima',  suffix: '-ken' },
  '香川県': { short: 'Kagawa',     suffix: '-ken' },
  '愛媛県': { short: 'Ehime',      suffix: '-ken' },
  '高知県': { short: 'Kochi',      suffix: '-ken' },
  '福岡県': { short: 'Fukuoka',    suffix: '-ken' },
  '佐賀県': { short: 'Saga',       suffix: '-ken' },
  '長崎県': { short: 'Nagasaki',   suffix: '-ken' },
  '熊本県': { short: 'Kumamoto',   suffix: '-ken' },
  '大分県': { short: 'Oita',       suffix: '-ken' },
  '宮崎県': { short: 'Miyazaki',   suffix: '-ken' },
  '鹿児島県':{ short: 'Kagoshima', suffix: '-ken' },
  '沖縄県': { short: 'Okinawa',    suffix: '-ken' },
};

// ─── 市区町村 接尾語テーブル（カナ末尾で判定、長い順に並べる）────────────────

const CITY_KANA_SUFFIXES = [
  { kana: 'チョウ', roman: '-cho'   },
  { kana: 'マチ',   roman: '-machi' },
  { kana: 'ムラ',   roman: '-mura'  },
  { kana: 'グン',   roman: '-gun'   },
  { kana: 'シ',     roman: '-shi'   },
  { kana: 'ク',     roman: '-ku'    },
];

// カナなし時の漢字末尾から接尾語を推定するテーブル
const CITY_KANJI_SUFFIX = {
  '区': '-ku',
  '市': '-shi',
  '村': '-mura',
  '郡': '-gun',
  '町': '-machi',
};

// ─── ヘルパー関数 ────────────────────────────────────────────────────────────

/**
 * 7桁数字の郵便番号を "NNN-NNNN" 形式に整形する。
 * すでにハイフン入りの場合はそのまま返す。
 */
function formatZip(zip) {
  const digits = String(zip).replace(/\D/g, '');
  return digits.length === 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
}

/**
 * 都道府県カナと漢字から { prefRoman, prefRomanFull } を生成する。
 *
 * prefRoman     : 接尾語なし（欧米フォーマット用）  例: "Tokyo"
 * prefRomanFull : 接尾語あり（KRメイン用）         例: "Tokyo-to"
 */
function buildPrefRoman(pref, prefKana) {
  // カナあり → カナから変換
  if (prefKana) {
    const lastKanji = pref.slice(-1);
    const sfx = PREF_SUFFIX[lastKanji];

    if (!sfx || sfx.kanaLen === 0) {
      // 北海道など: 長音圧縮で "Hokkaido" になる。接尾語ハイフンは不要
      const roman = convert(prefKana);
      return { prefRoman: roman, prefRomanFull: roman };
    }

    const baseKana = prefKana.length > sfx.kanaLen
      ? prefKana.slice(0, -sfx.kanaLen)
      : prefKana;
    const roman = convert(baseKana);
    return { prefRoman: roman, prefRomanFull: roman + sfx.roman };
  }

  // カナなし → フォールバックテーブル
  const fb = PREF_FALLBACK[pref];
  if (fb) {
    return { prefRoman: fb.short, prefRomanFull: fb.short + fb.suffix };
  }

  return { prefRoman: '', prefRomanFull: '' };
}

/**
 * 市区町村カナから行政区分接尾語を付与したローマ字を生成する。
 * カナがない場合は漢字末尾で接尾語を推定し、名前部分に含まれるカナをローマ字化する。
 *
 * @param {string} cityKana - 市区町村カナ（zipcloud から取得）
 * @param {string} [city]   - 市区町村漢字（カナなし時のフォールバック用）
 */
function buildCityRoman(cityKana, city = '') {
  if (cityKana) {
    for (const { kana, roman } of CITY_KANA_SUFFIXES) {
      if (cityKana.endsWith(kana) && cityKana.length > kana.length) {
        return convert(cityKana.slice(0, -kana.length)) + roman;
      }
    }
    return convert(cityKana);
  }

  // カナなし → 漢字末尾から接尾語を推定し、名前部分のカナをローマ字化する
  if (!city) return '';
  const lastChar = city.slice(-1);
  const suffix   = CITY_KANJI_SUFFIX[lastChar] ?? '';
  const nameStr  = suffix ? city.slice(0, -1) : city;
  return convert(nameStr) + suffix;
}

/**
 * town フィールド先頭のカナ部分を抽出してローマ字化する（カナなし時のフォールバック）。
 * 例: 'なんば1丁目2番3号' → 'Namba'、'渋谷1丁目2番3号' → ''
 *
 * @param {string} town
 * @returns {string}
 */
function extractTownName(town) {
  const match = String(town).match(/^[ぁ-んァ-ヶー]+/);
  return match ? convert(match[0]) : '';
}

/**
 * `town` フィールド（例: "渋谷1丁目2番3号"）から番地部分を切り出す。
 * 先頭の漢字・かな列を除去し、数字で始まる部分から convertBanchi に渡す。
 *
 * String.prototype.normalize('NFKC') を使って全角英数字を半角に統一してから
 * 先頭の非数字部分を除去する（MDN: String.normalize）。
 */
function extractBanchi(town) {
  const normalized = String(town).normalize('NFKC');
  const numericPart = normalized.replace(/^[^\d-]+/, '');
  return convertBanchi(numericPart);
}

/**
 * ロケールに応じた現地語地名を返す（漢字テキストを受け取る）。
 *
 * @param {string} pref  都道府県（漢字）
 * @param {string} city  市区町村（漢字）
 * @param {string} locale
 * @returns {{ prefLocal: string, cityLocal: string }}
 */
function getLocalNames(pref, city, locale) {
  if (locale === 'kr' || locale === 'kr-aux') {
    return {
      prefLocal: lookupKr(pref) ?? '',
      cityLocal: lookupKr(city) ?? '',
    };
  }
  if (locale === 'tw' || locale === 'tw-aux') {
    return {
      prefLocal: toTraditional(pref),
      cityLocal: toTraditional(city),
    };
  }
  return { prefLocal: '', cityLocal: '' };
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * AddressInput を解析して中間形式 ParsedAddress に変換する。
 *
 * @typedef {Object} AddressInput
 * @property {string}  zip       - 郵便番号（7桁数字、ハイフンなし）
 * @property {string}  pref      - 都道府県名（漢字）
 * @property {string}  city      - 市区町村名（漢字）
 * @property {string}  town      - 町名・番地（漢字＋数字）
 * @property {string}  [bldg]    - 建物名・部屋番号（省略可）
 * @property {string}  [prefKana]- 都道府県カナ（zipcloud から取得）
 * @property {string}  [cityKana]- 市区町村カナ（zipcloud から取得）
 * @property {string}  [townKana]- 町域カナ（zipcloud から取得）
 *
 * @param {AddressInput} address
 * @returns {object} ParsedAddress
 */
export function parseAddress(address) {
  const { pref, city, town, bldg } = address;
  // zipcloud は半角カタカナ + 半角濁点で返す。NFKC で全角・合成形に統一する
  const prefKana = (address.prefKana ?? '').normalize('NFKC');
  const cityKana = (address.cityKana ?? '').normalize('NFKC');
  const townKana = (address.townKana ?? '').normalize('NFKC');

  const zip = formatZip(address.zip);
  const { prefRoman, prefRomanFull } = buildPrefRoman(pref, prefKana);
  const cityRoman  = buildCityRoman(cityKana, city);
  const townRoman  = townKana ? convert(townKana) : extractTownName(town);
  const banchi     = extractBanchi(town);
  const bldgRoman  = convertBldg(bldg ?? '');

  return { prefRoman, prefRomanFull, cityRoman, townRoman, banchi, bldgRoman, zip };
}

/**
 * 指定ロケールの住所文字列を生成する。
 *
 * @param {AddressInput} address
 * @param {string}       locale   - 'us' | 'uk' | 'fr' | 'de' | 'it' |
 *                                   'ca-en' | 'ca-fr' | 'kr' | 'tw' |
 *                                   'kr-aux' | 'tw-aux'
 * @returns {string}
 */
export function convertTo(address, locale) {
  const base       = parseAddress(address);
  const localNames = getLocalNames(address.pref, address.city, locale);
  return getFormat(locale)({ ...base, ...localNames });
}

/**
 * 全9ロケール（＋KR/TW補助）の住所文字列を一括生成する。
 * bldg がある場合は DeepL で各言語に翻訳する（並行実行）。
 * DEEPL_API_KEY 未設定またはエラー時はローマ字フォールバックを使用する。
 *
 * @param {AddressInput} address
 * @returns {Promise<object>} ConversionResult
 */
export async function convertAll(address) {
  const base = parseAddress(address);
  const { pref, city, bldg } = address;

  // ユニーク言語ごとに1リクエスト、Promise.all で並行実行
  const translations = {};
  if (bldg) {
    const uniqueLangs = [...new Set(Object.values(DeepL.LOCALE_TO_LANG))];
    await Promise.all(
      uniqueLangs.map(async (lang) => {
        const result = await DeepL.translate(bldg, lang);
        if (result) translations[lang] = result;
      })
    );
  }

  const fmt = (locale) => {
    const localNames = getLocalNames(pref, city, locale);
    const lang       = DeepL.LOCALE_TO_LANG[locale];
    const bldgRoman  = (lang && translations[lang]) || base.bldgRoman;
    return getFormat(locale)({ ...base, bldgRoman, ...localNames });
  };

  return {
    us:    fmt('us'),
    uk:    fmt('uk'),
    fr:    fmt('fr'),
    de:    fmt('de'),
    it:    fmt('it'),
    caEn:  fmt('ca-en'),
    caFr:  fmt('ca-fr'),
    kr:    fmt('kr'),
    tw:    fmt('tw'),
    krAux: fmt('kr-aux'),
    twAux: fmt('tw-aux'),
  };
}

export default { parseAddress, convertTo, convertAll };
