# モバイル版トーク画面 最終再レビュー

対象:

- モバイル実装画像: `docs/design/implementation/mobile-talk.png`（390 × 844）
- 狭幅実装画像: `docs/design/implementation/mobile-talk-320x700.png`（320 × 700）
- PC実装画像: `docs/design/implementation/talk.png`（1280 × 720）
- 仕様: `DESIGN.md`
- 実装: `src/renderer/screens/TalkScreen.tsx`、`src/renderer/components/chat/*`、`src/renderer/components/ui/app-header.tsx`、関連レスポンシブUIとテスト

## 指摘

指摘なし。

## 最終確認

- 9:16背景: 390 × 844ではヘッダー64pxとcomposer80pxを除く390 × 700pxの会話領域になり、9:16素材を `object-cover` で自然に背景表示しています。
- LINE風表示: キャラクター側は半透明の白、ユーザー側は半透明の淡緑、左右配置と片側の小さい角丸で役割を色だけに依存せず区別できます。
- 可読性: 本文15px、広めの行高、高不透明度の吹き出し、白文字＋drop shadowの日時、下方向の暗色オーバーレイにより背景上でも判読できます。320pxでは長文が自然に2行へ折り返します。
- スクロール: 背景と同じGrid領域に `ChatTimeline` を前面配置し、会話sectionだけを独立スクロールさせています。ヘッダー、背景、composerは固定されます。
- 入力: `h-dvh`、safe-area下余白、textarea `min-w-0` により390px／320pxで入力と2操作が欠けません。Enter、Shift + Enter、IME、生成停止の既存ロジックも維持しています。
- タッチ領域: ヘッダーの履歴・音声・接続、composerのマイク・送信／停止、吹き出しの音声再生／停止はすべて44 × 44px以上です。
- 320pxヘッダー: 350px未満では処理ステータスを隠し、タイトルを左72pxへ移動するため、戻る／タイトル／右3操作が重なりません。
- アクセシビリティ: アイコン操作は日本語ラベルとTooltipを持ち、会話ログは `aria-live="polite"`、画像は役割を表すaltを持ちます。DOM順もヘッダー → 画像 → 会話 → 入力で視覚構造と整合します。
- PC回帰: 1280 × 720では左画像／右会話／下全幅入力、文字、画像クロップ、操作寸法にモバイルclassの影響はありません。
- 共通化: `CharacterStage`、`ChatTimeline`、`ChatMessage`、`ChatComposer`、`AppHeader` の既存部品へレスポンシブvariantを集約し、モバイル専用画面を複製していません。
- 既存操作回帰: Homeの設定操作は単一 `IconButton` のままレスポンシブ表示を切り替える構造となり、接続設定の保存／キャンセルを含む全テストが再び一意に操作できます。

## 検証結果

- `npm run typecheck`: 成功
- `npm run lint`: 成功（警告0）
- `npm test`: 成功（15件すべて）
- `npm run build`: 成功

## サマリー

P0: 0件 / P1: 0件 / P2: 0件。モバイルトークの視覚、最小幅、操作、アクセシビリティ、PC回帰、既存テストのレビューゲートを通過しました。

`final result: passed`
