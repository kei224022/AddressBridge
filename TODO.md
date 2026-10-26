# 実装 TODO — AddressBridge

**凡例**:
- `[P0]` … フェーズ0（前提条件、後続フェーズがブロックされる）
- `[P1]` … コアロジック（UIより先に実装・テストする）
- `[P2]` … HTML/CSS（構造とスタイル）
- `[P3]` … JS統合（モジュールをUIに繋ぐ）
- `[P4]` … テスト
- `[P5]` … デプロイ

---

## フェーズ 0 — プロジェクトセットアップ

- [x] Firebase Console でプロジェクトを新規作成する（プロジェクト ID: `addressconversion-93436`）
- [x] `firebase login` でログイン済み
- [x] `.firebaserc` を作成しプロジェクト ID を設定する
- [x] `firebase.json` を CLAUDE.md §10 の内容（セキュリティヘッダー含む）で作成する
- [x] `.gitignore` を作成する（`node_modules/`, `.firebase/`, `.env` を除外）
- [x] `npm install` で ESLint 依存をインストールする
- [x] プレースホルダーの `index.html` を作成し初回デプロイを確認する（`https://addressconversion-93436.web.app`）
- [x] ディレクトリを作成する（`css/`, `assets/icons/`）

---

## Firebase リファレンス

> 初めて Firebase を使う場合の基礎知識・手順まとめ。

### Spark プラン（無料枠）の制限

| 項目                           | 上限                         |
| ------------------------------ | ---------------------------- |
| Hosting ストレージ             | 10 GB                        |
| Hosting データ転送量           | 10 GB / 月                   |
| カスタムドメイン               | 無料で追加可能（上限なし）   |
| SSL 証明書                     | 自動発行・無料               |
| デプロイ保存数（リリース履歴） | 無制限（古いものは自動削除） |

> 個人・小規模サービスであれば Spark プランで十分運用できる。
> 上限に近づくと Firebase Console にアラートが出る。

---

### 主要コマンド早見表

```bash
# ログイン状態を確認する
firebase login:list

# ログインし直す（トークン切れ時）
firebase login

# 現在のプロジェクトを確認する
firebase use

# ローカルプレビュー（ブラウザで http://localhost:5000 を開く）
firebase serve

# 本番デプロイ（Hosting のみ）
firebase deploy --only hosting

# デプロイ対象ファイルの確認（実際にはアップロードしない）
firebase deploy --only hosting --dry-run

# プロジェクト一覧を表示する
firebase projects:list
```

---

### ローカルでの動作確認手順

1. `firebase serve` を実行する
2. ブラウザで `http://localhost:5000` を開く
3. 変更を保存するたびにページをリロードすれば即反映される（ホットリロードなし）
4. 確認が終わったらターミナルで `Ctrl + C` を押して停止する

> **注意**: `firebase serve` は `firebase.json` の `ignore` リストを尊重する。
> ただしセキュリティヘッダーはローカルでは適用されない（本番のみ）。

---

### デプロイ履歴とロールバック

Firebase Hosting は全デプロイの履歴を保持しており、Console から即座にロールバックできる。

**ロールバック手順（CLI）**:
```bash
# リリース履歴を確認する
firebase hosting:releases:list

# 特定バージョンにロールバックする（Console 推奨）
# Firebase Console > Hosting > リリース履歴 > 対象バージョンの「…」> 再デプロイ
```

