/**
 * formats.js
 * 各国住所フォーマット定義・韓国語地名辞書・繁体字変換
 */

// ─── 定数 ─────────────────────────────────────────────────────────────────────

/** 各ロケールにおける「日本」の表記 */
export const COUNTRY_NAME = {
  us:       'JAPAN',
  uk:       'JAPAN',
  fr:       'JAPON',
  de:       'JAPAN',
  it:       'GIAPPONE',
  'ca-en':  'JAPAN',
  'ca-fr':  'JAPON',
  kr:       '일본',
  tw:       '日本',
};

/** 対応ロケールコード一覧 */
export const LOCALES = ['us', 'uk', 'fr', 'de', 'it', 'ca-en', 'ca-fr', 'kr', 'tw'];

// ─── 繁体字変換 ───────────────────────────────────────────────────────────────

/**
 * 日本語漢字 → 繁体字 文字変換マップ
 * 住所に出現しやすい字のみを収録する。
 */
const JA_TO_TW = {
  '県': '縣', '区': '區',
  '広': '廣', '渋': '澀', '浜': '濱', '横': '橫',
  '桜': '櫻', '関': '關', '豊': '豐',
  '竜': '龍', '国': '國', '会': '會',
  '縄': '繩', '児': '兒', '台': '臺',
  '発': '發', '実': '實', '糸': '絲',
  '亀': '龜', '経': '經', '収': '收',
  '塩': '鹽', '総': '總', '鉄': '鐵',
};

/**
 * 日本語漢字文字列を繁体字中国語に変換する（文字単位）。
 * 辞書にない文字はそのまま出力する。
 *
 * @param {string} str
 * @returns {string}
 */
export function toTraditional(str) {
  return String(str).replace(/./gs, ch => JA_TO_TW[ch] ?? ch);
}

// ─── 韓国語地名辞書 ───────────────────────────────────────────────────────────

/**
 * 日本語地名 → 韓国語表記 辞書。
 * 辞書にない地名は romanize.js の convert() によるローマ字にフォールバックする。
 */
