# mikan Chat Pack Specification v0.1

> Status: Draft
>
> Primary language: 日本語
>
> Spec identifier: `mikan.chat-pack` / `0.1`

## 1. Chat Packとは

Chat Packは、AIキャラクターそのものではなく、ユーザーが入り込める対話体験を持ち運ぶためのオープンなファイル形式です。

1つのパックには、体験の題名、状況、ユーザーの役割、登場人物、導入シーン、文章表現、音声の希望設定をまとめられます。登場人物が1人なら1on1、複数なら1onNとして、同じランタイムで再生します。

```text
知らないキャラクターを選ぶ
```

のではなく、

```text
終電を逃した夜、閉店後の喫茶店で秘密を抱えた常連客と二人きりになる
```

という体験から会話を始めることが、この規格の出発点です。

Chat Packは、次の3層を分離します。

| 層 | 内容 |
|---|---|
| 発見 | 題名、カバー、一言紹介、タグ、作者 |
| 体験 | 状況、ユーザー役、登場人物、導入、情景描写、会話スタイル |
| 再利用 | 設定集のスナップショット、出所、音声プロファイル |

会話履歴、APIキー、モデル本体、購入情報はChat Packに含めません。

Chat Packは特定のLLMへ結び付けません。作者はローカルモデルとAPIモデルの違いを意識せず、体験内容を記述します。モデル名、接続先、APIキー、temperatureなどの推論設定はプレイヤー側が管理します。

## 2. 規範用語

本文中の用語は、次の強さで解釈します。

- **MUST**: 適合実装が必ず守る要件
- **MUST NOT**: 適合実装が行ってはならないこと
- **SHOULD**: 特別な理由がなければ守る要件
- **MAY**: 実装が任意で対応できる機能

## 3. コンテナ形式

Chat Packの拡張子は `.mikanchat` とします。MIME Typeは `application/vnd.mikan.chat+zip` です。

`.mikanchat`の実体は、暗号化されていないZIPです。圧縮方式はStoredまたはDeflateだけを使用します。

```text
late-night-cafe.mikanchat
├── pack.json
├── LICENSE.txt                 任意
├── README.md                   任意
└── assets/
    ├── cover-main.webp
    ├── aoi.webp
    └── cafe-night.webp
```

- `pack.json`はルート直下に1つだけ置くMUST
- 画像は`assets/`以下へ置くMUST
- アセットのファイル名はASCII小文字、数字、ハイフン、ピリオドだけを使うMUST
- ZIP内のパス区切りには`/`を使うMUST
- `pack.json`から外部URL上の画像やローカルファイルを参照してはならないMUST NOT

メタデータと体験データは、二重管理を避けるため`pack.json`へまとめます。配信サービス用の検索インデックスは、サービス側が`pack.json`から生成します。

## 4. 最小パック

次のJSONは、適合する最小構成の例です。

```json
{
  "spec": "mikan.chat-pack",
  "specVersion": "0.1",
  "id": "7dd4b92a-3999-43f1-9431-b0879fc5d5bd",
  "version": "1.0.0",
  "language": "ja",
  "title": "雨の夜、閉店後の喫茶店で",
  "summary": "秘密を抱えた常連客と二人きりになる。",
  "author": {
    "name": "雨音"
  },
  "license": "All-Rights-Reserved",
  "rating": "all",
  "discovery": {
    "covers": ["assets/cover-main.webp"],
    "tags": ["日常", "ミステリー", "恋愛"]
  },
  "plot": {
    "premise": "終電を逃したユーザーは、閉店後も明かりのついた喫茶店へ入る。店内には常連客の葵しかいない。",
    "characters": [
      {
        "id": "aoi",
        "name": "葵",
        "profile": "物静かな常連客。言葉を選び、落ち着いた口調で話す。",
        "image": "assets/aoi.webp"
      }
    ],
    "opening": [
      {
        "type": "narration",
        "text": "扉のベルが鳴る。雨音だけが残る店内で、葵が窓際から振り返った。"
      },
      {
        "type": "dialogue",
        "speaker": "aoi",
        "text": "……{{user}}さん。こんな時間に、どうしたんですか？"
      }
    ]
  }
}
```

必須項目は、体験を発見し、開始するために必要な情報へ絞ります。音声、設定集、状況例、詳細な演出指定は任意です。

## 5. トップレベル

