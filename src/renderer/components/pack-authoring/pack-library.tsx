import { useState } from "react"
import { Copy, Download, FlaskConical, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/ui/section-heading"
import type { DraftEntry } from "@/lib/pack-authoring/storage"

function entryTitle(entry: DraftEntry) {
  return entry.draft.title.trim() || "無題の物語"
}

function entryDate(entry: DraftEntry) {
  const time = new Date(entry.updatedAt).getTime()
  if (Number.isNaN(time)) return ""
  return new Date(time).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
}

export function PackLibrary({
  entries,
  onNew,
  onAiCreate,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
  onTry,
  workingId,
}: {
  entries: DraftEntry[]
  onNew: () => void
  onAiCreate: () => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onExport: (id: string) => void
  onTry: (id: string) => void
  workingId: string | null
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <div className="grid gap-6" aria-label="自分のシナリオ置き場">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <SectionHeading>つくった物語</SectionHeading>
          <p className="text-sm leading-relaxed text-muted-foreground">
            途中まで書いた下書きと、完成したオリジナル作品を置いておけます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onNew}>
            <Plus />新しくつくる
          </Button>
          <Button type="button" variant="outline" onClick={onAiCreate}>
            <Sparkles />AIで作る
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="grid gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">まだ何もありません。新しくつくるか、物語の画面から編集して連れてきましょう。</p>
          <p>
            <Button type="button" variant="outline" onClick={onNew}>
              <Plus />最初の1本をつくる
            </Button>
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-4 rounded-xl border border-border bg-surface p-4 shadow-soft"
            >
              {entry.draft.cover ? (
                <img src={entry.draft.cover.dataUrl} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
              ) : (
                <span className="grid aspect-[3/4] w-full place-items-center rounded-lg bg-surface-soft text-2xl font-semibold text-primary/50" aria-hidden="true">
                  {entryTitle(entry).slice(0, 1)}
                </span>
              )}
              <span className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-1">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">{entryTitle(entry)}</span>
                  <span
                    className={entry.status === "done"
                      ? "shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success"
                      : "shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-xs font-semibold text-muted-foreground"}
                  >
                    {entry.status === "done" ? "完成" : "下書き"}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[entry.draft.characters.map((character) => character.name.trim()).filter(Boolean).join("・") || "登場人物未定", entryDate(entry)].filter(Boolean).join(" ・ ")}
                </span>
                <span className="flex flex-wrap gap-1.5 pt-2">
                  <Button type="button" variant="outline" size="sm" disabled={workingId !== null} onClick={() => onEdit(entry.id)}>
                    <Pencil />編集
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={workingId !== null}
                    aria-label={`${entryTitle(entry)}をエクスポート`}
                    onClick={() => onExport(entry.id)}
                  >
                    <Download />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={workingId !== null}
                    aria-label={`${entryTitle(entry)}を取り込んで試す`}
                    onClick={() => onTry(entry.id)}
                  >
                    <FlaskConical />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={workingId !== null}
                    aria-label={`${entryTitle(entry)}を複製`}
                    onClick={() => onDuplicate(entry.id)}
                  >
                    <Copy />
                  </Button>
                  {confirmingId === entry.id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      disabled={workingId !== null}
                      onClick={() => {
                        setConfirmingId(null)
                        onDelete(entry.id)
                      }}
                    >
                      本当に削除
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={workingId !== null}
                      aria-label={`${entryTitle(entry)}を削除`}
                      onClick={() => setConfirmingId(entry.id)}
                    >
                      <Trash2 className="text-danger" />
                    </Button>
                  )}
                </span>
                {workingId === entry.id ? <span className="text-xs text-muted-foreground" role="status">処理しています…</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
