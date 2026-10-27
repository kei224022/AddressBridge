# CLAUDE.md — AddressBridge

---

## 1. プロジェクト概要

**AddressBridge** は、日本語の住所を入力すると G7 各国・韓国・台湾向けの
住所表記フォーマットに変換する、静的 Web アプリケーションです。

- **変換方向**: 日本語住所 → 各国フォーマット（逆方向は非対応）
- **主なユーザー**: 個人・業務用（国際郵便・国際配送を行う方）
- **公開形態**: Firebase Hosting（Spark プラン）+ 独自ドメイン（お名前.com）
- **ライセンス**: CC BY 4.0（Creative Commons Attribution 4.0 International）
- **プライバシー方針**: 入力住所をサーバーへ送信・収集しない（完全クライアントサイド処理）

---

## 2. 技術スタック

| 区分 | 技術 | 備考 |
|------|------|------|
| フロントエンド | HTML5 / CSS3 / Vanilla JavaScript (ES6+) | フレームワーク不使用 |
| ホスティング | Firebase Hosting (Spark プラン) | 静的ファイルのみ |
| 地図 | Google Maps JavaScript API | API キー必須・有料（無料枠あり） |
| ジオコーダー | Google Maps Geocoding API | API キー必須・有料（無料枠あり） |
| 郵便番号 API | zipcloud | 無料・非公式 |
| 建物名翻訳 | DeepL API（Free/Pro） | API キー必須・建物名のみ使用 |
| 広告収益 | Google AdSense | 審査・承認が必要 |
| パッケージ管理 | npm（devDependencies のみ） | ビルドツール不使用 |
| リンター | ESLint v9（flat config） | `npm run lint` / `npm run lint:fix` |

### 外部ライブラリ

```html
<!-- Google Maps JavaScript API -->
<script async src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap"></script>
```

> **旧: Leaflet.js + OpenStreetMap → 廃止**（地図精度の問題により Google Maps に移行）

---

### 設計書および仕様書

画面設計
@SCREEN_SPEC.md

API仕様書
@API_SPEC.md

テスト仕様書
@TEST_SPEC.md
---

## 3. ディレクトリ構成

```
/
├── index.html
├── firebase.json
├── .firebaserc
├── css/
│   └── style.css           # メインスタイル（エアメールテーマ）
├── js/
│   ├── main.js             # アプリ初期化・住所変換フロー
│   ├── address-form.js     # 入力・郵便番号補完・検証・カナの管理
│   ├── result-view.js      # 変換結果・言語タブ・プレビュー描画
│   ├── clipboard.js        # コピー操作・フォールバック
│   ├── ui.js               # 待機表示・スナックバー
│   ├── locales.js          # ロケール・結果キー・翻訳先の共通定義
│   ├── http.js             # 外部 API の JSON 取得・タイムアウト・中断
│   ├── converter.js        # 住所変換メインロジック
│   ├── formats.js          # 各国フォーマット定義・地名辞書
│   ├── romanize.js         # ヘボン式ローマ字変換
│   ├── zipcloud.js         # 郵便番号 API 連携・住所補完・検証
│   ├── translator.js       # DeepL 建物名翻訳
│   ├── geocoder.js         # Google Maps 連携（住所→緯度経度）
│   └── map.js              # Google Maps 地図操作
└── assets/
    └── icons/              # スタンプ・封筒アイコンなど
```

---

## 4. 機能仕様

### 4-1. 住所入力フォーム

| フィールド | 必須 | 説明 |
|-----------|------|------|
| 郵便番号 | ○ | 7桁（ハイフンあり/なし両対応）|
| 都道府県 | ○ | 郵便番号補完で自動入力 |
| 市区町村 | ○ | 郵便番号補完で自動入力 |
| 町名・番地 | ○ | 郵便番号補完で町域名まで自動入力。ユーザーが番地を追記する |
| 建物名・部屋番号 | △ | 任意。例: ○○ビル3F |