| Field | Type | Required | Description |
|---|---|---:|---|
| `spec` | string | Yes | 常に`mikan.chat-pack` |
| `specVersion` | string | Yes | この版では`0.1` |
| `id` | UUID string | Yes | パックの同一性を示す永続ID |
| `version` | semver string | Yes | パック内容の版 |
| `language` | BCP 47 string | Yes | 原文の言語。例: `ja`, `en` |
| `title` | string | Yes | キャラクター名ではなく体験の題名 |
| `summary` | string | Yes | 一覧で体験を伝える一言紹介 |
| `author` | object | Yes | 作者情報 |
| `license` | string | Yes | SPDX ID、`All-Rights-Reserved`、または`LicenseRef-*` |
| `licenseNotice` | string | No | 画像などに異なる条件がある場合の補足 |
| `rating` | enum | Yes | `all`, `r15`, `r18` |
| `discovery` | object | Yes | 発見・紹介用の情報 |
| `plot` | object | Yes | 対話体験の本体 |
| `extensions` | object | No | 名前空間付きの外部拡張 |

### 5.1 IDと更新

`id`は作者名や題名ではなくUUIDとします。作成アプリが自動生成し、作者に入力を求めないSHOULD。

- 新作は新しい`id`を持つMUST
- 同じ作品の更新は同じ`id`を維持するMUST
- 内容を更新したときは`version`を上げるMUST
- 同じ`id`のパックを読み込んだ場合、実装は無断で上書きしてはならないMUST NOT
- 更新、別コピーとして追加、キャンセルのいずれかをユーザーが選べるSHOULD
- 更新後も会話履歴は保持するSHOULD

`version`はSemantic Versioning形式を使います。文章や画像だけの変更でもPATCHを上げます。互換性を壊す作者都合の構造変更にはMAJORを使えますが、パック自体の形式互換性は`specVersion`で判定します。

### 5.2 作者とライセンス

```json
{
  "author": {
    "name": "雨音",
    "url": "https://example.com/amane"
  },
  "license": "CC-BY-4.0",
  "licenseNotice": "キャラクター画像は作者が生成・加筆したものです。"
}
```

`author.name`だけが必須です。アカウント登録や特定サービスの作者IDを要求しません。

`license`はパックのテキストと、別記のないアセットに適用されます。独自条件を使う場合は`LicenseRef-*`を指定し、`LICENSE.txt`へ条件を書くSHOULD。個別アセットの出所や条件は`licenseNotice`または`discovery.credits`へ記録します。

`rating`は作者による自己申告であり、内容の安全性や合法性を保証しません。閲覧アプリは`r18`を初期状態で非表示にするSHOULD。

## 6. 発見情報

`discovery`は、パックを一覧や配布ページで紹介するための情報です。LLMへ自動的に送ってはならないMUST NOT。

```json
{
  "discovery": {
    "covers": [
      "assets/cover-main.webp",
      "assets/cover-alt.webp"
    ],
    "tags": ["学園", "青春", "片思い"],
    "description": "8年ぶりに再会した憧れの人は、新しい上司になっていた。",
    "authorComment": "短い会話でも楽しめるように調整しています。",
    "credits": [
      {
        "asset": "assets/cover-main.webp",
        "creator": "雨音",
        "source": "https://example.com/source",
        "license": "CC-BY-4.0"
      }
    ]
  }
}
```

| Field | Required | Description |
|---|---:|---|
| `covers` | Yes | 一覧用カバー。先頭がメイン |
| `tags` | No | ジャンル、関係性、状況などの検索語 |
| `description` | No | ユーザー向けの長い紹介文 |
| `authorComment` | No | 更新履歴や遊び方など作者からの補足 |
| `credits` | No | 個別アセットの出所と権利表記 |

公開・非公開、コメント許可、ランキング、価格、購入状態、審査状態は配信サービスの情報です。ファイルへ入れても強制できないため、この規格には含めません。

## 7. プロット

`plot`は対話体験の本体です。

```json
{
  "plot": {
    "premise": "物語の状況、関係性、世界観。",
    "instructions": "ユーザーの台詞や内心を勝手に確定しない。",
    "characters": [],
    "playerProfiles": [],
    "defaultPlayerProfile": "visitor",
    "narrator": {},
    "opening": [],
    "situationExamples": [],
    "style": {},
    "settingBooks": []
  }
}
```

