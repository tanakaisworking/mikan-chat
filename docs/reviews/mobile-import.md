# モバイルImport Dialog 最終再レビュー

対象:

- モバイル実装画像: `docs/design/implementation/mobile-import.png`（390 × 844）
- PC実装画像: `docs/design/implementation/import.png`（1280 × 720）
- 仕様: `DESIGN.md`
- 実装: `src/renderer/components/library/import-character-dialog.tsx`、`src/renderer/components/ui/dialog.tsx`、`button.tsx`、接続する `App.tsx` とテスト

## 指摘

指摘なし。

## 最終確認

- 390 × 844の収まり: Dialogは上下左右8pxの画面内余白を残し、タイトル、プレビュー、人物情報、安全表示、3 CTA、閉じる操作を欠けなく表示します。高さ不足時は共通 `DialogContent` 全体をスクロールできます。
- 画像クロップ: モバイルの16:10プレビューへ `object-position: center 25%` を適用し、雫の顔全体、表情、髪、上半身の一部が自然に収まります。PCの正方形プレビューは従来の構図を維持しています。
- CTA: DOM・視覚順を「キャンセル → ライブラリに追加 → 追加して話す」に統一し、reverseや入れ子によるTab順の反転はありません。モバイルでは縦並び、PCではキャンセルだけ `mr-auto` で左、残り2操作を右に配置します。
- タッチ領域: 閉じるは44 × 44px、3 CTAは52px高です。「追加して話す」をprimary、他2操作をoutlineにし、主従も明確です。
- アクセシビリティ: Base UI Dialogのフォーカストラップ、Escape／オーバーレイ閉じを利用し、Dialog titleとsr-only descriptionを持ちます。画像alt、安全性、ファイル名も文字で提示されています。
- 操作回帰: 「ライブラリに追加」はDialogを閉じてホームへ雫を追加し、「追加して話す」は雫のトークへ遷移後もライブラリへ保持します。既存テストで両経路を確認しました。
- PC回帰: 1280 × 720で左右2列、正方形プレビュー、左キャンセル／右2 CTA、余白、角丸、オーバーレイを維持しています。
- 共通化: Base UI由来の `Dialog`、共通Dialog部品、共通 `Button` を再利用し、パック固有情報だけを `components/library/` に留めています。モバイル用の重複Dialogはありません。

## 検証結果

- `npm run typecheck`: 成功
- `npm run lint`: 成功（警告0）
- `npm test`: 成功（15件すべて）
- `npm run build`: 成功

## サマリー

P0: 0件 / P1: 0件 / P2: 0件。モバイルImport Dialogの収まり、画像、CTA順、タッチ操作、アクセシビリティ、PC回帰のレビューゲートを通過しました。

`final result: passed`
