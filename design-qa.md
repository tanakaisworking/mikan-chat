# Design QA

## 判定

final result: passed

P0: 0 / P1: 0 / P2: 0

## 検証条件

- 実装: `http://localhost:4173/`
- 標準ビューポート: 1440 × 1024
- 最小ビューポート: 1024 × 720
- モバイルビューポート: 390 × 844、320 × 700（トーク）
- 状態: 初回設定、ホーム、トーク、AI接続、キャラクター追加、音声設定、会話履歴
- 比較方法: 各基準画像と同じ状態の実装キャプチャを横並びの1枚に結合し、全体構成と主要操作領域を同時に確認

## 基準画像と実装画像

| 画面 | 基準画像 | 実装画像 | 横並び比較 |
| --- | --- | --- | --- |
| 初回設定 | `/Users/kotatsu/.codex/generated_images/01a04e2e-4f46-78b2-8c35-2b89fb36c591/exec-b02de1b3-d665-49dc-a530-9a66ed998295.png` | `docs/design/implementation/setup.png` | `docs/design/comparisons/setup-reference-implementation.png` |
| ホーム | `/Users/kotatsu/.codex/generated_images/01a04e2e-4f46-78b2-8c35-2b89fb36c591/exec-f5c7a433-4fcf-499e-b619-5ae6d3815f79.png` | `docs/design/implementation/home.png` | `docs/design/comparisons/home-reference-implementation.png` |
| トーク | `docs/design/preflight-output/images/mikan-chat-talk-screen-approved-optimized.webp` | `docs/design/implementation/talk.png` | `docs/design/comparisons/talk-reference-implementation.png` |
| AI接続 | `/Users/kotatsu/.codex/generated_images/01a04e2e-4f46-78b2-8c35-2b89fb36c591/exec-c1cc84ed-752d-48ad-8dde-dc9ebf859af1.png` | `docs/design/implementation/connection.png` | `docs/design/comparisons/connection-reference-implementation.png` |
| キャラクター追加 | `/Users/kotatsu/.codex/generated_images/01a04e2e-4f46-78b2-8c35-2b89fb36c591/exec-949d72ef-eeb7-4606-b06e-162c6548c017.png` | `docs/design/implementation/import.png` | `docs/design/comparisons/import-reference-implementation.png` |
| 音声設定 | `/Users/kotatsu/.codex/generated_images/01a04e2e-4f46-78b2-8c35-2b89fb36c591/exec-abb89cf1-54f7-453e-a403-2e0d87bdef3a.png` | `docs/design/implementation/voice.png` | `docs/design/comparisons/voice-reference-implementation.png` |
| 会話履歴 | `/Users/kotatsu/.codex/generated_images/01a04e2e-4f46-78b2-8c35-2b89fb36c591/exec-ed900e71-d400-4622-b98a-90750cb7035c.png` | `docs/design/implementation/history.png` | `docs/design/comparisons/history-reference-implementation.png` |

## フルビュー比較

- 初回設定: 左右比率、案内カード、接続方式カード、ロゴ、文字階層を確認。
- ホーム: 9:16カード、続きから、サイドバー密度を確認。みかん籠はユーザー指定により削除。
- トーク: 2026-08-31のユーザー指定に合わせて左キャラクター／右会話へ変更し、左ペイン全面クロップと画面下全幅の入力面を確認。
- モバイルトーク: 9:16画像を全面背景にし、LINE風の会話バブル、固定ヘッダー、画面下入力面を重ねた構成を確認。
- 補助画面: Dialog／Sheetの幅、角丸、オーバーレイ、主要CTA、画面内スクロールを確認。

## フォーカス確認

別クロップは作成していない。全画面比較で主要部品が判読できる解像度を維持し、各画面の独立レビューで次の領域をコードと画像の両方から確認した。

- `ChoiceCard` の選択状態と接続方式の引き継ぎ
- `ChatTimeline`、吹き出し、92px入力面、56px音声／送信操作
- 9:16キャラクター素材のカード表示と左ペインクロップ
- Dialog／Sheetのフォーカス管理、44px以上の操作領域、見出し階層、`aria-pressed`、`aria-current`、`role="meter"`
- キャラクター追加、接続テスト、音声テスト、会話履歴の状態遷移