| Field | Required | Description |
|---|---:|---|
| `premise` | Yes | 状況、関係性、舞台、物語の前提 |
| `instructions` | No | ランタイムへの追加指示 |
| `characters` | Yes | 1人以上の登場人物 |
| `playerProfiles` | No | ユーザーが選べる役割 |
| `defaultPlayerProfile` | No | 初期選択するプロフィールID |
| `narrator` | No | 情景描写の方針と音声 |
| `opening` | Yes | 1件以上の開始イベント |
| `situationExamples` | No | 状況ごとの行動・会話例 |
| `style` | No | 文章と進行の希望設定 |
| `settingBooks` | No | 自己完結した設定集 |

`premise`と`instructions`は役割が異なります。前者は作品世界の事実、後者はAIの振る舞いです。表示用の紹介文とも分離します。

## 8. 登場人物

```json
{
  "id": "aoi",
  "name": "葵",
  "profile": "性格、外見、口調、ユーザーや他の人物との関係。",
  "image": "assets/aoi.webp",
  "voice": {
    "profile": {
      "language": "ja",
      "traits": ["young-adult", "calm", "soft"],
      "speed": 0.95,
      "pitch": 0
    },
    "preferred": [
      {
        "provider": "irodori",
        "voiceId": "aoi-soft",
        "parameters": {
          "style": "soft"
        }
      }
    ]
  }
}
```

| Field | Required | Description |
|---|---:|---|
| `id` | Yes | パック内で一意のASCII ID |
| `name` | Yes | 画面と会話で使う名前 |
| `profile` | Yes | 人物設定 |
| `image` | Yes | 会話画面で使う画像 |
| `voice` | No | 音声の希望設定 |

`characters[].id`に`user`または`narrator`を使ってはならないMUST NOT。大文字小文字を区別し、`^[a-z][a-z0-9-]{0,63}$`へ適合するMUST。

1on1と1onNに別の形式はありません。`characters`が1件なら1on1、複数なら1onNとして扱います。実装は、対応できる人数に独自の警告上限を設けてもよいMAY。ただし、ファイル規格自体はZetaなど特定サービスの人数上限を引き継ぎません。

## 9. ユーザーの役割

`playerProfiles`は、同じシナリオを異なる立場から始めるための任意データです。

```json
{
  "playerProfiles": [
    {
      "id": "visitor",
      "name": "雨宿りの客",
      "description": "終電を逃して店へ入った。葵とは顔見知りだが、深く話したことはない。",
      "image": "assets/player-visitor.webp"
    },
    {
      "id": "owner",
      "name": "店主",
      "description": "この喫茶店の店主。葵が雨の日だけ店へ来る理由を知らない。"
    }
  ],
  "defaultPlayerProfile": "visitor"
}
```

プロフィールがない場合、ランタイムはユーザーの既定名と既定プロフィールを使います。`{{user}}`は選択中のプロフィール名、なければ実行側の既定ユーザー名へ置換するMUST。

v0.1で定義するテンプレート変数は`{{user}}`だけです。1onNでは指示対象が曖昧になるため、`{{char}}`は定義しません。

## 10. イベントモデル

導入、LLMの返答、会話ログ表示は、同じイベントモデルを使います。

```ts
type NarrationEvent = {
  type: "narration"
  text: string
  image?: string
  delivery?: {
    emotion?: string
    intensity?: number
  }
}

type DialogueEvent = {
  type: "dialogue"
  speaker: string
  text: string
  image?: string
  delivery?: {
    emotion?: string
    intensity?: number
  }
}

type TurnEvent = NarrationEvent | DialogueEvent
type Turn = TurnEvent[]
```

- `narration`は吹き出しの外に情景描写として表示するMUST
- `dialogue`は`speaker`に対応する人物の吹き出しとして表示するMUST
- `opening`内の`dialogue.speaker`には人物IDまたは`user`を使えるMAY
- LLMが生成する応答は、ユーザーの明示設定がない限り`user`の発言を生成してはならないMUST NOT
- `image`は、そのイベント中に表示するパック内画像です
- `delivery.emotion`は自由文字列、`intensity`は0から1です

LLMとの通信形式までは規定しません。JSON Schema出力、タグ形式、通常テキストからの解析など、モデルに合った方法を使えます。ランタイムが最終的に`Turn`へ正規化します。

出力を解釈できなかった場合、ランタイムは出力全体を1件の`narration`として扱うSHOULD。誤った人物へ発言を帰属させてはなりません。

### 10.1 導入シーン

