# トーク画面 左右反転後レビュー

対象:

- 最新実装画像: `docs/design/implementation/talk.png`（1280 × 720、2026-08-31 01:00:38保存）
- 最小サイズ画像: `docs/design/implementation/talk-1024x720.png`（1024 × 720、2026-08-31 01:00:39保存）
- 仕様: `DESIGN.md`（2026-08-31の左右反転指示を反映）
- 実装: `src/renderer/screens/TalkScreen.tsx`、`src/renderer/components/chat/*`、利用中の `components/ui`

## 指摘

指摘なし。

## 最終確認

- 左右反転: Gridは `clamp(360px,40vw,560px) / minmax(0,1fr)` となり、DOM順もヘッダー → 左 `CharacterStage` → 右 `ChatTimeline` → 全幅 `ChatComposer` で視覚順と読み上げ順が一致しています。
- 境界表現: `CharacterStage` の境界線を右側へ移し、キャラクターと会話の区切りを反転後の位置へ合わせています。画像を引き伸ばさず、9:16素材を `object-cover object-top` で表示しています。
- 標準表示: 1280 × 720では画像512px、会話768pxを確保し、会話3件、日付区切り、全幅入力、ヘッダー操作に重なりや欠けはありません。
- 最小サイズ: 1024 × 720では画像約410px、会話約614px、80pxヘッダー、112px入力領域に縮小されます。吹き出し、時刻、音声再生、入力ボタンは横あふれせず、会話領域だけが独立スクロールします。
- 入力回帰: composerは左右2列を跨ぎ、画像下を含む全幅を維持しています。Enter送信、Shift + Enter改行、IME変換中の送信抑止、生成停止は既存実装とテストを維持しています。
- 補助UI回帰: 会話履歴、音声設定、AI接続設定のヘッダーボタンは44px以上、日本語ラベル、Tooltipを保ち、左右反転後も操作可能な位置にあります。
- 会話回帰: 送信・返答追加、生成停止、履歴選択、新規会話、履歴往復後のメッセージ保持をテストで確認しました。
- アクセシビリティ: 会話ログの `aria-live="polite"` は一つだけで、画像altは画面上の役割を示します。DOM順、見出し、アイコンラベル、フォーカス表示に左右反転による破綻はありません。
- 共通化: 配置変更は `TalkScreen` のGridと `CharacterStage` の境界だけに限定し、`ChatTimeline`、`ChatMessage`、`ChatComposer`、共通UIの責務を複製していません。

## 検証結果

- `npm run typecheck`: 成功
- `npm run lint`: 成功（警告0）
- `npm test`: 成功（15件すべて）
- `npm run build`: 成功

## サマリー

P0: 0件 / P1: 0件 / P2: 0件。左右反転後のトーク画面は、標準表示・最小サイズ・既存操作・アクセシビリティのレビューゲートを通過しました。

`final result: passed`
