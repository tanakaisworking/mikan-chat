# レスポンシブ対応後ホーム画面 最終レビュー

対象:

- スマホ実装画像: `docs/design/implementation/mobile-home.png`（390 × 844）
- PC実装画像: `docs/design/implementation/home.png`（1280 × 720）
- 仕様: `DESIGN.md`
- 実装: `src/renderer/screens/HomeScreen.tsx`、`src/renderer/styles/globals.css`、利用中の `components/ui`

## 指摘

指摘なし。

## 前回指摘の再確認

- みかん籠: レスポンシブ作業前にユーザーが明示した削除であり、承認済みの意図的変更。PC回帰には含めない。
- 操作の単一化: 追加・設定は各1個の `IconButton` のみをDOMへ置き、重複したアクセシブルネームとテスト回帰を解消している。
- モバイル操作: 共通 `IconButton` の44 × 44px、`aria-label`、日本語Tooltipを持ち、テキストだけを `sr-only` へ切り替える。
- PC操作: 同じ `IconButton` を全幅・52px高・テキスト付きへスタイルし、従来の追加・設定操作を維持する。
- 固定App Bar: 390 × 844では `sticky top-0`、半透明背景、z-indexを持ち、本文だけが縦スクロールする。
- 「続きから」: 2件のアバター、名前、プレビュー、日時が収まり、長文は `truncate` されて横あふれしない。
- キャラクター一覧: 2列、9:16画像、12pxの列間隔で、カード全体が44px以上の操作領域となる。
- 横幅: 左右16px、`min-w-0`、2列Gridにより390pxで横スクロールは発生しない。
- PC: 768px以上では300pxサイドバー、テキスト付き操作、4列カード、主領域スクロールへ戻り、現行PC画像の配置を維持する。
- 共通化: `Brand`、`Button`、`IconButton`、`SectionHeading`、`StatusIndicator`、キャラクターカードをPC／スマホで共有している。

## 検証結果

- `npm run typecheck`: 成功
- `npm run lint`: 成功
- `npm test -- --run`: 成功（15件すべて通過）
- `npm run build`: 成功

## サマリー

P0: 0件 / P1: 0件 / P2: 0件。マージ可。

final result: passed
