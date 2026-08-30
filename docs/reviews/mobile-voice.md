# モバイルVoice Sheet 最終レビュー

対象:

- モバイル実装画像: `docs/design/implementation/mobile-voice.png`（390 × 844）
- PC実装画像: `docs/design/implementation/voice.png`（1280 × 720）
- 仕様: `DESIGN.md`
- 実装: `src/renderer/components/settings/voice-settings-sheet.tsx`、`src/renderer/components/ui/sheet.tsx`、`src/renderer/components/ui/button.tsx`、`src/renderer/components/ui/switch.tsx`

## 指摘

指摘なし。

## 前回指摘の再確認

- 閉じる操作: モバイル用の `size-10` 上書きを削除し、共通 `Button` の `size="icon"`（44 × 44px）をPC／モバイルで維持している。
- モバイルでは位置だけを `top-3 right-3` へ切り替え、ヘッダータイトルとの余白とタップ領域を両立している。

## 確認済み事項

- 390 × 844では右Sheetが `w-full`、角丸なしで画面全幅を使い、ヘッダーと閉じる操作を上部へ固定している。
- 本文は `min-h-0 flex-1 overflow-y-auto`。390 × 844では完了CTAまで画面内に収まり、さらに短い画面や文字拡大でも内部スクロールで全操作へ到達できる。
- マイクと読み上げの2セクション、レベルメーター、Switch、補足、完了CTAは左右16pxの中へ収まり、320pxまで計算上横あふれしない。
- 「マイクを試す」「声を試す」「完了」は共通 `Button` の `size="lg"` で52px高。Switchは見た目が48 × 28pxで、疑似要素により実操作領域を72 × 44pxへ拡張している。
- マイクテストは開始／停止でラベルが変わり、レベル表示は `role="meter"` と数値属性を持つ。音声テストは再生中に停止アイコンと「再生を停止」を表示し、色だけに依存しない。
- 読み上げSwitchは「返答を読み上げる」という日本語のアクセシブルネームを持つ。Sheetタイトルと視覚非表示説明もBase UIへ関連付けられる。
- Sheetを閉じるとマイク／音声のテスト状態とタイマーを停止・リセットし、アンマウント時もタイマーを解放する。
- 共通 `Sheet`、`Button`、`Switch` を組み合わせ、音声固有の状態は `components/settings/` に留めている。独自Dialogや重複プリミティブはない。
- PCでは右480px、左角丸、PC用パディングを維持する。モバイル用の全幅・余白指定は `max-md` に限定され、現行PC画像の配置を回帰させていない。

## 検証結果

- `npm run typecheck`: 成功
- `npm run lint`: 成功
- `npm test -- --run`: 成功（15件すべて通過）
- `npm run build`: 成功

## サマリー

P0: 0件 / P1: 0件 / P2: 0件。マージ可。

final result: passed