**郵便番号入力 → 住所補完フロー**（ボタンなし・自動）:
1. 郵便番号フィールドへの入力をリアルタイム監視
2. 3桁目入力後にハイフンを自動挿入（`150` → `150-`）
3. **7桁（ハイフン除く）が揃った瞬間に自動で** zipcloud API を呼び出す
4. **都道府県・市区町村・町域名（address3）を自動入力**する
5. フォーカスを「町名・番地」フィールドへ移動する（ユーザーは番地のみ追記）
6. 該当なしは「郵便番号が見つかりませんでした」、通信/API エラーは「郵便番号の検索に失敗しました。通信状況を確認して再試行してください」をスナックバーで 3 秒表示

> **「住所を補完する」ボタンは廃止**。自動補完に一本化する。

補完は最新の要求だけを反映する。待機中に郵便番号や住所（建物名を含む）を編集した場合は、古い応答による上書き・通知・フォーカス移動を行わない。
郵便番号の変更・削除時は取得済みカナを無効化する。同じ番号に戻しても、以前の要求は復活しない。

### 4-2. 住所検証

- zipcloud で「郵便番号 → 都道府県+市区町村」を照合する
- 入力値と API レスポンスが**不一致の場合のみ**、警告バナーを表示
  - 例: `⚠️ 入力された住所が郵便番号と一致しない可能性があります。ご確認ください。`
- 警告が出ても変換実行は妨げない（エラーではなく警告）
- zipcloud が応答しない場合はスキップ（無警告）
- HTTP エラー、不正 JSON、API エラー、不正なレスポンス構造もスキップする。正常検索で該当なしの場合は不一致として警告する
- 外部 API は `http.js` で要求開始から本文読み込み完了までを各 5 秒に制限する。期限超過時は zipcloud 検証をスキップ、DeepL をローマ字表記、地図検索をエラー表示へフォールバックする

### 4-3. 住所変換

- 「変換」ボタン押下で全言語フォーマットを一括生成
- **構造化アドレス成分**（都道府県・市区町村・町名・番地）: ヘボン式ローマ字（zipcloud のカナフィールドを使用）
- **建物名**: DeepL API で各ロケール言語に翻訳する（オプション。APIキー未設定時はローマ字フォールバック）
- **補助表示**: 韓国語・繁体字中国語のみ、主要地名の現地語を併記

> **ローマ字変換にはカナデータが必要**。zipcloud 補完を使わず手動入力した場合、
> 市区町村・町名のカナが取得できず変換精度が低下する。
> 補完を使うことを UI 上で誘導する（ヘルプテキスト）。

**DeepL 利用方針**:
- 対象: 建物名・部屋番号フィールドのみ（例: `渋谷スカイビル3F` → `Shibuya Sky Bldg 3F`）
- 都道府県・市区町村・町名は DeepL を使わない（地名固有名詞はローマ字が国際標準）
- API キーがない場合は既存のローマ字変換でフォールバック

### 4-4. 地図表示

- Google Maps Geocoding API で入力住所を検索し緯度経度を取得
- Google Maps JavaScript API でマーカーを立てて表示
- ズームレベル: **15**（丁目・街区レベル）
- マーカークリックで住所のポップアップ表示
- フォールバック: 応答なし / 結果なしの場合は「地図を表示できませんでした」を表示

> **Nominatim + Leaflet は廃止**。番地レベルの精度問題により Google Maps に移行。

### 4-5. プレビュー UI（封筒・はがき・伝票）

各プレビューには変換後住所を表示し、コピーボタンを設置する。

| プレビュー種別 | 表示内容 |
|--------------|---------|
| 国際エアメール封筒 | From欄（日本語）/ To欄（変換後） |
| ポストカード（はがき）| 宛名欄に変換後住所 |
| 国際宅配便伝票 | 送り先住所欄に変換後住所 |

**コピーボタン仕様**:
- `navigator.clipboard.writeText()` を使用
- コピー完了後「✓ コピーしました」を 2 秒間表示してリセット

---

## 5. 対応言語・国フォーマット

| # | 出力言語 | 対象国 | 「日本」の表記 |
|---|---------|--------|-------------|
| 1 | American English | アメリカ (US) | JAPAN |
| 2 | British English | イギリス (UK) | JAPAN |
| 3 | French | フランス (FR) | JAPON |
| 4 | German | ドイツ (DE) | JAPAN |
| 5 | Italian | イタリア (IT) | GIAPPONE |
| 6 | Canadian English | カナダ英語圏 (CA-EN) | JAPAN |
| 7 | Canadian French | カナダ仏語圏 (CA-FR) | JAPON |
| 8 | 한국어 (Korean) | 韓国 (KR) | 일본 |
| 9 | 繁體中文 (Traditional Chinese) | 台湾 (TW) | 日本 |

