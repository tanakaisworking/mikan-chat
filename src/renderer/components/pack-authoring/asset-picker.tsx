import { useState } from "react"
import { ImagePlus, Music4, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { fileToDraftAsset } from "@/lib/pack-authoring/build"
import type { DraftAsset } from "@/lib/pack-authoring/types"
import { cn } from "@/lib/utils"

export function AssetPicker({
  id,
  label,
  description,
  kind,
  asset,
  accept,
  onSelect,
}: {
  id: string
  label: string
  description?: string
  kind: "image" | "audio"
  asset: DraftAsset | null
  accept: string
  onSelect: (asset: DraftAsset | null) => void
}) {
  const [error, setError] = useState("")
  const inputId = `asset-${id}`

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {asset ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
          {kind === "image" ? (
            <img src={asset.dataUrl} alt="" className="size-16 shrink-0 rounded-md object-cover" />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-md bg-surface-soft text-primary">
              <Music4 className="size-6" aria-hidden="true" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{asset.fileName}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{Math.round(asset.size / 1024)}KB</span>
          </span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`${label}を取り消す`} onClick={() => { setError(""); onSelect(null) }}>
            <X />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-4 py-5",
            "transition-colors hover:border-primary-bright/60 hover:bg-surface-soft/50",
          )}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-soft text-primary">
            <ImagePlus className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">ファイルを選ぶ</span>
            {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
          </span>
          <input
            id={inputId}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) return
              void fileToDraftAsset(file, kind).then((next) => {
                setError("")
                onSelect(next)
              }).catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : "ファイルを読み込めませんでした。")
              })
            }}
          />
        </label>
      )}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : null}
    </div>
  )
}
