/**
 * romanize.js
 * ヘボン式ローマ字変換モジュール（日本郵便準拠）
 *
 * 設計方針:
 *   - convert() は純粋なカナ→ローマ字変換のみ行う
 *   - 行政区分接尾語（-ku / -shi / -ken 等）の付与は converter.js が担当
 *   - 長音はJapan Post方式で短縮（ou→o, oo→o, uu→u）
 */

// ─── 拗音テーブル（2文字）— ひらがなで管理 ─────────────────────────────────
const BIGRAMS = {
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja',  'じゅ': 'ju',  'じょ': 'jo',
  'ぢゃ': 'ja',  'ぢゅ': 'ju',  'ぢょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  'ふぁ': 'fa',  'ふぃ': 'fi',  'ふぇ': 'fe',  'ふぉ': 'fo',
};

// ─── 単音テーブル（1文字）— ひらがなで管理 ─────────────────────────────────
const SINGLES = {
  'あ': 'a',   'い': 'i',   'う': 'u',   'え': 'e',   'お': 'o',
  'か': 'ka',  'き': 'ki',  'く': 'ku',  'け': 'ke',  'こ': 'ko',
  'さ': 'sa',  'し': 'shi', 'す': 'su',  'せ': 'se',  'そ': 'so',
  'た': 'ta',  'ち': 'chi', 'つ': 'tsu', 'て': 'te',  'と': 'to',
  'な': 'na',  'に': 'ni',  'ぬ': 'nu',  'ね': 'ne',  'の': 'no',
  'は': 'ha',  'ひ': 'hi',  'ふ': 'fu',  'へ': 'he',  'ほ': 'ho',
  'ま': 'ma',  'み': 'mi',  'む': 'mu',  'め': 'me',  'も': 'mo',
  'や': 'ya',  'ゆ': 'yu',  'よ': 'yo',
  'ら': 'ra',  'り': 'ri',  'る': 'ru',  'れ': 're',  'ろ': 'ro',
  'わ': 'wa',  'ゐ': 'wi',  'ゑ': 'we',  'を': 'wo',
  'ん': 'n',
  'が': 'ga',  'ぎ': 'gi',  'ぐ': 'gu',  'げ': 'ge',  'ご': 'go',
  'ざ': 'za',  'じ': 'ji',  'ず': 'zu',  'ぜ': 'ze',  'ぞ': 'zo',
  'だ': 'da',  'ぢ': 'ji',  'づ': 'zu',  'で': 'de',  'ど': 'do',
  'ば': 'ba',  'び': 'bi',  'ぶ': 'bu',  'べ': 'be',  'ぼ': 'bo',
  'ぱ': 'pa',  'ぴ': 'pi',  'ぷ': 'pu',  'ぺ': 'pe',  'ぽ': 'po',
  'ゔ': 'vu',
};

// ─── 建物名キーワード（カタカナ → 英語略称）長い語を先に並べる ─────────────
const BLDG_KEYWORDS = [
  ['ビルディング',     'Building'],
  ['タワーマンション', 'Tower Mansion'],
  ['アパートメント',   'Apt'],
  ['タワー',           'Tower'],
  ['マンション',       'Mansion'],
  ['アパート',         'Apt'],
  ['ハイツ',           'Heights'],
  ['レジデンス',       'Residence'],
  ['プラザ',           'Plaza'],
  ['センター',         'Center'],
  ['テラス',           'Terrace'],
  ['コーポ',           'Corp'],
  ['コート',           'Court'],
  ['パーク',           'Park'],
  ['フラット',         'Flat'],
  ['ビル',             'Bldg'],
];

// ─── ヘルパー関数 ────────────────────────────────────────────────────────────