> **Japan は入力言語のため変換対象外**。

### カナダ仏語圏 (CA-FR) フォーマット

```
[建物名・部屋番号]
[番地]-[街区]-[号] [町名], [区名]
[〒郵便番号] [市・都道府県名]
JAPON
```

（フランス語と同じ「郵便番号 + 都市名」同一行ルールを適用。
 「日本」の表記は JAPON。）

---

## 6. 住所変換ロジック

### 6-1. ヘボン式ローマ字変換（日本郵便準拠）

| 変換ルール | 例 |
|-----------|-----|
| 長音「ō」 | 大阪 → Osaka（oh は使わず o に統一） |
| 長音「ū」 | 都 → To（u 省略） |
| 拗音「sha/chi/tsu」 | 渋谷 → Shibuya |
| 「ん」の扱い | 本 → hon（母音・y の前は n' → n） |
| 行政区分の接尾語 | -都/-道/-府/-県 → -to/-do/-fu/-ken 省略推奨 |
| 区 | -ku |
| 市 | -shi（省略可） |
| 町 | -cho / -machi |
| 村 | -mura |
| 丁目-番-号 | 1丁目2番3号 → 1-2-3 |

### 6-2. 各国フォーマット（住所の並び順）

日本郵便の国際郵便英語表記ルール（小→大の順）を基本とし、
各国慣習に合わせて微調整する。

#### アメリカ英語 (US)
```
[建物名・部屋番号]
[番地]-[街区]-[号] [町名], [区名]
[市・都道府県名] [〒郵便番号]
JAPAN
```
例:
```
OO Bldg 3F
1-2-3 Shibuya, Shibuya-ku
Tokyo 150-0002
JAPAN
```

#### イギリス英語 (UK)
```
[建物名・部屋番号]
[番地]-[街区]-[号] [町名], [区名]
[市・都道府県名]
[〒郵便番号]
JAPAN
```
（郵便番号を単独行にする UK 慣習に合わせる）

#### フランス語 (FR)
```
[建物名・部屋番号]
[番地]-[街区]-[号] [町名], [区名]
[〒郵便番号] [市・都道府県名]
JAPON
```
（郵便番号と都市名を同一行に）

#### ドイツ語 (DE)
```
[建物名・部屋番号]
[町名] [番地]-[街区]-[号], [区名]
[〒郵便番号] [市・都道府県名]
JAPAN
```
（ドイツ式: 通り名 → 番地の順）

#### イタリア語 (IT)
```
[建物名・部屋番号]
[町名] [番地]-[街区]-[号], [区名]
[〒郵便番号] [市・都道府県名]
GIAPPONE
```

#### カナダ英語 (CA)
```
[建物名・部屋番号]
[番地]-[街区]-[号] [町名], [区名]
[市・都道府県名] [〒郵便番号]
JAPAN
```
（US に近い形式）

#### 韓国語 (KR)
```
일본 〒[郵便番号]
[都道府県（現地語）] [市区町村（現地語）] [町名（ローマ字）] [番地]
[建物名・部屋番号]
```
例:
```
일본 〒150-0002
도쿄도 시부야구 Shibuya 1-2-3
OO빌딩 3F
```

#### 繁体字中国語 / 台湾 (TW)
```
日本 〒[郵便番号]
[都道府県（漢字）][市区町村（漢字）][町名（漢字/ローマ字）][番地]
[建物名・部屋番号]
```
例:
```
日本 〒150-0002
東京都澀谷區澀谷1-2-3
OO大廈3F
```

### 6-3. 地名の現地語辞書（補助表示）

韓国語・繁体字中国語のみ、主要地名の現地語名を辞書定義する。
辞書にない地名はローマ字（ヘボン式）にフォールバックする。