`opening`は1件以上のイベントを時系列で並べます。添付画像の切り替え、ナレーター、ユーザー、複数人物の発話を同じ形式で表現できます。

```json
{
  "opening": [
    {
      "type": "narration",
      "text": "放課後の体育館。誰もいないはずのコートから、ボールの音が響いている。",
      "image": "assets/gym-evening.webp"
    },
    {
      "type": "dialogue",
      "speaker": "ren",
      "text": "見てたなら、ボール拾うの手伝ってよ。"
    },
    {
      "type": "dialogue",
      "speaker": "user",
      "text": "……私でよければ。"
    }
  ]
}
```

ユーザーの選択を奪わないため、ユーザー発言を含める場合は、導入に必要な最小限へ留めるSHOULD。

## 11. 情景描写と文章スタイル

キャラクター画像が静止していても、時間、動作、表情、距離をテキストで表現できることを必須のランタイム能力とします。

```json
{
  "narrator": {
    "instructions": "会話の合間に、視線、手の動き、周囲の音を簡潔に描写する。",
    "voice": {
      "profile": {
        "language": "ja",
        "traits": ["neutral", "calm"],
        "speed": 1
      }
    }
  },
  "style": {
    "pov": "third",
    "tense": "present",
    "responseLength": "medium",
    "narration": "balanced",
    "userAgency": "user-controlled",
    "mood": ["quiet", "romance"],
    "writingStyle": "落ち着いたライトノベル調"
  }
}
```

| Field | Values / Type | Default |
|---|---|---|
| `pov` | `first`, `second`, `third` | `third` |
| `tense` | `past`, `present` | `present` |
| `responseLength` | `short`, `medium`, `long`, `auto` | `medium` |
| `narration` | `low`, `balanced`, `high` | `balanced` |
| `userAgency` | `user-controlled`, `shared` | `user-controlled` |
| `mood` | string[] | `[]` |
| `writingStyle` | string | 実行側の既定 |

これらは生成ヒントです。実行環境やモデルによって完全には再現できません。未知の値を受け取った実装はエラーにせず、既定値へフォールバックするSHOULD。

## 12. 状況例

`situationExamples`は、特定状況での人物の振る舞い、イベント、分岐の例をLLMへ示します。状態機械として実行するものではありません。

```json
{
  "situationExamples": [
    {
      "situation": "ユーザーが帰ろうとする",
      "events": [
        {
          "type": "narration",
          "text": "葵は引き止めようとして、伸ばしかけた手を止める。"
        },
        {
          "type": "dialogue",
          "speaker": "aoi",
          "text": "……雨、まだ強いですよ。"
        }
      ]
    }
  ]
}
```

状況例は作者の意図を伝えるfew-shotデータです。シナリオの進行条件や一度きりのイベントを厳密に管理する機能はv0.1に含めません。

## 13. 設定集

設定集は世界観、場所、過去の出来事、用語などを必要なときだけ文脈へ加えるデータです。

```json
{
  "settingBooks": [
    {
      "id": "cafe-world",
      "title": "喫茶ミカンの設定",
      "description": "店と常連客に関する設定集。",
      "entries": [
        {
          "id": "closing-time",
          "title": "閉店時刻",
          "activation": "keywords",
          "keywords": ["閉店", "帰る", "終電"],
          "content": "店の閉店時刻は23時。終電は23時20分で、駅までは徒歩15分かかる。"
        },
        {
          "id": "rainy-days",
          "title": "雨の日の葵",
          "activation": "always",
          "content": "葵は雨の日だけこの店を訪れる。理由はすぐには明かさない。"
        }
      ],
      "source": {
        "id": "external-cafe-world",
        "url": "https://example.com/setting-books/cafe-world",
        "version": "1.2.0",
        "retrievedAt": "2026-08-31",
        "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      }
    }
  ]
}
```

| Field | Required | Description |
|---|---:|---|
| `id` | Yes | パック内一意ID |
| `title` | Yes | 設定集名 |
| `description` | No | ユーザー向け説明 |
| `entries` | Yes | 1件以上の設定 |
| `source` | No | 元となった共有設定集の出所 |

各エントリの`activation`は`always`または`keywords`です。`keywords`の場合、直近の会話にいずれかの語が含まれたとき`content`を文脈へ追加します。

パックはオフラインで自己完結するMUST。`source`が存在しても、`entries[].content`を省略してはなりませんMUST NOT。v0.1ランタイムは`source.url`を自動取得してはならないMUST NOT。共有設定集を取り込むときは、その時点のスナップショットをパックへ保存します。

