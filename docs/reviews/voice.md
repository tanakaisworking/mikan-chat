# 音声設定Sheet 最終再レビュー

対象:

- 基準画像: `/Users/kotatsu/.codex/generated_images/01a04e2e-4f46-78b2-8c35-2b89fb36c591/exec-abb89cf1-54f7-453e-a403-2e0d87bdef3a.png`（1487 × 1058）
- 最新実装画像: `docs/design/implementation/voice.png`（1280 × 720、2026-08-30 23:31:46保存）
- 仕様: `DESIGN.md`
- 実装: `src/renderer/components/settings/voice-settings-sheet.tsx`、`src/renderer/components/ui/sheet.tsx`、`switch.tsx`、`button.tsx`

## 指摘

指摘なし。

## 最終確認

- UI忠実度: Sheetの480px幅、左側角丸、30pxタイトル、20pxセクション見出し、72pxアイコン円、52px操作ボタン、広いカード余白へ調整され、基準画像の文字階層と密度を再現しています。完了ボタンも設定カード末尾へ統合されています。
- 最小高さ: 最新画像は1280 × 720で、縦方向に収まらない設定カードだけがスクロールし、ヘッダーとSheet本体は固定されています。1024px以上の対応範囲で操作不能な横あふれはありません。
- 音声試聴: 「声を試す」は再生状態へ遷移し、「再生を停止」表示とSquareアイコンへ切り替わります。再押下または1.5秒経過で終了します。
- 状態終了: Sheetの閉じる、完了、Escape、オーバーレイなど `open=false` となる全経路で、マイクテスト、音声試聴、試聴タイマーを終了します。再表示時にテスト中状態は残りません。
- アクセシビリティ: マイク入力レベルは `role="meter"`、最小・最大・現在値、日本語ラベルを持ち、装飾バーは読み上げ対象外です。Switchにも日本語ラベルがあり、色以外にボタン文言・バー本数・Switch形状で状態を示します。
- 共通化: Base UI由来の `Sheet` と `Switch`、共通 `Button` を再利用し、音声固有ロジックは `components/settings/` に留めています。Sheetのside別角丸は共通部品へ集約されています。
- 操作領域: 通常操作は44px以上で、Base UIのフォーカス管理、Escape／オーバーレイ閉じ、キーボード操作を維持しています。
- 回帰テスト: マイクテスト、読み上げSwitch、音声試聴、閉じる、再表示後の状態リセットを一つの利用者フローで検証しています。

## 検証結果

- `npm run typecheck`: 成功
- `npm run lint`: 成功（警告0）
- `npm test`: 成功（9件すべて）
- `npm run build`: 成功

## サマリー

P0: 0件 / P1: 0件 / P2: 0件。音声設定Sheetのページ単位レビューゲートを通過しました。

`final result: passed`