**韓国語 主要地名辞書（例）**:
```javascript
{
  "東京都": "도쿄도",
  "大阪府": "오사카부",
  "京都府": "교토부",
  "北海道": "홋카이도",
  "神奈川県": "가나가와현",
  // ... 47都道府県 + 主要政令指定都市
  "渋谷区": "시부야구",
  "新宿区": "신주쿠구",
  // ... 主要区市
}
```

**繁体字中国語 主要地名辞書（例）**:
```javascript
{
  "東京都": "東京都",     // 漢字共通のためそのまま
  "大阪府": "大阪府",
  "渋谷区": "澀谷區",    // 繁体字に変換が必要な字のみ置換
  "横浜市": "橫濱市",
  // ...
}
```

---

## 7. API 仕様

### 7-1. zipcloud（郵便番号検索）

- **エンドポイント**: `https://zipcloud.ibsnet.co.jp/api/search?zipcode={7桁郵便番号}`
- **メソッド**: GET
- **レスポンス例**:
```json
{
  "status": 200,
  "results": [{
    "zipcode": "1500002",
    "prefcode": "13",
    "address1": "東京都",
    "address2": "渋谷区",
    "address3": "渋谷"
  }]
}
```
- **利用上の注意**: 過度なリクエストを避ける。エラー時はスキップ（住所検証はオプション扱い）

### 7-2. Google Maps Geocoding API（ジオコーダー）

- **エンドポイント**:
  `https://maps.googleapis.com/maps/api/geocode/json?address={住所文字列}&key={API_KEY}&language=ja&region=JP`
- **メソッド**: GET
- **API キー**: Google Cloud Console で取得し、HTTP リファラー制限を設定する
- **レスポンス使用フィールド**: `results[0].geometry.location.lat`, `.lng`
- **フォールバック**: 応答なし / 結果なしの場合は「地図を表示できませんでした」を表示
- **無料枠**: 月 $200 分のクレジット（約 40,000 リクエスト相当）

> **旧: Nominatim は廃止**。番地レベルの測位精度が不十分なため。

### 7-3. Google Maps JavaScript API（地図表示）

- **読み込み方法**: `<script async src="https://maps.googleapis.com/maps/api/js?key={API_KEY}&callback=initMap">`
- **API キー**: Geocoding API と同一キーを使用可（ただし Maps JS API を個別に有効化）
- **デフォルトズームレベル**: 15
- **マーカー**: `google.maps.Marker` + `google.maps.InfoWindow`（住所ポップアップ）
- **Attribution**: Google Maps の Copyright 表示は自動で付与される

> **旧: Leaflet.js + OpenStreetMap は廃止**。

### 7-4. DeepL API（建物名翻訳）

- **エンドポイント**: `https://api-free.deepl.com/v2/translate`（Free プラン）
- **メソッド**: POST
- **認証**: `Authorization: DeepL-Auth-Key {API_KEY}` ヘッダー
- **利用対象**: 建物名・部屋番号フィールドのみ
- **ターゲット言語コード**: `EN-US` / `EN-GB` / `FR` / `DE` / `IT` / `KO` / `ZH-HANT`
  ※ CA-EN→EN-US / CA-FR→FR にマッピング
- **無料枠**: 月 500,000 文字
- **フォールバック**: API キー未設定またはエラー時は既存ローマ字変換を使用
- **注意**: 都道府県・市区町村・町名は DeepL を使わない（地名はローマ字が国際標準）

```javascript
// 利用例
const resp = await fetch('https://api-free.deepl.com/v2/translate', {
  method: 'POST',
  headers: {
    'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text: ['渋谷スカイビル3F'], target_lang: 'EN-US' }),
});
const { translations } = await resp.json();
// => "Shibuya Sky Building 3F"
```

### 7-5. Google AdSense（広告）

- **スクリプト**: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>`
- **広告ユニット**: ディスプレイ広告（レスポンシブ）
- **配置**: フォームセクション下・結果セクション下の 2 箇所
- **審査**: AdSense への申請が必要（承認まで数日〜数週間）
- **最低要件**: 独自ドメインへのデプロイが推奨（web.app ドメインでは審査が通りにくい）

---

## 8. UI デザイン仕様

### 8-1. テーマ・カラーパレット

国際エアメール・航空便をモチーフにしたデザイン。

| 要素 | カラー |
|------|--------|
| エアメールストライプ | 赤 `#e63329` / 青 `#1a5276` |
| 背景 | オフホワイト `#fafafa` |
| メインテキスト | `#1a1a1a` |
| アクセント | 赤 `#e63329` |
| カード背景 | 白 `#ffffff` + 薄シャドウ |

