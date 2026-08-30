# ホーム画面 最終再レビュー

対象:

- 基準画像: `/Users/kotatsu/.codex/generated_images/01a04e2e-4f46-78b2-8c35-2b89fb36c591/exec-f5c7a433-4fcf-499e-b619-5ae6d3815f79.png`（1487 × 1058）
- 実装画像: `docs/design/implementation/home.png`（1440 × 1024）
- 仕様: `DESIGN.md`
- 実装: `src/renderer/screens/HomeScreen.tsx`、`src/renderer/data/characters.ts`、利用中の `components/ui`

## 指摘

指摘なし。

## 前回指摘の再確認

- 9:16画像契約: `aspect-[9/16]` へ修正済み。
- 左レール装飾: 最適化済みWebPを装飾画像として追加済み。`alt=""` と `aria-hidden="true"` も適切。
- 「続きから」の密度: `size-20`、`py-5` へ修正済み。
- カード説明文: ホーム表示から削除済み。
- 見出し階層: 視覚非表示の `h1`「ホーム」を追加済み。
- ブランドマーク: `Brand` の公開APIを維持したまま専用画像へ差し替え済み。
- 共通部品境界: `Brand`、`Button`、`SectionHeading`、`StatusIndicator` を再利用し、ホーム固有のカードと装飾を画面側に留めている。過剰な共通化はない。
- 画面証跡: 23:22更新の `home.png` で、みかん籠、専用ブランドマーク、9:16カード、説明文削除が現行コードと一致している。
- 見た目: 基準画像の2カラム構造、温かい配色、左レールのブランド装飾、会話再開リスト、4枚の縦長キャラクターカードを再現している。
- 1024 × 720: `BrowserWindow` の最小値、`minmax(0,1fr)`、主領域の `overflow-y-auto` により、横あふれや到達不能要素は確認できない。

## 検証結果

- `npm run typecheck`: 成功
- `npm run lint`: 成功
- `npm test -- --run`: 成功（6件すべて通過）

## サマリー

P0: 0件 / P1: 0件 / P2: 0件。マージ可。

final result: passed