作者URL、配布元URL、設定集の`source.url`は表示用データです。プレイヤーは自動的にアクセスしてはならずMUST NOT、ユーザーが明示的に開く場合も外部サイトであることを示すSHOULD。

## 14. 音声

音声設定は、特定エンジンへの固定指定と、別環境で再生するための抽象プロファイルを分けます。

```json
{
  "voice": {
    "profile": {
      "language": "ja",
      "traits": ["young-adult", "calm", "soft"],
      "speed": 0.95,
      "pitch": 0
    },
    "preferred": [
      {
        "provider": "irodori",
        "voiceId": "aoi-soft",
        "parameters": {
          "style": "soft",
          "emotionStrength": 0.7
        }
      }
    ]
  }
}
```

ランタイムは次の順に音声を解決します。

1. `preferred`を先頭から調べ、利用可能なプロバイダーと音声があれば使う
2. 利用できなければ`profile`に近いインストール済み音声を使う
3. 音声がなければ、テキストだけで会話を続ける

未知の`provider`と`parameters`は無視するMUST。音声解決の失敗でチャットを停止してはならないMUST NOT。

音声モデル本体、認証情報、APIキーをパックへ含めてはならないMUST NOT。`preferred`は音声の取得を保証するものではなく、実行環境への希望指定です。

`delivery`があるイベントでは、対応できる音声エンジンが感情と強度を反映できます。対応できない場合は通常音声で読み上げます。

## 15. 完全音声対話との接続

Chat Packは音声認識エンジンを指定しません。Whisper互換音声認識は、ユーザーの発話を通常のユーザーイベントへ変換するランタイム機能です。

```text
ユーザー音声
  ↓
文字起こし
  ↓
ユーザーイベント
  ↓
LLMがTurnを生成
  ↓
文単位でTTSへ送信
  ↓
人物ごとの音声で再生
```

LLMの全文生成を待たず、文が確定した単位でTTSへ渡すSHOULD。ユーザーが話し始めたら現在の読み上げを停止できるSHOULD。音声入力を利用できない環境でも、テキスト入力で同じパックを遊べるMUST。

## 16. 外部拡張

標準外のデータは`extensions`へ入れます。

```json
{
  "extensions": {
    "com.example.my-tool": {
      "customValue": true
    }
  }
}
```

- キーは作者または実装者が管理する逆DNS形式を使うSHOULD
- 標準トップレベルへ`x-*`フィールドを追加してはならないMUST NOT
- 未知の拡張を解釈して実行してはならないMUST NOT
- 編集して再エクスポートする実装は、未知フィールドと未知拡張を保持するSHOULD

## 17. バージョン互換性

`specVersion`のMAJOR変更は破壊的変更、MINOR変更は後方互換のフィールド追加です。

- 対応していないMAJOR版は読み込みを拒否するMUST
- 同じMAJORの新しいMINOR版は、警告したうえで読み込めるSHOULD
- 未知フィールドは無視するSHOULD
- 未知のenum値は既定値へフォールバックするSHOULD
- 未知フィールドを編集・再出力時に保持するSHOULD

## 18. 安全なインポート

Chat Packは第三者が作る信頼できない入力です。検証が完了するまで、ライブラリへ展開してはなりませんMUST NOT。

### 18.1 パス

- `..`を含むパスを拒否するMUST
- `/`から始まる絶対パスを拒否するMUST
- Windowsドライブレター、バックスラッシュ、NUL、制御文字を含むパスを拒否するMUST
- シンボリックリンクと非通常ファイルを拒否するMUST
- Unicode正規化の差を避けるため、アセットファイル名をASCIIへ制限するMUST

### 18.2 ファイル

v0.1で許可するファイルは次のとおりです。

- `pack.json`
- `README.md`
- `LICENSE.txt`
- `.webp`
- `.png`
- `.jpg` / `.jpeg`

SVG、HTML、JavaScript、実行ファイル、モデル、フォント、音声ファイルを含むパックは拒否するMUST。画像は拡張子だけでなくマジックバイトでも判定するMUST。

インポート時に画像を再エンコードして、EXIFなど不要なメタデータを削除するSHOULD。

### 18.3 容量

実装は圧縮爆弾を防ぐ上限を持つMUST。mikan chatの参照実装では次を初期値とします。