/** カタカナ → ひらがな（U+30A1〜U+30F6 のみ対象） */
function toHiragana(str) {
  return str.replace(/[ァ-ヶ]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/** 全角数字・アルファベット・スペース → 半角 */
function normalizeWide(str) {
  return str
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ');
}

/**
 * ひらがな文字列を生ローマ字に変換する（先頭大文字化・長音圧縮を含む）。
 * 行政区分接尾語の処理は行わない。
 */
function romanizeRaw(hiragana) {
  let result = '';
  let i = 0;

  while (i < hiragana.length) {
    const ch = hiragana[i];

    // 長音符 ー（U+30FC）— 直前の母音を繰り返す
    if (ch === 'ー') {
      const lastVowel = result.match(/[aeiou]$/)?.[0] ?? 'a';
      result += lastVowel;
      i++;
      continue;
    }

    // 促音 っ — 次のモーラの先頭子音を重ねる
    if (ch === 'っ') {
      const nextRoman = BIGRAMS[hiragana[i + 1] + hiragana[i + 2]]
        ?? SINGLES[hiragana[i + 1]]
        ?? '';
      if (nextRoman) result += nextRoman[0];
      i++;
      continue;
    }

    // ん — 母音・y の前は n'、それ以外は n
    if (ch === 'ん') {
      const next = hiragana[i + 1];
      result += (next && /^[あいうえおやゆよ]$/.test(next)) ? "n'" : 'n';
      i++;
      continue;
    }

    // 拗音（2文字）を優先
    const bigram = BIGRAMS[hiragana[i] + hiragana[i + 1]];
    if (bigram !== undefined) {
      result += bigram;
      i += 2;
      continue;
    }

    // 単音
    const single = SINGLES[ch];
    if (single !== undefined) {
      result += single;
      i++;
      continue;
    }

    // 非カナ文字（漢字・ASCII・数字等）はそのまま通す
    result += ch;
    i++;
  }

  // 長音圧縮（Japan Post 方式）
  return result
    .replace(/ou/g, 'o')
    .replace(/oo/g, 'o')
    .replace(/uu/g, 'u');
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * ひらがな・カタカナ → ヘボン式ローマ字（先頭大文字）。
 * 非カナ文字はそのまま通過する。
 * 行政区分接尾語の付与は converter.js が担当する。
 *
 * @param {string} text
 * @returns {string}
 */
export function convert(text) {
  if (!text) return '';
  const hiragana = toHiragana(String(text));
  const roman = romanizeRaw(hiragana);
  return roman.charAt(0).toUpperCase() + roman.slice(1);
}

/**
 * 番地表記（丁目・番・号等）をハイフン区切りに変換する。
 * 全角数字にも対応する。
 *
 * @param {string} text
 * @returns {string}
 */
export function convertBanchi(text) {
  if (!text) return '';
  const normalized = normalizeWide(String(text));

  // すでにハイフン形式ならそのまま返す
  if (/^\d+(-\d+)*$/.test(normalized.trim())) {
    return normalized.trim();
  }

  // 番地区切り語で分割（番地 を 番 より先に置いて部分一致を防ぐ）
  const parts = normalized
    .split(/丁目|番地|番|号|[のノ]/)
    .map(s => s.trim())
    .filter(s => /^\d+$/.test(s));

  return parts.join('-');
}

/**
 * 建物名・部屋番号を英語表記に変換する（ベストエフォート）。
 * カタカナキーワードを英語略称に置換し、残存カナをローマ字化する。
 * 漢字部分は変換できないためそのまま通過する。
 *
 * @param {string} text
 * @returns {string}
 */
export function convertBldg(text) {
  if (!text) return '';

  let result = normalizeWide(String(text));

  // 日本語記号を ASCII 相当に置換
  result = result.replace(/[○◯〇]/g, 'O').replace(/[●◉]/g, 'O');

  // 建物キーワードを英語に置換（長い語を先に処理して部分一致を防ぐ）
  for (const [kana, eng] of BLDG_KEYWORDS) {
    result = result.replaceAll(kana, ` ${eng} `);
  }

  // 残存するカナ列をローマ字化
  result = result.replace(/[぀-ヿㇰ-ㇿ]+/g, kana =>
    convert(kana)
  );

  return result.replace(/\s+/g, ' ').trim();
}

export default { convert, convertBanchi, convertBldg };