### 8-2. レイアウト（1ページ構成）

```
┌─────────────────────────────────────┐
│ ヘッダー（ロゴ + エアメールテーマ）    │  ← z-index: 1001（最前面）
├─────────────────────────────────────┤
│ 入力フォーム                          │
│  [郵便番号（自動補完）]               │  ← 補完ボタン廃止・7桁で自動発火
│  [都道府県] [市区町村] [町名・番地]   │  ← 町域名も自動入力される
│  [建物名・部屋番号（任意）]           │
│  [変換ボタン]  [警告バナー]          │
├─────────────────────────────────────┤
│ [広告エリア A]                        │
├─────────────────────────────────────┤
│ 地図（Google Maps）                   │  ← z-index は header より下
├─────────────────────────────────────┤
│ 変換結果                              │
│  タブ or カード: US / UK / FR / DE   │
│               IT / CA / KR / TW     │
├─────────────────────────────────────┤
│ [広告エリア B]                        │
├─────────────────────────────────────┤
│ プレビュー部品                         │
│  [封筒] [はがき] [伝票]               │
│  各プレビューにコピーボタン            │
├─────────────────────────────────────┤
│ フッター                              │
└─────────────────────────────────────┘
```

### 8-3. プレビュー部品デザイン

**封筒（国際エアメール）**:
- 赤青ストライプの枠線（エアメール封筒の斜めストライプ）
- 左上: FROM 欄（日本語住所）
- 右下: TO 欄（変換後住所）
- 「AIR MAIL」スタンプ風装飾

**はがき（ポストカード）**:
- 縦横比 148×100mm に相当するカード
- 右半分: 宛名欄（罫線付き）に変換後住所
- 切手枠（装飾）

**国際宅配便伝票**:
- 荷物ラベル風デザイン
- 「SHIPPING ADDRESS / 送り先」ラベル
- 変換後住所をブロック体で表示

---

## 9. フッター必須記載事項

```
プライバシー:
  本サービスは入力された住所情報をサーバーへ送信・収集しません。
  郵便番号の検索に zipcloud、地図表示に Google Maps、
  建物名の翻訳に DeepL の外部 API を利用しています。

ライセンス:
  © 2025 Kei — CC BY 4.0
  本サービスのコンテンツは Creative Commons Attribution 4.0 International
  ライセンスのもとで提供されています。

免責事項:
  変換結果の正確性を保証するものではありません。
  実際の国際郵便・配送には各国郵便事業者の公式表記をご確認ください。

サービス URL: [独自ドメイン]
```

---

## 10. Firebase Hosting 設定

```json
// firebase.json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "CLAUDE.md",
      ".firebaserc",
      "**/.*",
      "**/node_modules/**"
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000" }]
      },
      {
        "source": "**",
        "headers": [
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
        ]
      }
    ]
  }
}
```

---

## 11. 開発・デプロイ手順

```bash
# 依存パッケージインストール（ESLint など devDependencies）
npm install

# Lint 実行
npm run lint

# Lint 自動修正
npm run lint:fix

# Firebase CLI インストール（未インストールの場合）
npm install -g firebase-tools

# ログイン
firebase login

# プロジェクト初期化（Hosting のみ選択）
firebase init hosting

# ローカルプレビュー
firebase serve

# 本番デプロイ（Lint パスを確認してから実行）
npm run lint && firebase deploy --only hosting
```

初回起動前に `js/config.example.js` を `js/config.js` にコピーし、
Google Maps API キーを設定する。`index.html` の Maps 読み込みキーと揃える。
DeepL API キーは任意（空の場合はローマ字表記にフォールバック）。

**独自ドメイン設定手順**（お名前.com + Firebase）:
1. Firebase Console > Hosting > カスタムドメインを追加
2. 表示された TXT レコードをお名前.com の DNS に登録して所有権確認
3. A レコードまたは CNAME を Firebase の指示通り設定
4. SSL 証明書は Firebase が自動発行（最大 24 時間）