| Limit | Value |
|---|---:|
| ZIPサイズ | 32 MiB |
| 総展開サイズ | 64 MiB |
| エントリ数 | 64 |
| 単一ファイル | 16 MiB |
| `pack.json` | 512 KiB |
| 画像の一辺 | 4096 px |

実装は、利用環境に応じてこれより厳しい上限を設定できます。

### 18.4 プロンプト境界

`premise`、`instructions`、人物設定、設定集は作者が記述するモデル入力です。ランタイムの安全設定やシステム規則そのものではありません。

実装は、パック由来の文字列とアプリ由来のシステム指示を明示的に分離するMUST。パックの文字列をコード、テンプレート、ツール命令として実行してはならないMUST NOT。

## 19. Character Card / CharXとの関係

Character Card V2/V3とCharXは、既存キャラクターを取り込むための入力形式です。Chat Packと同じ規格ではありません。

| Character Card | Chat Pack |
|---|---|
| `name` | `plot.characters[0].name` |
| `description` / `personality` | `plot.characters[0].profile` |
| `scenario` | `plot.premise` |
| `first_mes` | `plot.opening`の`dialogue` |
| `mes_example` | `plot.situationExamples` |
| `character_book` | `plot.settingBooks` |
| 画像 | `discovery.covers[0]`と人物画像の初期値 |

変換時に足りない題名、一言紹介、ユーザー役、作者、ライセンス、年齢区分はユーザーへ確認します。推測で`rating`や`license`を決めてはならないMUST NOT。

CCv3の元データを`pack.json`へ二重保存しません。未知フィールドを失わない往復変換が必要になった場合は、変換ツール側が別途エスクローを持ちます。

mikanからCCv3への変換では、複数人物、ユーザー役、構造化された導入、音声、情景描写などが失われます。そのためv0.1はCCv3/CharXのインポートだけを対象とし、完全互換や往復互換を掲げません。

## 20. v0.1の対象外

次の機能は意図的に規格へ含めません。

- 選択肢と分岐グラフ
- インフォボックスと動的なシーン状態
- 厳密なイベント発火、クエスト、フラグ管理
- 表情差分、Live2D、動画、3Dモデル
- 音声モデルや録音済み音声の同梱
- 高度な設定集トリガー、再帰、優先度、トークン予算
- 会話履歴の交換形式
- 多言語翻訳フィールド
- パック間の依存関係
- 自動更新
- 電子署名、改ざん検知、DRM
- 価格、購入、ランキング、コメント、モデレーション
- CCv3/CharXへの完全なエクスポート

対象外の機能は、実際の要求と実装経験を得てから後方互換の追加として検討します。

## 21. 作者向けの最小作成フロー

作者にJSONの直接編集を要求しません。適合する作成アプリは、次の順で最小パックを作れるSHOULD。

1. 体験の題名と一言紹介を書く
2. カバー画像を選ぶ
3. どんな状況かを書く
4. 登場人物を1人以上追加する
5. 導入シーンをナレーションと発言で作る
6. 作者名、ライセンス、年齢区分を選ぶ
7. プレビューして`.mikanchat`を書き出す

音声、設定集、状況例、複数ユーザー役は、必要な作者だけが開く詳細設定に置きます。

## 22. 適合条件

### 22.1 パック

適合するChat Packは、少なくとも次を満たします。

- 必須フィールドがすべて存在する
- `id`がUUID、`version`がsemverとして解釈できる
- 人物IDと設定集IDがパック内で重複しない
- `opening`に1件以上の有効なイベントがある
- すべての`speaker`が人物IDまたは`user`へ解決できる
- すべての画像参照が`assets/`内の実在ファイルへ解決できる
- `{{user}}`以外の未定義テンプレートに依存しない
- 安全性検証を通過する

### 22.2 プレイヤー

適合するプレイヤーは、少なくとも次を実行できます。

- パックを安全に検証して読み込む
- 発見情報を表示する
- ユーザー役を選択する
- 1人以上の人物と導入を開始する
- `narration`を吹き出し外へ表示する
- `dialogue`を話者ごとの吹き出しへ表示する
- テキスト入力で会話を継続する
- 対応できない音声設定を無視してテキストへフォールバックする
- 同じパックIDの更新時に、既存データを無断で上書きしない

音声入力とTTSはmikan chatの主要機能ですが、他ツールがこの公開ファイル形式へ対応する際の最低条件にはしません。これにより、音声を持たないツールでもChat Packの作成、検証、変換、表示へ参加できます。