## 比較履歴

1. 初回レビュー: P1 9 / P2 9。主な差は画面密度、画像比率、入力面、接続選択、共通化。
2. 補助画面レビュー: P1 7 / P2 7。主な差は未接続CTA、状態保持、履歴操作、アクセシビリティ。
3. 修正後レビュー: 接続キャンセルと会話別メッセージ保持のP1を追加検出。
4. 最終レビュー: 7画面すべて P0/P1/P2 0、各レポートの `final result: passed` を確認。
5. 2026-09-04 外部TTS設定: 2列の入力がシート右端からはみ出すP1を確認。共通 `TextField` の最小幅を0、入力幅を100%に修正し、1280 × 720の同一状態でカード内に収まることをブラウザで確認。P0/P1/P2 0。
6. 2026-09-04 ElevenLabs BYOK: 既存の音声設定に3つ目の選択肢として追加し、1280 × 720で選択カード、モデルID、Voice ID、APIキー、注意書きが横あふれなく表示されることを確認。選択済みカードの再クリックでも入力値を保持し、API失敗時はブラウザ標準TTSへ戻る。P0/P1/P2 0。
7. 2026-09-04 Kokoro Web TTS: 音声設定に無料・端末内生成の選択肢を追加。スマホ幅で4つの選択肢、初回ダウンロード案内、状態表示、テスト操作へスクロールで到達できることを確認。Worker・WASM・ONNX runtime・日本語辞書を同一オリジン配信し、CSPで外部スクリプトを許可せず、実ブラウザで初回生成とキャッシュ後の再生成を確認。独立レビューのP1/P2を修正後、P0/P1/P2 0。
8. 2026-09-04 TTS設定の折りたたみ: 選択した音声方式の設定・状態・テスト操作を選択カード直下へ移動。開閉は高さと透明度を300msで遷移し、動きを減らす設定ではアニメーションを無効化。スマホ幅で選択切替とスクロール到達性を確認。
9. 2026-09-04 Kokoroモデル管理: 専用ダウンロードボタン、実データ量に連動する進捗表示、Kokoro関連キャッシュだけを消す削除操作を追加。未取得時は会話から自動取得せず、実ブラウザで未取得→63%→完了→削除→再取得を確認。

## 最小サイズと動作

- `docs/design/implementation/home-1024x720.png`
- `docs/design/implementation/talk-1024x720.png`
- `docs/design/implementation/mobile-home.png`
- `docs/design/implementation/mobile-chat-list.png`
- `docs/design/implementation/mobile-talk.png`
- `docs/design/implementation/mobile-talk-320x700.png`
- `docs/design/implementation/mobile-setup.png`
- `docs/design/implementation/mobile-connection.png`
- `docs/design/implementation/mobile-import.png`
- `docs/design/implementation/mobile-voice.png`
- `docs/design/implementation/mobile-history.png`
- 1024 × 720で横あふれ、到達不能な操作、画像変形なし。
- 390 × 844と320 × 700で横あふれ、到達不能な操作、画像変形なし。スマホホームの「ホーム / チャット」下部タブと、トーク画面でタブが消えることを確認。
- ブラウザ実操作で、インポート、送信と返答、生成停止、接続テスト、APIキー確定／キャンセル、音声テスト、履歴選択／新規／名前変更／削除を確認。
- 新規ブラウザタブで会話履歴を開き、console error / warning 0件を確認。

## 品質ゲート

- `npm run lint`: 成功、警告0
- `npm run typecheck`: 成功
- `npm test`: 109件成功
- `npm run build`: 成功
- 独立レビュー: PC 7画面とモバイル7画面のレポートすべて passed
- 2026-09-04 外部TTS設定のレイアウト修正: 独立レビューでコード修正にP0/P1/P2なし
- 2026-09-04 ElevenLabs BYOK: 独立レビューでP0/P1/P2なし
- 2026-09-04 Kokoro Web TTS: 独立レビューでP0/P1/P2なし
- 2026-09-04 TTS設定の折りたたみ: 独立レビューで指摘された展開状態と設定パネルの関連付けを修正
- 2026-09-04 Kokoroモデル管理: 独立レビューで指摘された状態同期、並行取得、保存完了判定を修正後、P0/P1/P2なし
