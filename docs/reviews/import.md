# キャラクター追加Dialog 最終再レビュー

対象:

- 基準画像: `/Users/kotatsu/.codex/generated_images/01a04e2e-4f46-78b2-8c35-2b89fb36c591/exec-949d72ef-eeb7-4606-b06e-162c6548c017.png`（1487 × 1058）
- 実装画像: `docs/design/implementation/import.png`（1280 × 720）
- 仕様: `DESIGN.md`
- 実装: `src/renderer/components/library/import-character-dialog.tsx`、`src/renderer/App.tsx`、`src/renderer/components/ui/dialog.tsx`、`src/renderer/components/ui/button.tsx`

## 指摘

指摘なし。

## 前回指摘の再確認

- ライブラリ状態: `App` がキャラクター配列を状態として保持し、更新後の一覧を `HomeScreen` へ渡している。
- 重複防止: `addImportedCharacter` がIDを確認し、同じ雫を再追加しない。
- 「ライブラリに追加」: 共通の追加処理後にDialogを閉じ、ホームへ雫が表示される。
- 「追加して話す」: 同じ追加処理後に雫のトークへ進み、ホームへ戻っても雫が残る。
- 見た目: Dialogを最大1120pxへ広げ、画像を正方形へ変更し、3ボタンへ共通 `Button` の `size="lg"` を適用した。最新画像で基準の比率と情報密度に近づいたことを確認した。
- 最小高: 1280 × 720の最新画像でDialogが画面内に収まっている。さらに `max-h-[calc(100vh-48px)]` と `overflow-y-auto` があり、内容が増えても操作へ到達できる。
- 回帰テスト: ライブラリ追加と、追加して会話後に戻った場合の保持を検証する2件が追加されている。

## 確認済み事項

- 基準画像の「画像＋人物情報＋安全状態＋ファイル名＋3操作」という構造、温かい配色、角丸、オーバーレイは再現されている。
- `Dialog` と `Button` は共通部品を再利用し、雫固有の表示は `components/library/` に留めている。共通化の境界は適切。
- Base UIのDialogを使っており、タイトルと説明の関連付け、フォーカストラップ、Escape・背景操作によるクローズを共通部品へ委譲している。
- 閉じるボタンは44 × 44pxで読み上げ名「閉じる」を持ち、画像には役割が分かる代替テキストがある。色だけに依存しない安全表示と、明瞭なフォーカスリングも確認できる。
- `npm run typecheck`: 成功
- `npm run lint`: 成功
- `npm test -- --run`: 成功（9件すべて通過）

## サマリー

P0: 0件 / P1: 0件 / P2: 0件。マージ可。

final result: passed