**ロールバック手順（Console）**:
1. [Firebase Console](https://console.firebase.google.com/project/addressconversion-93436/hosting) を開く
2. Hosting > リリース履歴 を開く
3. 戻したいバージョンの行右端「⋮」→「再デプロイ」をクリックする
4. 数秒で切り戻し完了（ダウンタイムなし）

---

### カスタムドメイン設定手順（詳細）

お名前.com でドメインを取得後、以下の順序で設定する。

#### Step 1 — Firebase Console でドメインを追加する

1. [Firebase Console > Hosting](https://console.firebase.google.com/project/addressconversion-93436/hosting) を開く
2. 「カスタムドメインを追加」をクリックする
3. 取得したドメイン（例: `addressbridge.com`）を入力して次へ進む
4. 表示された **TXT レコード**（所有権確認用）をメモする

#### Step 2 — お名前.com で TXT レコードを登録する

1. お名前.com の「DNS設定」>「DNS レコード設定を利用する」を開く
2. 以下を入力して追加する:
   - タイプ: `TXT`
   - ホスト名: `@`（または空欄）
   - VALUE: Firebase が表示した TXT 文字列
3. 「確認画面へ進む」→「設定する」で保存する

> DNS の反映には最大 **48 時間**かかる場合がある（通常は数分〜数時間）。
> Firebase Console で「確認」ボタンを押して所有権確認が完了するまで待つ。

#### Step 3 — A レコードを設定する

所有権確認が完了すると Firebase が **A レコード用の IP アドレス**を2つ表示する。

お名前.com で以下を追加する（2件）:
- タイプ: `A`
- ホスト名: `@`
- VALUE: Firebase が表示した IP アドレス（2つ）

`www` サブドメインも使う場合は CNAME も追加する:
- タイプ: `CNAME`
- ホスト名: `www`
- VALUE: `addressconversion-93436.web.app.`（末尾にドットが必要な場合あり）

#### Step 4 — SSL 証明書の発行を待つ

DNS 反映後、Firebase が自動的に SSL 証明書（Let's Encrypt）を発行する。
発行までの目安: **数分〜24 時間**。

Firebase Console の Hosting 画面でステータスが「接続済み」になれば完了。

---

### よくある問題と対処法

| 症状                                         | 原因                                             | 対処                                                               |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `firebase deploy` 後も古いページが表示される | ブラウザキャッシュ                               | `Ctrl + Shift + R`（強制リロード）、またはシークレットモードで確認 |
| カスタムドメインが「保留中」のまま           | DNS 未反映                                       | 最大 48 時間待つ。`dig TXT ドメイン名` で確認                      |
| `firebase serve` でページが 404 になる       | `index.html` が存在しない or `public` の指定ミス | `firebase.json` の `"public": "."` を確認                          |
| デプロイ後に JS/CSS が古いまま               | Cache-Control の max-age が長い                  | ファイル名にハッシュを付けるか、シークレットモードで確認           |
| `firebase login` が認証エラーになる          | トークン期限切れ                                 | `firebase logout` してから `firebase login` し直す                 |
| `Error: HTTP Error: 400` がデプロイ時に出る  | `firebase.json` の設定ミス                       | `firebase deploy --only hosting --dry-run` でエラー内容を確認する  |

---

## フェーズ X — バグ修正・UI改修（優先対応）

> 動作確認で発覚した不具合と改修要件。フェーズ1〜4の実装コードを修正する。
> **API キーが必要な項目は事前に取得してから着手する。**

### X-1. 「住所を補完する」ボタン廃止

- [x] `index.html` から `<button id="btn-autocomplete">` を削除する
- [x] `css/style.css` から `.btn-secondary` のうち補完ボタン固有スタイルを削除する
- [x] `js/main.js` から `btnAutocomp` 変数・イベントリスナー・`setLoading(btnAutocomp, ...)` を削除する
- [x] `doAutocomplete()` は内部関数として残し `onZipInput()` からのみ呼び出す形に整理する
- [x] `npm run lint` でエラーがないことを確認する

### X-2. 郵便番号補完で町域名（address3）まで自動入力

- [x] `js/main.js` の `doAutocomplete()` で `inputTown.value = result.town` を追加する
  - `result.town` が空の場合（一部郵便番号では address3 が空）は何もしない
- [x] `storedKana.townKana` は引き続き `result.townKana` をセットする
- [x] フォーカスを「町名・番地」の**末尾**に移動する（追記しやすいよう cursor を行末に）
- [x] `npm run lint` でエラーがないことを確認する

### X-3. ヘッダー z-index 修正（地図 UI との重なり解消）

- [x] `css/style.css` の `.site-header { z-index: 200; }` を `z-index: 1001` に変更する
  - Google Maps のデフォルト z-index（コントロール類: ~100〜1000）より必ず大きくする
- [ ] ローカルで `firebase serve` を実行し、スクロール時にヘッダーが地図の上に表示されることを確認する（ブラウザ手動）

### X-4. ローマ字変換バグ修正（カナなし手動入力時の空文字問題）

- [x] `js/converter.js` の `buildCityRoman(cityKana)` に漢字フォールバックを追加する
  - `cityKana` が空かつ `city`（漢字）が渡された場合、末尾文字（区/市/町/村）から接尾語を推定する
  - 例: `city = '渋谷区'` → 末尾が `区` → `buildCityRoman` にフォールバック接尾語として `-ku` を付与
- [x] `js/converter.js` の `townRoman` 計算を修正する
  - `townKana` が空かつ `town` フィールドがひらがな・カタカナを含む場合、`town` を直接 `convert()` に渡す
  - 例: `town = 'なんば1丁目2番3号'` → 先頭カナ部分 'なんば' を抽出して 'Nanba' に変換
- [x] `js/formats.js` の全フォーマット関数を `joinParts()` / `streetLineUs()` / `streetLineDe()` ヘルパーに刷新し、townRoman が空でも余分なスペース・カンマが出ないように修正する
- [x] 修正後に TC-F-001〜TC-F-010（全9ロケール）を再実行してすべて PASS を確認する
- [x] `npm run lint` でエラーがないことを確認する

---

## フェーズ Y — Google Maps 移行

> **前提**: Google Cloud Console でプロジェクトを作成し、API キーを取得済みであること。
> Maps JavaScript API・Geocoding API の両方を有効化する。

### Y-1. 事前準備（手動作業）

- [x] [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成する
- [x] 「API とサービス」→「ライブラリ」で **Maps JavaScript API** を有効化する
- [x] 「API とサービス」→「ライブラリ」で **Geocoding API** を有効化する
- [x] 「API とサービス」→「認証情報」→「認証情報を作成」→「API キー」で新規作成する
- [x] 作成した API キーに **HTTP リファラー制限**を設定する（本番ドメイン + `localhost:5000`）
- [x] API キーを `js/config.js`（gitignore 対象）に保存する

```javascript
// js/config.js（.gitignore に追加すること）
export const GOOGLE_MAPS_API_KEY = 'AIzaSy...';
export const DEEPL_API_KEY = '';  // Y-2 で設定
```

### Y-2. `js/geocoder.js` を Google Maps Geocoding API に差し替える

- [x] `import` 文を更新し `GOOGLE_MAPS_API_KEY` を `config.js` から取得する
- [x] エンドポイントを `https://maps.googleapis.com/maps/api/geocode/json?address=...&key=...&language=ja&region=JP` に変更する
- [x] レスポンスから `results[0].geometry.location.lat` / `.lng` を取得する
- [x] ネットワーク障害・0件レスポンス時は `null` を返す（既存のエラーハンドリングを維持）
- [x] `npm run lint` でエラーがないことを確認する

### Y-3. `js/map.js` を Google Maps JavaScript API に移行する

- [x] Leaflet 依存コードをすべて削除する
- [x] `MapController.init(elementId)` を `google.maps.Map` の初期化に書き換える
  - `center: { lat: 36.2, lng: 138.2 }`, `zoom: 5` で初期表示
- [x] `MapController.show(lat, lon, label)` を `google.maps.Marker` + `google.maps.InfoWindow` に書き換える
  - `map.setCenter({ lat, lng: lon })`, `map.setZoom(15)`
- [x] `MapController.hide()` / `MapController.showError()` を維持する
- [x] `npm run lint` でエラーがないことを確認する

### Y-4. `index.html` を更新する

- [x] `<head>` から Leaflet CSS の `<link>` を削除する
- [x] `</body>` 直前の Leaflet JS `<script>` を削除する
- [x] Google Maps JS API の `<script async src="...?key=...&callback=initMap">` を追加する
  - `callback=initMap` を指定し、`window.initMap` で `MapController.init()` を呼び出す
- [x] `map-container` div はそのまま維持する

### Y-5. ローカル動作確認

- [x] `firebase serve` で起動し、実在する住所を入力して変換する
- [x] Google Maps に正しい位置（番地レベル）でマーカーが表示されることを確認する
- [x] ヘッダーが地図より前面に表示されることを確認する（X-3 の修正効果）

---

## フェーズ Z — DeepL API 統合（建物名翻訳）

> **前提**: DeepL アカウントを作成し、Free プランの API キーを取得済みであること。
> `js/config.js` の `DEEPL_API_KEY` に設定する。

### Z-1. `js/translator.js` を新規作成する

- [x] `DeepL.translate(text, targetLang)` を実装する
  - エンドポイント: `https://api-free.deepl.com/v2/translate`
  - `DEEPL_API_KEY` が空の場合は即座に `null` を返す（フォールバック）
  - ネットワーク障害・API エラー時は `null` を返す
- [x] `DeepL.LOCALE_TO_LANG` マッピングを定義する（`us → EN-US`, `kr → KO` など）
- [x] `npm run lint` でエラーがないことを確認する

### Z-2. `js/converter.js` に翻訳を組み込む

- [x] `convertAll(address)` を非同期関数（`async`）に変更する
- [x] `bldg`（建物名）がある場合のみ DeepL で翻訳し、各ロケールの `bldgRoman` を上書きする
  - `bldg` が空 or `DEEPL_API_KEY` 未設定の場合は既存の `convertBldg()` を使用する
- [x] `main.js` の `onConvert()` で `await convertAll(...)` に変更する
- [x] TC-F-001〜TC-F-010 を再実行してすべて PASS を確認する
- [x] `npm run lint` でエラーがないことを確認する

---

## フェーズ W — Google AdSense 広告実装

> **前提**: 独自ドメインを取得・設定済みであること（web.app ドメインでは審査通過率が低い）。

### W-1. AdSense 申請準備

- [ ] [Google AdSense](https://www.google.com/adsense/) でアカウントを作成する
- [ ] サイト URL に独自ドメインを登録する
- [x] AdSense が発行する確認用 `<script>` タグを `<head>` に追加してデプロイする
- [ ] AdSense 管理画面で「審査中」→「承認済み」になるまで待つ（数日〜数週間）

### W-2. 広告ユニット配置（承認後）

- [ ] AdSense 管理画面で「広告ユニット」→「ディスプレイ広告」を2ユニット作成する
  - 広告エリア A（フォームセクション下）用
  - 広告エリア B（変換結果セクション下）用
- [x] `index.html` に広告エリア A・B の `<ins class="adsbygoogle">` を追加する（CLAUDE.md §14 参照）
- [x] `css/style.css` に `.ad-unit` スタイルを追加する
- [ ] `firebase deploy --only hosting` でデプロイし表示を確認する

---

## フェーズ 1 — コアロジック実装

> **実装順序**: `romanize.js` → `formats.js` → `converter.js` → `zipcloud.js` → `geocoder.js`
> 各ファイルは `export` を使った ES Module として実装する。

### 1-1. `js/romanize.js`

- [x] カナ→ローマ字変換テーブルを定義する（API_SPEC.md §4-3 の変換テーブル参照）
  - [x] 清音・濁音・半濁音（五十音順）
  - [x] 拗音（sha / chi / tsu / ja / cha など）
  - [x] 促音（次の子音を重ねる）
  - [x] 「ん」の処理（母音・y の前は `n'`、それ以外は `n`）
  - [x] 長音の短縮（おう → o、おお → o、うう → u）
- [x] `Romanize.convert(text)` を実装する（ひらがな・カタカナ → ヘボン式ローマ字、先頭大文字）
- [x] `Romanize.convertBanchi(text)` を実装する（丁目・番・号・の → ハイフン区切り、全角数字対応）
- [x] `Romanize.convertBldg(text)` を実装する（建物名をローマ字化、ビル→Bldg 等の略語置換）
- [x] TC-R-001〜TC-R-004 / TC-B-001〜TC-B-002 を Node.js で実行して全 26 ケース PASS を確認する
- [x] `npm run lint` でエラーがないことを確認する

> **設計メモ**: `convert()` は純粋カナ→ローマ字変換のみ。行政区分接尾語（-ku / -shi / -ken 等）の
> 付与は `converter.js` が担当する（TC-R-002 の期待値はその層で満たす）。

### 1-2. `js/formats.js`

- [x] `Formats.COUNTRY_NAME` 定数を定義する（9ロケール分の「日本」表記）
- [x] `Formats.LOCALES` 配列を定義する（`['us','uk','fr','de','it','ca-en','ca-fr','kr','tw']`）
- [x] 各国フォーマット関数（`(parsed) => string`）を実装する
  - [x] `us` — 番地+町名, 区, 都市+郵便番号, JAPAN
  - [x] `uk` — 番地+町名, 区, 都市, 郵便番号, JAPAN（郵便番号が単独行）
  - [x] `fr` — 番地+町名, 区, 郵便番号+都市, JAPON
  - [x] `de` — 町名+番地, 区, 郵便番号+都市, JAPAN（ドイツ式: 通り名→番地の順）
  - [x] `it` — 町名+番地, 区, 郵便番号+都市, GIAPPONE
  - [x] `ca-en` — US と同形式
  - [x] `ca-fr` — FR と同形式（JAPON 表記）
  - [x] `kr` — 일본+郵便番号, 都道府県+市区町村+町名+番地, 建物名（大→小の順）
  - [x] `tw` — 日本+郵便番号, 都道府県+市区町村+町名+番地, 建物名（大→小の順）
- [x] `Formats.get(locale)` 関数を実装する（ロケールコードからフォーマット関数を返す）
- [x] `Formats.KR_DICT` を定義する（160件: 47都道府県・20政令市・東京23区・大阪市区・主要市）
  - [x] 47 都道府県のハングル表記をすべて登録する
  - [x] 主要政令指定都市・特別区（東京23区・大阪市各区など）を登録する
- [x] `Formats.TW_DICT` の代わりに `toTraditional()` 関数を実装する（文字単位変換）
  - [x] 繁体字への変換が必要な漢字（渋→澀、浜→濱、区→區など）を変換マップに登録する
  - [x] 辞書にない漢字はそのまま出力（共通漢字はそのまま使用）
- [x] TC-F-001〜TC-F-010 を Node.js で実行して全テスト PASS を確認する
- [x] `npm run lint` でエラーがないことを確認する

> **設計メモ**: TW辞書は個別地名辞書ではなく文字単位の変換マップ（`JA_TO_TW`）を採用。
> スケーラブルで未登録地名でも自動変換される。KR補助表示用に `kr-aux` / `tw-aux` ロケールも定義済み。

### 1-3. `js/converter.js`

- [x] `Converter.parseAddress(address)` を実装する
  - [x] zipcloud のカナフィールドを使い各コンポーネントをローマ字化する
  - [x] カナが未取得の場合は47都道府県フォールバックテーブルで補完する
  - [x] `ParsedAddress` オブジェクトを返す（prefRoman / prefRomanFull / cityRoman / townRoman / banchi / bldgRoman / zip）
- [x] `Converter.convertTo(address, locale)` を実装する（`parseAddress` + `Formats.get(locale)` を組み合わせる）
- [x] `Converter.convertAll(address)` を実装する（全9ロケール＋KR補助/TW補助を一括生成）
- [x] 建物名が空の場合に建物名行を出力しないことを確認する（TC-F-010）
- [x] TC-F-001〜TC-F-010 を Node.js で実行して全テスト PASS を確認する
- [x] `npm run lint` でエラーがないことを確認する

> **設計メモ**:
> - `prefRoman`（Tokyo）と `prefRomanFull`（Tokyo-to）を分離: 欧米フォーマットは前者、KR は後者を使用
> - KR/TW の現地語地名は `convertTo()` / `convertAll()` 内で付与し、フォーマット関数に渡す
> - `String.normalize('NFKC')` で全角→半角を統一してから番地を抽出する
> - `formats.js` の `formatKr` を `prefRomanFull` を使用するよう同時更新済み

### 1-4. `js/zipcloud.js`

- [x] `ZipCloud.normalizeZip(input)` を実装する（全角・ハイフン・スペースを除去、7桁未満は空文字列）
- [x] `ZipCloud.lookup(zipcode)` を実装する
  - [x] `fetch` で zipcloud API を呼び出す
  - [x] `ZipResult` オブジェクトを返す（`null` on failure）
  - [x] ネットワーク障害時・API エラー時は例外をスローせず `null` を返す
- [x] `ZipCloud.validate(zipcode, pref, city)` を実装する（`'match'` / `'mismatch'` / `'skip'` を返す）
- [ ] ブラウザコンソールで TC-Z-001〜TC-Z-003 / TC-V-002 を手動実行して確認する
- [x] `npm run lint` でエラーがないことを確認する

### 1-5. `js/geocoder.js`

- [x] `buildGeoQuery(address)` を実装する（住所オブジェクト → Nominatim 検索クエリ文字列）
- [x] `Geocoder.search(address)` を実装する
  - [x] `fetch` で Nominatim API を呼び出す（`User-Agent` ヘッダー必須）
  - [x] `countrycodes=jp` パラメータを付与する
  - [x] `{ lat, lon }` を返す（`null` on failure）
  - [x] ネットワーク障害・空配列レスポンス時は `null` を返す
- [ ] ブラウザコンソールで TC-G-001〜TC-G-002 を手動実行して緯度経度が日本国内範囲内（緯度 24〜46、経度 122〜154）に収まることを確認する
- [x] `npm run lint` でエラーがないことを確認する

---

## フェーズ 2 — HTML・CSS実装

> P1 が完了していなくても先行して実装可能。ただし動作確認は P3 以降。

### 2-1. `index.html` — 構造

- [x] `<head>` を実装する
  - [x] `charset`, `viewport`, `lang="ja"` を設定する
  - [x] `<title>` を `AddressBridge — 日本語住所を英語・多言語に変換` とする
  - [x] OGP メタタグ（`og:title`, `og:description`, `og:url`, `og:image`）を設定する
  - [x] Leaflet CSS を CDN から読み込む
  - [x] Google Fonts（Noto Sans JP / Inter）を読み込む
  - [x] `css/style.css` を読み込む
- [x] ヘッダーセクションを実装する（エアメールストライプ上下・ロゴ・サービス名・サブタイトル）
- [x] 入力フォームセクションを実装する
  - [x] 郵便番号フィールドと補完ボタン
  - [x] 都道府県・市区町村フィールド（横並び）
  - [x] 町名・番地フィールド
  - [x] 建物名・部屋番号フィールド（任意）
  - [x] 警告バナー要素（`role="alert"` 付き、初期は非表示）
  - [x] 変換ボタン
- [x] 地図セクションを実装する（Leaflet コンテナ、初期は非表示）
- [x] 変換結果セクションを実装する
  - [x] 言語タブ 9個（US / UK / FR / DE / IT / CA-EN / CA-FR / KR / TW）
  - [x] 結果表示エリア（`<pre>` または `<div>`）
  - [x] 補助表示エリア（KR / TW のみ表示、初期は非表示）
- [x] プレビューセクションを実装する
  - [x] プレビュー切り替えタブ（封筒 / はがき / 伝票）
  - [x] 封筒プレビュー HTML（FROM欄・AIR MAIL ラベル・切手枠・TO欄）
  - [x] はがきプレビュー HTML（左装飾エリア・右宛名欄・切手枠）
  - [x] 伝票プレビュー HTML（タイトル・SHIP TO 欄・FROM 欄・バーコード装飾）
  - [x] 各プレビューにコピーボタンを配置する
- [x] フッターセクションを実装する（プライバシー・ライセンス・免責事項・URL）
- [x] `<noscript>` タグで JS 無効時のメッセージを表示する
- [x] Leaflet JS と `js/main.js`（`type="module"`）を `</body>` 直前に読み込む

### 2-2. `css/style.css` — スタイル

- [x] CSS カスタムプロパティ（変数）を定義する
  - [x] カラー（赤 `#e63329`・青 `#1a5276`・背景 `#fafafa`・フッター `#2c3e50` など）
  - [x] フォント・サイズ・余白の基本値
- [x] リセット・ベーススタイルを実装する（`box-sizing`, フォント, カラー）
- [x] ヘッダーをスタイリングする
  - [x] エアメールストライプ（赤・白・青の斜め縞 CSS グラデーション）
  - [x] ロゴ・サービス名・サブタイトルの配置
- [x] フォームエリアをスタイリングする
  - [x] フィールドのラベル・インプット
  - [x] エラー状態（枠線赤・エラーメッセージ）
  - [x] プライマリボタン・セカンダリボタン
  - [x] ローディングスピナー（CSS アニメーション）
  - [x] 警告バナー（黄背景 `#fff3cd`・アイコン）
  - [x] スナックバー（`position: fixed` + フェードアニメーション）
- [x] 地図コンテナをスタイリングする（高さ・ボーダー）
- [x] 言語タブをスタイリングする
  - [x] 通常・選択中・ホバー状態
  - [x] SP の横スクロール対応（`overflow-x: auto`）
- [x] 変換結果エリアをスタイリングする（等幅フォント・背景・補助表示）
- [x] 封筒プレビューをスタイリングする
  - [x] 外枠・FROM欄・TO欄の配置
  - [x] AIR MAIL スタンプ風装飾・切手枠（破線）
- [x] はがきプレビューをスタイリングする（横2分割・罫線・切手枠）
- [x] 伝票プレビューをスタイリングする（黒枠・バーコード装飾）
- [x] フッターをスタイリングする（ダークネイビー背景・セクション見出し）
- [x] レスポンシブスタイルを実装する
  - [x] SP（〜599px）: 1カラム・ボタン幅100%・タブ横スクロール
  - [x] タブレット（600〜959px）: 2カラムフォーム
  - [x] PC（960px〜）: 最大幅 960px・中央寄せ

---

## フェーズ 3 — JS統合

> P1 と P2 が完了していることが前提。

### 3-1. `js/map.js`

- [x] `MapController.init(elementId)` を実装する（Leaflet マップを初期化、`L` グローバルを使用）
- [x] `MapController.show(lat, lon, label)` を実装する（マップ移動・ズーム15・マーカー・ポップアップ）
- [x] `MapController.hide()` を実装する（地図エリアを `display: none`）
- [x] `MapController.showError()` を実装する（「地図を表示できませんでした」テキストを表示）
- [ ] Attribution（`© OpenStreetMap contributors`）が表示されることを確認する
- [x] `npm run lint` でエラーがないことを確認する

### 3-2. `js/main.js`

- [x] DOM 要素の参照を一か所にまとめて取得する（`querySelector` etc.）
- [x] `MapController.init()` をページロード時に呼び出す
- [x] `onZipInput()` を実装する
  - [x] 入力値をリアルタイムで整形する（3桁目の後にハイフンを自動挿入）
  - [x] 7桁（ハイフン除く）になった瞬間に `ZipCloud.lookup()` を呼んで補完する
  - [x] 補完中はボタンをローディング状態にする
  - [x] 補完完了後に町名・番地フィールドへフォーカスを移す
  - [x] 補完失敗時はスナックバー「郵便番号が見つかりませんでした」を 3 秒表示する
- [x] `validate()` を実装する（必須フィールドの空チェック・エラー表示）
- [x] `onConvert()` を実装する（API_SPEC.md §4-7 のフロー通り）
  - [x] バリデーション失敗時は処理中断しエラーを表示する
  - [x] 変換ボタンをローディング状態にする（連打防止）
  - [x] `ZipCloud.validate()` を呼び出し、`'mismatch'` なら警告バナーを表示する
  - [x] `Converter.convertAll()` で全言語を変換する
  - [x] `Geocoder.search()` でジオコーディングする
  - [x] 地図・変換結果・プレビューを描画する
  - [x] 地図エリアへ smooth scroll する
  - [x] ボタンを通常状態に戻す
- [x] `renderResults(result)` を実装する（変換結果を全タブに書き込む）
- [x] `renderPreviews(result)` を実装する（封筒・はがき・伝票の宛先住所を書き込む）
- [x] `onTabChange(locale)` を実装する（タブの選択状態切り替え・結果エリア・プレビュー連動）
- [x] `onPreviewChange(type)` を実装する（封筒/はがき/伝票の切り替え）
- [x] `onCopy(locale)` を実装する
  - [x] `navigator.clipboard.writeText()` でコピーする
  - [x] コピー後 2 秒間「✓ コピーしました」表示、その後ラベルをリセットする
  - [x] `execCommand('copy')` フォールバックを実装する
- [x] KR / TW タブ選択時のみ補助表示エリアを表示する
- [x] `npm run lint` でエラーがないことを確認する

---

## フェーズ 4 — テスト

### 4-1. ユニットテスト（Node.js で実施済み）

- [x] TC-R-001〜004: `Romanize.convert()` の全26ケース PASS（Node.js）
- [x] TC-B-001〜002: `Romanize.convertBanchi()` の全10ケース PASS（Node.js）
- [x] TC-F-001〜009: `Converter.convertTo()` で9言語の住所フォーマットが仕様通りの行構成になることを確認する
- [x] TC-F-010: 建物名なしで変換した際に建物名行が出力されないことを確認する
- [x] TC-Z-001〜003: `ZipCloud.lookup()` / `ZipCloud.validate()` をブラウザで確認する（TC-Z-001はNode.jsで確認済み）
- [x] TC-V-002: `ZipCloud.normalizeZip()` の8ケース PASS（Node.js）

### 4-2. 機能テスト（ブラウザ手動）

- [x] TC-A-001〜003: 住所補完フローを確認する（ハイフン自動挿入・補完成功・補完失敗）
- [x] TC-V-001〜003: フォームバリデーションを確認する（必須未入力・エラークリア）
- [x] TC-C-001〜004: 変換フロー E2E を確認する（標準変換・警告表示・建物名なし・連続変換）
- [x] TC-P-001〜004: プレビュー切り替えとコピー機能を確認する
- [x] TC-M-001〜002: 地図表示とジオコーディング失敗時の動作を確認する
- [x] TC-T-001〜002: 全9タブの表示内容を確認する（国名表記・郵便番号・行構成）

### 4-3. エッジケーステスト

- [x] TC-E-001: 特殊な住所入力（番地なし・長い建物名・記号・英数字混在・郡部）を確認する
- [ ] TC-E-002: API 障害時の動作を確認する（ネットワーク切断でコンソールタブから確認）
- [ ] TC-E-003: クリップボード API の動作を確認する
- [x] TC-E-004: 変換ボタン連打・補完中の変換ボタン押下を確認する

### 4-4. 非機能テスト

- [x] TC-N-001: Chrome DevTools でモバイルエミュレーション（375px）のレイアウトを確認する
- [ ] TC-N-002: Firefox・Safari（Mac）でも全機能が動作することを確認する
- [x] TC-N-004: キーボード操作（Tab移動）とコントラスト比を確認する
- [x] TC-N-005: Network タブで自サーバーへの住所送信がないことを確認する（zipcloud / Nominatim のみ）
- [x] `npm run lint` が全ファイルでエラー 0 であることを確認する

---

## フェーズ 5 — デプロイ準備・リリース

- [x] favicon を作成し `<head>` に設定する（封筒アイコン or ✈ を使用）
- [x] OGP 画像を作成し `assets/` に配置する
- [x] `firebase.json` の `ignore` リストに `TODO.md`, `TEST_SPEC.md`, `API_SPEC.md`, `SCREEN_SPEC.md` を追加してドキュメントが公開されないようにする
- [x] `npm run lint` が通ることを最終確認する
- [x] `firebase serve` でローカルプレビューを確認する
- [x] `firebase deploy --only hosting` でステージング確認用 URL（`*.web.app`）に初回デプロイする
- [x] ステージング URL で全機能を再確認する
- [ ] お名前.com で独自ドメインを取得する
- [ ] 「Firebase リファレンス > カスタムドメイン設定手順」の Step 1〜4 に従って設定する
- [ ] Firebase Console のステータスが「接続済み」になることを確認する（最大 48 時間）
- [ ] 独自ドメインで全機能が動作することを最終確認する
- [ ] CLAUDE.md §13 の未決定事項を更新する
  - [ ] 独自ドメインを記入する
  - [ ] Nominatim User-Agent の連絡先メールアドレスを確定する
  - [ ] 繁体字辞書の対象範囲を確定して記入する

---

## 保留・将来対応

> 初期リリースには含めないが検討すること。

- [ ] カナダフランス語（CA-FR）のフォーマットを French（FR）と同一にするか、ケベック州固有の慣習に合わせるかを再検討する
- [ ] 繁体字辞書を主要市区まで拡充する（初期リリースは47都道府県のみ）
- [ ] Google Search Console に登録してインデックスを促進する
- [ ] Nominatim の利用量が増えた場合に独自インスタンスまたは代替 API への移行を検討する
