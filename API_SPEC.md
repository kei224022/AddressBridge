# API仕様書 — AddressBridge

**バージョン**: 1.0  
**作成日**: 2025-01-01  
**対象**: 外部API・内部モジュールインターフェース

---

## 目次

1. [外部API一覧](#1-外部api一覧)
2. [zipcloud — 郵便番号検索API](#2-zipcloud--郵便番号検索api)
3. [Nominatim — ジオコーディングAPI](#3-nominatim--ジオコーディングapi)
4. [内部モジュールAPI](#4-内部モジュールapi)
   - 4-1. [zipcloud.js](#4-1-zipcloudjs)
   - 4-2. [geocoder.js](#4-2-geocoderjs)
   - 4-3. [romanize.js](#4-3-romanizejs)
   - 4-4. [converter.js](#4-4-converterjs)
   - 4-5. [formats.js](#4-5-formatsjs)
   - 4-6. [map.js](#4-6-mapjs)
   - 4-7. [main.js](#4-7-mainjs)
5. [データモデル定義](#5-データモデル定義)
6. [エラーコード定義](#6-エラーコード定義)

---

## 1. 外部API一覧

| API名 | 用途 | 認証 | 利用料 | Rate Limit |
|-------|------|------|--------|-----------|
| zipcloud | 郵便番号→住所変換・住所検証 | 不要 | 無料 | 明示なし（過度な呼び出し禁止） |
| Nominatim | 住所→緯度経度変換（ジオコーディング） | 不要 | 無料 | 1 req/sec |

---

## 2. zipcloud — 郵便番号検索API

### 2-1. 基本情報

| 項目 | 値 |
|------|----|
| ベースURL | `https://zipcloud.ibsnet.co.jp/api/search` |
| メソッド | `GET` |
| 認証 | なし |
| レスポンス形式 | `application/json` |
| 文字コード | UTF-8 |
| CORS | 対応（ブラウザから直接呼び出し可） |

### 2-2. リクエストパラメータ

| パラメータ名 | 型 | 必須 | 説明 | 例 |
|------------|----|----|------|-----|
| `zipcode` | string | ○ | 7桁の郵便番号（ハイフンなし） | `1500002` |
| `callback` | string | △ | JSONP コールバック関数名（未使用） | — |
| `limit` | integer | — | 返却件数上限（デフォルト20） | `1` |

### 2-3. レスポンス

#### 成功時（status: 200）

```json
{
  "message": null,
  "results": [
    {
      "address1": "東京都",
      "address2": "渋谷区",
      "address3": "渋谷",
      "kana1": "トウキョウト",
      "kana2": "シブヤク",
      "kana3": "シブヤ",
      "prefcode": "13",
      "zipcode": "1500002"
    }
  ],
  "status": 200
}
```

#### 該当なし（status: 200, results: null）

```json
{
  "message": null,
  "results": null,
  "status": 200
}
```

#### エラー時（status: 400）

```json
{
  "message": "パラメータ「zipcode」の値が不正です。",
  "results": null,
  "status": 400
}
```

### 2-4. レスポンスフィールド定義

| フィールド | 型 | 説明 |
|-----------|----|----|
| `status` | integer | 200: 成功, 400: パラメータエラー, 500: サーバーエラー |
| `message` | string \| null | エラーメッセージ（成功時は null） |
| `results` | array \| null | 住所データの配列（該当なし時は null） |
| `results[].zipcode` | string | 7桁郵便番号 |
| `results[].prefcode` | string | 都道府県コード（JIS X 0401） |
| `results[].address1` | string | 都道府県名 |
| `results[].address2` | string | 市区町村名 |
| `results[].address3` | string | 町域名 |
| `results[].kana1` | string | 都道府県名カナ |
| `results[].kana2` | string | 市区町村名カナ |
| `results[].kana3` | string | 町域名カナ |

### 2-5. 呼び出しタイミング

| タイミング | 用途 |
|-----------|------|
| 郵便番号が7桁（ハイフン除く）になった瞬間 | 住所自動補完 |
| 変換ボタン押下時 | 住所検証（入力値との照合） |

### 2-6. 住所検証ロジック

```
zipcloud レスポンスの address1 + address2 と
入力フォームの 都道府県 + 市区町村 を比較

一致: 警告なし
不一致 or results=null: 警告バナー表示
API エラー / ネットワーク障害: 検証スキップ（エラー表示なし）
```

---

## 3. Nominatim — ジオコーディングAPI

### 3-1. 基本情報

| 項目 | 値 |
|------|----|
| ベースURL | `https://nominatim.openstreetmap.org/search` |
| メソッド | `GET` |
| 認証 | なし（User-Agent ヘッダー必須） |
| レスポンス形式 | `application/json` |
| Rate Limit | **1 req/sec**（超過するとブロックされる可能性あり） |
| 利用規約 | https://operations.osmfoundation.org/policies/nominatim/ |

> **重要**: `User-Agent` ヘッダーにサービス名と連絡先を含めること。
> 商用・大量アクセスには独自インスタンスの構築を推奨。

### 3-2. リクエストパラメータ

| パラメータ名 | 型 | 必須 | 説明 | 使用値 |
|------------|----|----|------|--------|
| `q` | string | ○ | 検索クエリ（住所文字列） | `渋谷区渋谷1-2-3, 東京都, 日本` |
| `format` | string | ○ | レスポンス形式 | `json` |
| `limit` | integer | — | 返却件数 | `1` |
| `countrycodes` | string | — | 対象国コード（ISO 3166-1 alpha-2） | `jp` |
| `addressdetails` | integer | — | 住所詳細を含むか | `0` |

### 3-3. リクエストヘッダー

| ヘッダー名 | 値 | 必須 |
|-----------|-----|------|
| `User-Agent` | `AddressBridge/1.0 (your-contact@example.com)` | ○（利用規約上必須） |
| `Accept-Language` | `ja` | 推奨 |

### 3-4. レスポンス

#### 成功時（1件以上ヒット）

```json
[
  {
    "place_id": 123456789,
    "licence": "Data © OpenStreetMap contributors, ODbL 1.0.",
    "osm_type": "way",
    "osm_id": 987654321,
    "lat": "35.6584421",
    "lon": "139.7022068",
    "class": "place",
    "type": "neighbourhood",
    "place_rank": 25,
    "importance": 0.5,
    "addresstype": "neighbourhood",
    "name": "渋谷",
    "display_name": "渋谷, 渋谷区, 東京都, 150-0002, 日本",
    "boundingbox": ["35.655", "35.662", "139.698", "139.708"]
  }
]
```

#### 該当なし時

```json
[]
```

### 3-5. 使用フィールド

| フィールド | 用途 |
|-----------|------|
| `lat` | Leaflet マーカーの緯度 |
| `lon` | Leaflet マーカーの経度 |

### 3-6. 検索クエリの構築

```javascript
// 入力値から検索クエリを組み立てる
function buildGeoQuery(address) {
  const parts = [
    address.town,    // 町名・番地
    address.city,    // 市区町村
    address.pref,    // 都道府県
    '日本'
  ].filter(Boolean);
  return parts.join(', ');
}
```

### 3-7. Rate Limit 対策

```javascript
// 変換ボタン押下1回につき1リクエストのみ
// デバウンス不要（ユーザー操作起点のため）
// Nominatim への連続呼び出しが発生しないよう設計
```

---

## 4. 内部モジュールAPI

モジュールはすべてグローバルオブジェクト（または ES Module `export`）として公開する。
Firebase Hosting は静的ホスティングのみのため、バンドラーなしで動作させる。

---

### 4-1. zipcloud.js

#### `ZipCloud.lookup(zipcode)`

郵便番号から住所を取得する。

| 項目 | 内容 |
|------|------|
| 引数 | `zipcode` {string} — 7桁数字（ハイフンあり/なし両対応） |
| 戻り値 | `Promise<ZipResult \| null>` |
| エラー | ネットワーク障害時は `null` を返す（例外をスローしない） |

```javascript
/**
 * @typedef {Object} ZipResult
 * @property {string} zipcode  - 7桁郵便番号
 * @property {string} pref     - 都道府県名
 * @property {string} city     - 市区町村名
 * @property {string} town     - 町域名
 * @property {string} prefcode - 都道府県コード
 */

// 使用例
const result = await ZipCloud.lookup('1500002');
// => { zipcode: '1500002', pref: '東京都', city: '渋谷区', town: '渋谷', prefcode: '13' }
// 該当なし・エラー時: null
```

#### `ZipCloud.lookupDetailed(zipcode)`

補完・検証で使う詳細検索。引数は `lookup()` と同じで、例外をスローせず次の結果を返す。

| 結果 | 戻り値 | 判定条件 |
|------|--------|----------|
| 成功 | `{ status: 'success', address: ZipResult }` | HTTP 成功、API `status: 200`、有効な住所データあり |
| 該当なし | `{ status: 'not-found' }` | API `status: 200` で `results` が `null` または空配列 |
| 通信/API エラー | `{ status: 'error' }` | HTTP エラー、ネットワーク障害、不正 JSON、API エラー、不正なレスポンス構造 |

正規化できない入力も `not-found` とし、通信は行わない。
既存の `lookup()` はこの処理を利用し、従来どおり住所オブジェクトまたは `null` を返す。
補完では該当なしを「郵便番号が見つかりませんでした」、通信/API エラーを
「郵便番号の検索に失敗しました。通信状況を確認して再試行してください」と通知する。

補完 UI（`js/address-form.js`）は要求ごとの連番、要求時の郵便番号、住所フィールドの値と編集履歴を保持する。
応答を反映するのは、最新要求で、現在の郵便番号が一致し、都道府県・市区町村・町名番地・建物名が要求後に編集されていない場合だけとする。
入力を編集して元に戻した場合も、その要求は無効とする。古い成功応答・該当なし・エラーはすべて無視し、通知やフォーカスも更新しない。
郵便番号の入力イベントでは削除・桁不足・同じ番号への再入力を含めて旧要求を無効化する。
番号が変更・削除された時点で取得済みのカナをすべて消し、次の有効な補完成功時に設定し直す。

#### `ZipCloud.validate(zipcode, pref, city)`

郵便番号と入力した都道府県・市区町村の整合性を検証する。

| 項目 | 内容 |
|------|------|
| 引数 | `zipcode` {string}, `pref` {string}, `city` {string} |
| 戻り値 | `Promise<'match' \| 'mismatch' \| 'skip'>` |

```javascript
// 'match'    : API結果と入力が一致
// 'mismatch' : 正常検索で該当なし、または住所が不一致（警告表示）
// 'skip'     : 通信/API エラー、不正レスポンス（警告表示せず変換を継続）
```

#### `ZipCloud.normalizeZip(input)`

NFKC 正規化と空白除去の後、7 桁数字または「3 桁-4 桁」の表記だけを 7 桁数字へ正規化する。
ハイフンは ASCII の `-` と、NFKC で同じ文字になる全角 `－` に対応する。
文字混在、桁不足・桁超過、ハイフンの重複・位置違い、`〒` やその他の記号は受け付けず、切り詰めて有効な番号にはしない。

| 項目 | 内容 |
|------|------|
| 引数 | `input` {string} |
| 戻り値 | {string} — ハイフンなし7桁。不完全・不正な入力は空文字列 |

```javascript
ZipCloud.normalizeZip('150-0002') // => '1500002'
ZipCloud.normalizeZip('1500002')  // => '1500002'
ZipCloud.normalizeZip('150-00')   // => ''
ZipCloud.normalizeZip('１５０　－　０００２') // => '1500002'
ZipCloud.normalizeZip('15000028') // => ''（切り詰めない）
ZipCloud.normalizeZip('abc1500002') // => ''（文字を捨てない）
```

#### `ZipCloud.formatZipInput(input)`

入力表示を NFKC 正規化して空白を除去し、数字だけの入力には 4 桁目以降の前にハイフンを挿入する。
桁超過や文字混在の値も保存し、入力欄で修正できるようにする（例: `15000028` → `150-00028`）。
`address-form.js` はこの整形後に `normalizeZip()` が成功した場合だけ補完する。
入力中の文字数制限は設けず、貼り付けた値が有効な番号に切り捨てられないようにする。
IME 変換中は整形・補完を保留し、確定後に実行する。変換中は変換ボタンによる API 呼び出しも行わない。
フォームの未入力と形式不正のメッセージを分け、形式不正では住所検証・翻訳・地図検索を開始しない。
通常入力では 7 桁に達した時点で補完するため、その後 8 桁目を入力した場合は既に開始済みの要求を R-2 の仕組みで無効化する。

---

### 4-2. geocoder.js

#### `Geocoder.search(address)`

住所オブジェクトから緯度経度を取得する。

| 項目 | 内容 |
|------|------|
| 引数 | `address` {AddressInput} |
| 戻り値 | `Promise<LatLon \| null>` |
| エラー | 失敗・未ヒット時は `null` を返す |

```javascript
/**
 * @typedef {Object} LatLon
 * @property {number} lat
 * @property {number} lon
 */

const pos = await Geocoder.search({
  pref: '東京都',
  city: '渋谷区',
  town: '渋谷1丁目2番3号'
});
// => { lat: 35.658, lon: 139.702 }
// 失敗時: null
```

---

### 4-3. romanize.js

日本語文字列をヘボン式ローマ字に変換するモジュール。

#### `Romanize.convert(text)`

ひらがな・カタカナをヘボン式ローマ字に変換する。
漢字は変換できないため、住所の各フィールドはカナ表記を別途管理するか
zipcloud のカナフィールドを利用する。

| 項目 | 内容 |
|------|------|
| 引数 | `text` {string} — ひらがなまたはカタカナ |
| 戻り値 | {string} — ヘボン式ローマ字（先頭大文字） |

```javascript
Romanize.convert('シブヤ')    // => 'Shibuya'
Romanize.convert('とうきょう') // => 'Tokyo'
Romanize.convert('おおさか')   // => 'Osaka'
Romanize.convert('ほんまち')   // => 'Honmachi'
```

#### `Romanize.convertBanchi(text)`

番地表記（丁目・番・号）をハイフン区切りに変換する。

| 項目 | 内容 |
|------|------|
| 引数 | `text` {string} — 番地文字列 |
| 戻り値 | {string} — ハイフン区切り番地 |

```javascript
Romanize.convertBanchi('1丁目2番3号') // => '1-2-3'
Romanize.convertBanchi('3番地5')      // => '3-5'
Romanize.convertBanchi('12番')        // => '12'
```

#### `Romanize.convertBldg(text)`

建物名・部屋番号のローマ字化。

| 項目 | 内容 |
|------|------|
| 引数 | `text` {string} |
| 戻り値 | {string} — ローマ字 + 英数字 |

```javascript
Romanize.convertBldg('○○ビル3F')     // => 'OO Bldg 3F'
Romanize.convertBldg('渋谷タワー201') // => 'Shibuya Tower 201'
```

#### ヘボン式変換テーブル（主要規則）

| かな | ローマ字 | かな | ローマ字 |
|------|---------|------|---------|
| あ行 | a/i/u/e/o | さ行 | sa/shi/su/se/so |
| た行 | ta/chi/tsu/te/to | な行 | na/ni/nu/ne/no |
| は行 | ha/hi/fu/he/ho | ま行 | ma/mi/mu/me/mo |
| や行 | ya/yu/yo | ら行 | ra/ri/ru/re/ro |
| わ行 | wa/wi/we/wo/n | が行 | ga/gi/gu/ge/go |
| ざ行 | za/ji/zu/ze/zo | だ行 | da/ji/zu/de/do |
| ば行 | ba/bi/bu/be/bo | ぱ行 | pa/pi/pu/pe/po |
| しゃ | sha | じゃ | ja |
| ちゃ | cha | にゃ | nya |
| つ（促音） | 次の子音を重ねる（tt/ss等） | ん | n（母音前: n'） |
| 長音 | 短縮（おう→o, おお→o） | — | — |

---

### 4-4. converter.js

住所変換のメインモジュール。

#### `Converter.convertAll(address)`

入力住所を全9言語フォーマットに変換する。

| 項目 | 内容 |
|------|------|
| 引数 | `address` {AddressInput} |
| 戻り値 | {ConversionResult} |

```javascript
/**
 * @typedef {Object} AddressInput
 * @property {string} zip    - 郵便番号（ハイフンなし7桁）
 * @property {string} pref   - 都道府県名
 * @property {string} city   - 市区町村名
 * @property {string} town   - 町名・番地
 * @property {string} [bldg] - 建物名・部屋番号（任意）
 * @property {string} [prefKana] - 都道府県カナ（zipcloudから取得）
 * @property {string} [cityKana] - 市区町村カナ（zipcloudから取得）
 * @property {string} [townKana] - 町域カナ（zipcloudから取得）
 */

/**
 * @typedef {Object} ConversionResult
 * @property {string} us    - American English
 * @property {string} uk    - British English
 * @property {string} fr    - French
 * @property {string} de    - German
 * @property {string} it    - Italian
 * @property {string} caEn  - Canadian English
 * @property {string} caFr  - Canadian French
 * @property {string} kr    - Korean
 * @property {string} tw    - Traditional Chinese
 * @property {Object} krAux - Korean 補助表示（現地語地名）
 * @property {Object} twAux - Traditional Chinese 補助表示（現地語地名）
 */

const result = Converter.convertAll({
  zip: '1500002',
  pref: '東京都',
  city: '渋谷区',
  town: '渋谷1丁目2番3号',
  bldg: '○○ビル3F',
  prefKana: 'トウキョウト',
  cityKana: 'シブヤク',
  townKana: 'シブヤ'
});
```

#### `Converter.convertTo(address, locale)`

指定した1言語のフォーマットに変換する。

| 項目 | 内容 |
|------|------|
| 引数 | `address` {AddressInput}, `locale` {LocaleCode} |
| 戻り値 | {string} — 改行区切りの住所文字列 |

```javascript
// LocaleCode: 'us' | 'uk' | 'fr' | 'de' | 'it' | 'ca-en' | 'ca-fr' | 'kr' | 'tw'

Converter.convertTo(address, 'us');
// =>
// "OO Bldg 3F\n1-2-3 Shibuya, Shibuya-ku\nTokyo 150-0002\nJAPAN"
```

#### `Converter.parseAddress(address)`

住所を変換に使いやすい中間形式に分解する（内部用）。

| 項目 | 内容 |
|------|------|
| 引数 | `address` {AddressInput} |
| 戻り値 | {ParsedAddress} |

```javascript
/**
 * @typedef {Object} ParsedAddress
 * @property {string} prefRoman  - 都道府県ローマ字 (e.g. "Tokyo")
 * @property {string} cityRoman  - 市区町村ローマ字 (e.g. "Shibuya-ku")
 * @property {string} townRoman  - 町名ローマ字 (e.g. "Shibuya")
 * @property {string} banchi     - 番地ハイフン形式 (e.g. "1-2-3")
 * @property {string} bldgRoman  - 建物名ローマ字 (e.g. "OO Bldg 3F")
 * @property {string} zip        - 郵便番号 (e.g. "150-0002")
 * @property {string} prefLocal  - 都道府県現地語 (kr/tw用)
 * @property {string} cityLocal  - 市区町村現地語 (kr/tw用)
 */
```

---

### 4-5. formats.js

各国フォーマット定義と地名辞書を管理するモジュール。

#### `Formats.get(locale)`

指定ロケールのフォーマット関数を返す。

| 項目 | 内容 |
|------|------|
| 引数 | `locale` {LocaleCode} |
| 戻り値 | `(parsed: ParsedAddress) => string` |

```javascript
const formatter = Formats.get('us');
formatter(parsed);
// => "OO Bldg 3F\n1-2-3 Shibuya, Shibuya-ku\nTokyo 150-0002\nJAPAN"
```

#### `Formats.LOCALES`

対応ロケール一覧の定数。

```javascript
Formats.LOCALES = ['us', 'uk', 'fr', 'de', 'it', 'ca-en', 'ca-fr', 'kr', 'tw'];
```

#### `Formats.COUNTRY_NAME`

各ロケールにおける「日本」の表記。

```javascript
Formats.COUNTRY_NAME = {
  us:    'JAPAN',
  uk:    'JAPAN',
  fr:    'JAPON',
  de:    'JAPAN',
  it:    'GIAPPONE',
  caEn:  'JAPAN',
  caFr:  'JAPON',
  kr:    '일본',
  tw:    '日本'
};
```

#### `Formats.KR_DICT` / `Formats.TW_DICT`

現地語地名辞書（47都道府県 + 主要市区）。

```javascript
// キー: 日本語地名, 値: 現地語表記
Formats.KR_DICT = {
  '東京都': '도쿄도',
  '大阪府': '오사카부',
  '渋谷区': '시부야구',
  // ...
};

Formats.TW_DICT = {
  '渋谷区': '澀谷區',
  '横浜市': '橫濱市',
  // 漢字共通のものはキーに含めない（そのまま使用）
  // ...
};
```

---

### 4-6. map.js

Google Maps 地図の操作モジュール。

#### `MapController.init(elementId)`

地図を初期化する。

| 項目 | 内容 |
|------|------|
| 引数 | `elementId` {string} — 地図を描画する DOM 要素の ID |
| 戻り値 | `void` |

```javascript
MapController.init('map-container');
```

#### `MapController.show(lat, lon, label)`

指定座標にマーカーを立てて地図を表示する。

| 項目 | 内容 |
|------|------|
| 引数 | `lat` {number}, `lon` {number}, `label` {string} — ポップアップテキスト |
| 戻り値 | `void` |

```javascript
MapController.show(35.6584, 139.7022, '東京都渋谷区渋谷1丁目2番3号');
```

#### `MapController.showLoading()`

前回の地図本体を隠し、枠の高さを保って「地図を検索しています…」を表示する。
`map-section` の `data-state` を `loading`、`aria-busy` を `true` にする。
待機・エラー表示は `map-container` の兄弟要素とし、Maps API の初期化で消えない構造にする。

#### `MapController.hide()`

地図エリアを非表示にする。
`data-state` は `hidden`、`aria-busy` は `false` とする。

#### `MapController.showError()`

ジオコーディング失敗時のエラー表示に切り替える。
古い地図と待機表示を隠し、`data-state` は `error`、`aria-busy` は `false` とする。
`show()` の成功時は地図本体だけを表示し、`data-state` は `ready` とする。Maps API がまだ利用できない場合はエラー表示へ戻す。

---

### 4-7. main.js

アプリケーションのエントリーポイント。各モジュールを統合し、イベントを管理する。

#### イベントハンドラー一覧

| イベント | ハンドラー | 処理概要 |
|---------|-----------|---------|
| `input-zip` の `input` | `onZipInput()` | ハイフン自動挿入、7桁で補完API呼び出し |
| `btn-convert` の `click` | `onConvert()` | バリデーション→検証→変換→結果表示→非同期の地図更新 |
| 言語タブの `click` | `onTabChange(locale)` | 変換結果・プレビューの切り替え |
| プレビュータブの `click` | `onPreviewChange(type)` | 封筒/はがき/伝票の切り替え |
| コピーボタンの `click` | `onCopy(locale)` | クリップボードコピー |

#### `onConvert()` 処理フロー

```javascript
async function onConvert() {
  if (btnConvert.disabled || !form.validate()) return;
  const requestId = ++conversionId; // 地図応答は変換開始時点で無効化する
  const address = form.read();
  setLoading(btnConvert, true, '変換中...');
  warningEl.style.display = 'none';
  MapController.showLoading();
  try {
    const validation = await ZipCloud.validate(address.zip, address.pref, address.city);
    if (validation === 'mismatch') warningEl.style.display = '';
    const converted = await convertAll(address);
    results.render(address, converted);
    document.getElementById('result-section').scrollIntoView({ behavior: 'smooth' });
    void updateMap(address, requestId);
  } finally {
    setLoading(btnConvert, false); // 地図の完了を待たず再実行可能にする
  }
}
```

`updateMap()` は地図検索の成功・失敗・例外のいずれでも、要求 ID が現在の `conversionId` と一致するときだけ地図を更新する。
結果の言語選択やプレビューには触れず、地図完了時のスクロールも行わない。

---

### 4-8. http.js — 外部 API の待機上限

`fetchJson(url, { timeoutMs, ...options })` は JSON の取得を期限付きで行う。
`timeoutMs` を除くオプションは `fetch()` へ渡し、中断用の `AbortSignal` はヘルパーが生成する。
HTTP エラー・通信障害・不正 JSON は例外として呼び出し元に返す。

待機上限は `API_TIMEOUT_MS` に定義し、zipcloud・Google Maps Geocoding・DeepL はそれぞれ **5,000 ms** とする。
期限は要求開始から `response.json()` が完了するまでで、ヘッダー取得後もタイマーを維持する。
超過時は `TimeoutError` を返し、`AbortController` で通信を中断する。
中断に反応しないモックなどでも呼び出し元が待ち続けないよう、期限との `Promise.race()` も行う。
成功・HTTP エラー・JSON エラー・通信障害・期限超過のすべてでタイマーを解除する。

| API | 期限超過時の動作 |
|-----|------------------|
| zipcloud 補完 | `lookupDetailed()` は `error`、`lookup()` は従来どおり `null`。通信失敗の通知を表示する |
| zipcloud 住所検証 | `validate()` は `skip` を返し、住所不一致の警告を出さず変換を継続する |
| DeepL | `translate()` は `null` を返し、対象言語の建物名をローマ字表記にする |
| Google Maps Geocoding | `search()` は `null` を返し、地図エラーを表示して住所・プレビューを表示する |

DeepL の各言語は並行実行するため、言語数分の待機時間を直列には加算しない。
R-5 では住所検証 → 翻訳まで待って結果を表示し、変換ボタンを復帰させる。地図検索はその後に独立して最大 5 秒待つ。
すべてが期限超過する場合、住所の表示待ちは最大で約 10 秒、地図の待機終了までは合計で約 15 秒となる（ブラウザの処理・スケジューリング時間を除く）。
地図待機中に新たな変換を開始でき、古い要求の応答は新しい地図に反映しない。

---

### 4-9. 静的ファイルのキャッシュとモジュール解決

`firebase.json` は全公開ファイルに `Cache-Control: no-cache` を設定する。
HTML・CSS・JS・設定ファイル・画像に固定 URL の長期キャッシュは設定しない。`no-cache` は保存そのものの禁止ではなく、再利用前の再検証を要求する方針とする。

旧版の `max-age=31536000` から移行するため、`index.html` の CSS と起動 JS の URL を `?v=r4` に変更する。
起動 JS だけの変更では依存ファイルのキャッシュが残るため、同 HTML の import map で全依存モジュールと `js/config.js` も `?v=r4` の URL に解決する。
JS ソース内の相対 import は維持し、Node.js のユニットテストでも同じソースを読み込めるようにする。
移行後は同じ URL でも毎回再検証し、将来の通常更新でクエリーの変更を必須としない。

本番デプロイを伴わない検証は `npm run test:r4:browser` で行う。配信後の実環境確認は `CLAUDE.md` のデプロイ手順に従う。

---

### 4-10. テスト用の通信・設定（R-7）

通常の回帰テストは Playwright Test が起動するループバックの静的サーバーを使う。
テストサーバーの `/js/config.js` は常にテスト用固定値を返し、個人用設定ファイルを読み出さない。
検索・翻訳・地図の各レスポンスは固定住所データ、保留 Promise、エラー応答で再現する。
Google Maps の読み込みスクリプトも固定応答にし、ネットワークへ実 API の要求を送らない。
通常のブラウザテストでは未定義の外部 URL を遮断して失敗とし、R-4 の実キャッシュ検証では外部要求がないことを確認する。
`npm test` はこの経路だけを使い、実 API の手動接続確認は `test:live:*` に分離する。
共通確認では DeepL 用のダミーキー `ci-dummy` をテスト内で返し、7 言語分の成功レスポンスまたは HTTP 503 をモックする。
建物名の翻訳成功・ローマ字へのフォールバック・建物名なしの各ケースを、改修前 `53498c8` の固定期待値と全文比較する。
補助表記は韓国・台湾だけに表示し、コピー対象は全ロケールでメインの住所文字列とする。結果・封筒・はがき・伝票の各コピーボタンも同じメイン住所をコピーする。

---

## 5. データモデル定義

### 5-1. AddressInput

フォームから収集した住所データ。

```typescript
interface AddressInput {
  zip:      string;   // 7桁数字（ハイフンなし）
  pref:     string;   // 都道府県名（例: 東京都）
  city:     string;   // 市区町村名（例: 渋谷区）
  town:     string;   // 町名・番地（例: 渋谷1丁目2番3号）
  bldg?:    string;   // 建物名・部屋番号（省略可）
  prefKana?: string;  // 都道府県カナ（zipcloudから取得、省略可）
  cityKana?: string;  // 市区町村カナ（zipcloudから取得、省略可）
  townKana?: string;  // 町域カナ（zipcloudから取得、省略可）
}
```

### 5-2. ConversionResult

変換結果オブジェクト。

```typescript
interface ConversionResult {
  us:    string;  // American English（改行区切り）
  uk:    string;  // British English
  fr:    string;  // French
  de:    string;  // German
  it:    string;  // Italian
  caEn:  string;  // Canadian English
  caFr:  string;  // Canadian French
  kr:    string;  // Korean（ローマ字メイン）
  tw:    string;  // Traditional Chinese（漢字/ローマ字メイン）
  krAux: string;  // Korean 補助（現地語地名）
  twAux: string;  // Traditional Chinese 補助（繁体字地名）
}
```

### 5-3. LocaleCode

```typescript
type LocaleCode = 'us' | 'uk' | 'fr' | 'de' | 'it' | 'ca-en' | 'ca-fr' | 'kr' | 'tw';
```

### 5-4. ValidationResult

```typescript
type ValidationResult = 'match' | 'mismatch' | 'skip';
```

---

## 6. エラーコード定義

アプリ内部で使用するエラー種別の定数。

| 定数名 | 値 | 説明 |
|-------|----|------|
| `ERR_ZIP_INVALID` | `'ZIP_INVALID'` | 郵便番号の形式が不正 |
| `ERR_ZIP_NOT_FOUND` | `'ZIP_NOT_FOUND'` | 郵便番号が存在しない |
| `ERR_ZIP_API_FAIL` | `'ZIP_API_FAIL'` | zipcloud API 通信エラー |
| `ERR_GEO_NOT_FOUND` | `'GEO_NOT_FOUND'` | ジオコーディング結果なし |
| `ERR_GEO_API_FAIL` | `'GEO_API_FAIL'` | Nominatim API 通信エラー |
| `ERR_REQUIRED_FIELD` | `'REQUIRED_FIELD'` | 必須フィールド未入力 |
| `ERR_COPY_FAIL` | `'COPY_FAIL'` | クリップボードコピー失敗 |

```javascript
// エラー処理の基本方針
// - ユーザー向けエラー（REQUIRED_FIELD, ZIP_INVALID）: フォームにエラー表示
// - API エラー（ZIP_NOT_FOUND, GEO_NOT_FOUND）: 警告またはスキップ
// - 通信エラー（ZIP_API_FAIL, GEO_API_FAIL）: サイレントスキップ
// - コピーエラー（COPY_FAIL）: フォールバック処理（execCommand）
```