export const KR_DICT = {

  // ── 47 都道府県 ──────────────────────────────────────────────────────────────
  '北海道': '홋카이도',
  '青森県': '아오모리현',   '岩手県': '이와테현',     '宮城県': '미야기현',
  '秋田県': '아키타현',     '山形県': '야마가타현',   '福島県': '후쿠시마현',
  '茨城県': '이바라키현',   '栃木県': '도치기현',     '群馬県': '군마현',
  '埼玉県': '사이타마현',   '千葉県': '지바현',       '東京都': '도쿄도',
  '神奈川県': '가나가와현', '新潟県': '니가타현',     '富山県': '도야마현',
  '石川県': '이시카와현',   '福井県': '후쿠이현',     '山梨県': '야마나시현',
  '長野県': '나가노현',     '岐阜県': '기후현',       '静岡県': '시즈오카현',
  '愛知県': '아이치현',     '三重県': '미에현',       '滋賀県': '시가현',
  '京都府': '교토부',       '大阪府': '오사카부',     '兵庫県': '효고현',
  '奈良県': '나라현',       '和歌山県': '와카야마현', '鳥取県': '돗토리현',
  '島根県': '시마네현',     '岡山県': '오카야마현',   '広島県': '히로시마현',
  '山口県': '야마구치현',   '徳島県': '도쿠시마현',   '香川県': '가가와현',
  '愛媛県': '에히메현',     '高知県': '고치현',       '福岡県': '후쿠오카현',
  '佐賀県': '사가현',       '長崎県': '나가사키현',   '熊本県': '구마모토현',
  '大分県': '오이타현',     '宮崎県': '미야자키현',   '鹿児島県': '가고시마현',
  '沖縄県': '오키나와현',

  // ── 政令指定都市 20市 ────────────────────────────────────────────────────────
  '札幌市': '삿포로시',     '仙台市': '센다이시',     'さいたま市': '사이타마시',
  '千葉市': '지바시',       '横浜市': '요코하마시',   '川崎市': '가와사키시',
  '相模原市': '사가미하라시','新潟市': '니가타시',    '静岡市': '시즈오카시',
  '浜松市': '하마마쓰시',   '名古屋市': '나고야시',   '京都市': '교토시',
  '大阪市': '오사카시',     '堺市': '사카이시',       '神戸市': '고베시',
  '岡山市': '오카야마시',   '広島市': '히로시마시',   '北九州市': '기타큐슈시',
  '福岡市': '후쿠오카시',   '熊本市': '구마모토시',

  // ── 東京 23 特別区 ───────────────────────────────────────────────────────────
  '千代田区': '지요다구',   '中央区': '주오구',       '港区': '미나토구',
  '新宿区': '신주쿠구',     '文京区': '분쿄구',       '台東区': '다이토구',
  '墨田区': '스미다구',     '江東区': '고토구',       '品川区': '시나가와구',
  '目黒区': '메구로구',     '大田区': '오타구',       '世田谷区': '세타가야구',
  '渋谷区': '시부야구',     '中野区': '나카노구',     '杉並区': '스기나미구',
  '豊島区': '도시마구',     '北区': '기타구',         '荒川区': '아라카와구',
  '板橋区': '이타바시구',   '練馬区': '네리마구',     '足立区': '아다치구',
  '葛飾区': '가쓰시카구',   '江戸川区': '에도가와구',

  // ── 大阪市区（東京と重複しない区のみ）──────────────────────────────────────
  '都島区': '미야코지마구', '福島区': '후쿠시마구',   '此花区': '고노하나구',
  '西区': '니시구',         '大正区': '다이쇼구',     '天王寺区': '덴노지구',
  '浪速区': '나니와구',     '西淀川区': '니시요도가와구',
  '東淀川区': '히가시요도가와구', '東成区': '히가시나리구',
  '生野区': '이쿠노구',     '旭区': '아사히구',       '城東区': '조토구',
  '東住吉区': '히가시스미요시구', '阿倍野区': '아베노구',
  '住吉区': '스미요시구',   '西成区': '니시나리구',   '淀川区': '요도가와구',
  '鶴見区': '쓰루미구',     '住之江区': '스미노에구', '平野区': '히라노구',

  // ── 主要市（道府県庁所在地・人口規模の大きい市）────────────────────────────
  '旭川市': '아사히카와시', '函館市': '하코다테시',   '青森市': '아오모리시',
  '盛岡市': '모리오카시',   '秋田市': '아키타시',     '山形市': '야마가타시',
  '郡山市': '고리야마시',   '水戸市': '미토시',       '宇都宮市': '우쓰노미야시',
  '前橋市': '마에바시시',   '高崎市': '다카사키시',   '柏市': '가시와시',
  '船橋市': '후나바시시',   '八王子市': '하치오지시', '町田市': '마치다시',
  '横須賀市': '요코스카시', '富山市': '도야마시',     '金沢市': '가나자와시',
  '福井市': '후쿠이시',     '甲府市': '고후시',       '長野市': '나가노시',
  '松本市': '마쓰모토시',   '岐阜市': '기후시',       '豊橋市': '도요하시시',
  '豊田市': '도요타시',     '岡崎市': '오카자키시',   '津市': '쓰시',
  '大津市': '오쓰시',       '東大阪市': '히가시오사카시',
  '枚方市': '히라카타시',   '姫路市': '히메지시',     '奈良市': '나라시',
  '和歌山市': '와카야마시', '鳥取市': '돗토리시',     '松江市': '마쓰에시',
  '倉敷市': '구라시키시',   '福山市': '후쿠야마시',   '下関市': '시모노세키시',
  '徳島市': '도쿠시마시',   '高松市': '다카마쓰시',   '松山市': '마쓰야마시',
  '高知市': '고치시',       '久留米市': '구루메시',   '長崎市': '나가사키시',
  '佐世保市': '사세보시',   '大分市': '오이타시',     '宮崎市': '미야자키시',
  '鹿児島市': '가고시마시', '那覇市': '나하시',
};

/**
 * 日本語地名を韓国語表記で返す。辞書にない場合は null を返す。
 *
 * @param {string} jaName
 * @returns {string|null}
 */
export function lookupKr(jaName) {
  return KR_DICT[jaName] ?? null;
}

// ─── フォーマット関数（内部用）───────────────────────────────────────────────

/**
 * 住所行を組み立てる。空文字列・null・undefined の行は除外する。
 *
 * @param {...string} lines
 * @returns {string}
 */
function buildLines(...lines) {
  return lines.filter(Boolean).join('\n');
}

/**
 * スペース区切りで複数部品を連結する。空要素は除外して余分なスペースを防ぐ。
 *
 * @param {...string} parts
 * @returns {string}
 */