---

## 12. 制約・注意事項

| 項目 | 内容 |
|------|------|
| Google Maps API キー | クライアントサイドに公開されるため、HTTP リファラー制限を必ず設定する |
| Google Maps 費用 | 月 $200 無料枠。超過分は $0.005/リクエスト（Geocoding）程度。小規模なら無料枠内に収まる見込み |
| DeepL API キー | Free プランは月 500,000 文字。APIキーはクライアント公開されるため悪用リスクがある。使用量に上限設定推奨 |
| DeepL 対象範囲 | 建物名のみ翻訳。都道府県・市区町村・町名は地名固有名詞のためローマ字が適切 |
| zipcloud | 非公式 API のためサービス停止リスクあり。エラー時は検証をスキップ |
| ローマ字変換精度 | zipcloud 補完で取得したカナが必須。手動入力時はカナ不足で精度低下 |
| Firebase Spark | Cloud Functions 不可。すべての処理はクライアントサイド |
| AdSense | 独自ドメイン推奨。web.app ドメインでは審査通過率が低い |
| CC BY ライセンス | 再利用者は作者名のクレジット表記が必要 |
| z-index 管理 | ヘッダーを `z-index: 1001` に設定し、Google Maps のコントロール類より必ず上にする |

---

## 13. 未決定事項（実装前に確認が必要）

- [x] サービス名: **AddressBridge**（日本語→英語・多言語変換）
- [x] フッター作者名: **Kei**（連絡先は非表示）
- [x] カナダフランス語（CA-FR）対応: **あり**
- [ ] 独自ドメインの取得・確定
- [ ] Google Maps API キーの取得（Google Cloud Console で作成・リファラー制限設定）
- [ ] DeepL API キーの取得（Free プランで可）
- [ ] Google AdSense パブリッシャー ID（`ca-pub-XXXXXXXXXX`）の取得・審査申請
- [ ] 繁体字中国語辞書の範囲（47都道府県のみ / 主要市区も含む）

---

## 14. 広告実装仕様（Google AdSense）

### 配置方針

| 広告エリア | 位置 | 推奨サイズ |
|-----------|------|-----------|
| 広告エリア A | フォームセクション直下・地図の上 | レスポンシブ（横長） |
| 広告エリア B | 変換結果セクション直下・プレビューの上 | レスポンシブ（横長） |

### HTML テンプレート

```html
<!-- head に1回だけ記述 -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
  crossorigin="anonymous"></script>

<!-- 広告ユニット（各配置箇所） -->
<div class="ad-unit">
  <ins class="adsbygoogle"
    style="display:block"
    data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
    data-ad-slot="XXXXXXXXXX"
    data-ad-format="auto"
    data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>
```

### CSS

```css
.ad-unit {
  margin: 0 0 24px;
  min-height: 90px;   /* 広告読み込み前の高さ確保 */
  background: #f0f0f0; /* 開発時の視認用（本番では削除） */
}
```

### AdSense 申請手順

1. [Google AdSense](https://www.google.com/adsense/) にアクセスしてアカウント作成
2. サイト URL に独自ドメインを登録する（web.app ドメインは審査通過率が低い）
3. `<head>` に AdSense の確認用コードを追加してデプロイする
4. 審査完了後（数日〜数週間）に広告ユニットを作成し `data-ad-slot` を取得
5. 取得した `ca-pub-XXXXXXXXXX` と `data-ad-slot` をコードに設定して再デプロイ

### API キー管理方針

Firebase Hosting は静的ホスティングのため、Google Maps / DeepL の API キーは
クライアントサイドコードに含まれる。以下の対策を必ず実施する:

| API | 対策 |
|-----|------|
| Google Maps | Google Cloud Console → API と サービス → 認証情報 → HTTP リファラー制限（自ドメインのみ許可）|
| DeepL | DeepL アカウント → API使用量ダッシュボードで上限監視。必要なら IP 制限設定 |

> APIキーは `.env` ファイルや別管理ファイルに切り出し `.gitignore` で除外することを推奨。
> ただし Firebase Hosting の静的配信では実行時に読み込めないため、
> デプロイ前に `js/config.js` へ書き込むか、HTML 内で直接設定する。
