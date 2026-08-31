# mikan chat

[日本語](#mikan-chatについて) / [English](#english)

## mikan chatについて

**mikan chat**は、ライトユーザーが手軽に楽しめる、ちょうどいいAIキャラクターチャットシミュレーターを目指す無料・オープンソースのアプリです。

WindowsとmacOSで動き、シチュエーション中心のチャットパックを選ぶか外部からインポートするだけで、1対1・多人数の物語をテキストや音声で始められます。会話データを外へ送らず、AI処理も基本的にユーザーのPC内で完結します。

> 現在はアーリーアクセス版です。AI接続と音声入力の実装を進めていますが、配布用ビルドと音声読み上げはまだありません。

## Web Early Access

[ブラウザでmikan chatを試す](https://mikanchat.mikan-chat.workers.dev/)

Web版では、Google AI Studioで発行したGemini APIキーを使って会話できます。標準の`gemini-flash-latest`が利用できない場合は、`gemini-flash-lite-latest`、`gemini-3.5-flash-lite`の順に自動で切り替えます。その他のOpenAI互換APIも設定可能です。APIキーはブラウザに保存され、次回の起動時にも復元されます。mikan chatのサーバーには保存されません。マイク入力にはブラウザ標準の音声認識を使います。

## 開発用プレビュー

Node.js 22.13以降を用意し、次のコマンドで起動します。

```bash
npm install
npm run dev
```

Electron上で確認する場合は `npm run dev:electron`、品質チェックは `npm run lint && npm run typecheck && npm run test && npm run build` を使います。

Electron版のHayamimi連携は、Hayamimi側に接続認証が実装されるまで既定で無効です。開発時に信頼できるローカルサーバーへ接続する場合だけ、`MIKAN_HAYAMIMI_WS_URL=ws://127.0.0.1:8766/ingest npm run dev:electron`のように接続先を明示します。

Web版はCloudflare Workers Static Assetsで配信します。ローカル確認は `npm run dev:worker`、本番反映は `npm run deploy:worker` を使います。AIへのリクエストは、ユーザーが設定したOpenAI互換エンドポイントへブラウザから直接送信します。

## 目指すもの

- ローカルLLMでキャラクターとの会話を動かす
- Web版はブラウザ標準の音声認識、Electron版はHayamimiで話しかけられるようにする
- Irodori TTSでキャラクターの返答を読み上げる
- コミュニティが作ったチャットパックを無料で作成・共有・インポートできるようにする
- 会話履歴と推論データを原則としてPC内に保存する
- ローカルAIの専門知識がなくてもWindowsとmacOSで使えるようにする
- 他のツールでも実装できる、公開されたパック仕様を作る

チャットパックの初期仕様は、[Web技術ドキュメント](https://mikanchat.mikan-chat.workers.dev/docs/)、[mikan Chat Pack Specification v0.1](docs/chat-pack-v0.1.md)、[JSON Schema](schema/chat-pack-0.1.json)で公開しています。画像は任意で、文章だけの最小パックも作成できます。

## 最初に作る範囲

最初の実用版では、次の機能に集中します。

- ローカルでのテキスト会話とターン制音声会話
- ローカルAIモデルの簡単なセットアップ
- シチュエーション、ユーザー役、複数キャラクター、情景描写、導入シーン
- 持ち運べるチャットパックの作成・インポート・エクスポート
- Character Card、CharX形式との互換性調査
- 再配布可能な少数のサンプルパック

ユーザー登録、決済、DRM、有料パック、公式マーケットプレイスは初期スコープに含めません。まずは無料アプリ上で、ユーザーがパックを作り、共有し、インポートして楽しめることを検証します。

## コミュニティ優先の方針

アプリ本体とパックの作成・インポート機能は無料で提供します。クリエイターとユーザーのコミュニティが十分に育った場合は、コンテンツの発見、配信管理、自動更新、作者支援、マーケットプレイスなどの任意サービスを追加する可能性があります。

将来サービスを追加する場合も、無料のローカルプレイヤーと持ち運べるパック形式を、有料アカウントがなければ使えない状態にはしません。

このプロジェクトは日本語コミュニティを中心に育てます。Issue、Pull Request、ドキュメントは日本語を基本とし、英語での参加も歓迎します。

## ライセンス

このリポジトリのソースコードは[Mozilla Public License 2.0](LICENSE)で公開しています。

---

## English

**mikan chat** is a free and open-source local AI character chat simulator for casual users who want something simple, approachable, and just right. It runs on Windows and macOS.

Choose or import a community-created Chat Pack, then enter a one-on-one or multi-character scenario by text or voice while keeping conversations and AI inference on your own computer by default.

> The UI prototype is now implemented. Distribution builds and real AI/voice integrations are not available yet.

### Web Early Access

[Try mikan chat in your browser](https://mikanchat.mikan-chat.workers.dev/).

This is currently a UI preview. AI connections, voice chat, and character imports are simulated. Do not enter real API keys or personal information.

### Development preview

With Node.js 20 or later installed:

```bash
npm install
npm run dev
```

Use `npm run dev:electron` for the Electron shell. Run `npm run lint && npm run typecheck && npm run test && npm run build` for the full quality check.

The web preview runs on Cloudflare Workers Static Assets. Use `npm run dev:worker` locally and `npm run deploy:worker` for production deployment. Operator-owned API keys must be stored as Worker Secrets rather than committed to the repository.

### Goals

- Run character conversations with a local LLM.
- Accept voice input through the browser speech recognition API on the web and Hayamimi in Electron.
- Return spoken responses through Irodori TTS.
- Create, share, and import community-created Chat Packs for free.
- Keep chat history and inference data local by default.
- Make local character chat approachable on Windows and macOS.
- Publish an open, documented pack format.

The initial format is available in the [web documentation](https://mikanchat.mikan-chat.workers.dev/docs/), [mikan Chat Pack Specification v0.1](docs/chat-pack-v0.1.md), and [JSON Schema](schema/chat-pack-0.1.json). Images are optional, so a minimal pack can contain text only.

Accounts, payments, DRM, paid packs, and an official marketplace are outside the initial scope. We will first validate that people can create, share, import, and enjoy packs with the free application.

The project is community-first and primarily maintained in Japanese. Issues and pull requests in English are also welcome.

Source code in this repository is licensed under the [Mozilla Public License 2.0](LICENSE).