function joinParts(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * 欧米式ストリート行（番地+町名+区）を組み立てる。
 * townRoman が空の場合は banchi と cityRoman を直接連結して余分なスペースを除去する。
 *
 * @param {string} banchi
 * @param {string} townRoman
 * @param {string} cityRoman
 * @returns {string}
 */
function streetLineUs(banchi, townRoman, cityRoman) {
  const street = joinParts(banchi, townRoman);
  return [street, cityRoman].filter(Boolean).join(', ');
}

/**
 * ドイツ式ストリート行（町名+番地+区）を組み立てる。
 *
 * @param {string} banchi
 * @param {string} townRoman
 * @param {string} cityRoman
 * @returns {string}
 */
function streetLineDe(banchi, townRoman, cityRoman) {
  const street = joinParts(townRoman, banchi);
  return [street, cityRoman].filter(Boolean).join(', ');
}

/** American English: 番地+町名, 区, 都市+郵便番号, JAPAN */
function formatUs(p) {
  return buildLines(
    p.bldgRoman,
    streetLineUs(p.banchi, p.townRoman, p.cityRoman),
    joinParts(p.prefRoman, p.zip),
    COUNTRY_NAME.us
  );
}

/** British English: 番地+町名, 区, 都市, 郵便番号（単独行）, JAPAN */
function formatUk(p) {
  return buildLines(
    p.bldgRoman,
    streetLineUs(p.banchi, p.townRoman, p.cityRoman),
    p.prefRoman,
    p.zip,
    COUNTRY_NAME.uk
  );
}

/** French: 番地+町名, 区, 郵便番号+都市, JAPON */
function formatFr(p) {
  return buildLines(
    p.bldgRoman,
    streetLineUs(p.banchi, p.townRoman, p.cityRoman),
    joinParts(p.zip, p.prefRoman),
    COUNTRY_NAME.fr
  );
}

/** German: 町名+番地, 区, 郵便番号+都市, JAPAN（ドイツ式: 通り名→番地） */
function formatDe(p) {
  return buildLines(
    p.bldgRoman,
    streetLineDe(p.banchi, p.townRoman, p.cityRoman),
    joinParts(p.zip, p.prefRoman),
    COUNTRY_NAME.de
  );
}

/** Italian: 町名+番地, 区, 郵便番号+都市, GIAPPONE */
function formatIt(p) {
  return buildLines(
    p.bldgRoman,
    streetLineDe(p.banchi, p.townRoman, p.cityRoman),
    joinParts(p.zip, p.prefRoman),
    COUNTRY_NAME.it
  );
}

/** Canadian English: US と同形式 */
function formatCaEn(p) {
  return buildLines(
    p.bldgRoman,
    streetLineUs(p.banchi, p.townRoman, p.cityRoman),
    joinParts(p.prefRoman, p.zip),
    COUNTRY_NAME['ca-en']
  );
}

/** Canadian French: FR と同形式（JAPON） */
function formatCaFr(p) {
  return buildLines(
    p.bldgRoman,
    streetLineUs(p.banchi, p.townRoman, p.cityRoman),
    joinParts(p.zip, p.prefRoman),
    COUNTRY_NAME['ca-fr']
  );
}

/**
 * Korean メイン: 都道府県は接尾語あり（prefRomanFull）+ 区市は接尾語あり（cityRoman）
 * 例: 일본 〒150-0002 / Tokyo-to Shibuya-ku Shibuya 1-2-3 / OO Bldg 3F
 */
function formatKr(p) {
  return buildLines(
    `${COUNTRY_NAME.kr} 〒${p.zip}`,
    joinParts(p.prefRomanFull, p.cityRoman, p.townRoman, p.banchi),
    p.bldgRoman
  );
}

/**
 * Korean 補助: 現地語地名（prefLocal / cityLocal）を使用。
 * 辞書未登録の場合は prefRomanFull / cityRoman にフォールバック。
 */
function formatKrAux(p) {
  const pref = p.prefLocal || p.prefRomanFull;
  const city = p.cityLocal || p.cityRoman;
  return buildLines(
    `${COUNTRY_NAME.kr} 〒${p.zip}`,
    joinParts(pref, city, p.townRoman, p.banchi),
    p.bldgRoman
  );
}

/** Traditional Chinese: 日本+〒zip, prefLocal cityLocal townRoman banchi, 建物名 */
function formatTw(p) {
  const pref = p.prefLocal || p.prefRoman;
  const city = p.cityLocal || p.cityRoman;
  return buildLines(
    `${COUNTRY_NAME.tw} 〒${p.zip}`,
    joinParts(pref, city, p.townRoman, p.banchi),
    p.bldgRoman
  );
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

const FORMAT_MAP = {
  us:       formatUs,
  uk:       formatUk,
  fr:       formatFr,
  de:       formatDe,
  it:       formatIt,
  'ca-en':  formatCaEn,
  'ca-fr':  formatCaFr,
  kr:       formatKr,
  'kr-aux': formatKrAux,
  tw:       formatTw,
  'tw-aux': formatTw,
};

/**
 * ロケールコードに対応するフォーマット関数を返す。
 * 未知のロケールは US 形式にフォールバックする。
 *
 * @param {string} locale
 * @returns {(p: object) => string}
 */
export function get(locale) {
  return FORMAT_MAP[locale] ?? formatUs;
}

export default { COUNTRY_NAME, LOCALES, KR_DICT, toTraditional, lookupKr, get };
