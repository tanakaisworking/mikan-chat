# mikan chat

[日本語](#mikan-chatについて) / [English](#english)

## mikan chatについて

**mikan chat**は、WindowsとmacOSで動く、無料・オープンソースのローカルAIキャラクターチャットアプリです。

キャラクターパックを選ぶ、または外部からインポートして、テキストや音声で会話できます。会話とAI処理は、自分のPC内で完結することを基本とします。

> 現在は構想・初期開発段階です。ダウンロードできるアプリはまだありません。

## 目指すもの

- ローカルLLMでキャラクターとの会話を動かす
- Whisper互換の音声認識で話しかけられるようにする
- Irodori TTSでキャラクターの返答を読み上げる
- コミュニティが作ったキャラクター／シナリオパックを無料でインポートできるようにする
- 会話履歴と推論データを原則としてPC内に保存する
- ローカルAIの専門知識がなくてもWindowsとmacOSで使えるようにする
- 他のツールでも実装できる、公開されたパック仕様を作る

## 最初に作る範囲

最初の実用版では、次の機能に集中します。

- ローカルでのテキスト会話とターン制音声会話
- ローカルAIモデルの簡単なセットアップ
- キャラクター画像、プロンプト、最初のメッセージ、会話例
- 持ち運べるキャラクターパックのインポート／エクスポート
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

**mikan chat** is a free and open-source local AI character chat app for Windows and macOS.

Choose or import a community-created character pack, then talk by text or voice while keeping conversations and AI inference on your own computer by default.

> The project is currently at the concept and early-development stage. There is no downloadable build yet.

### Goals

- Run character conversations with a local LLM.
- Accept voice input through Whisper-compatible speech recognition.
- Return spoken responses through Irodori TTS.
- Import community-created character and scenario packs for free.
- Keep chat history and inference data local by default.
- Make local character chat approachable on Windows and macOS.
- Publish an open, documented pack format.

Accounts, payments, DRM, paid packs, and an official marketplace are outside the initial scope. We will first validate that people can create, share, import, and enjoy packs with the free application.

The project is community-first and primarily maintained in Japanese. Issues and pull requests in English are also welcome.

Source code in this repository is licensed under the [Mozilla Public License 2.0](LICENSE).
