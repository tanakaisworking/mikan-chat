import { Button } from "@/components/ui/button"
import { FormTextarea } from "@/components/ui/form-textarea"
import { SectionHeading } from "@/components/ui/section-heading"
import { TextField } from "@/components/ui/text-field"
import { AssetPicker } from "@/components/pack-authoring/asset-picker"
import type { PackDraft } from "@/lib/pack-authoring/types"
import { cn } from "@/lib/utils"

function SegmentedOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={selected}
      className={cn(selected && "bg-surface font-bold text-primary hover:bg-surface")}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function DraftBasics({
  draft,
  onChange,
}: {
  draft: PackDraft
  onChange: (patch: Partial<PackDraft>) => void
}) {
  return (
    <section className="grid gap-4" aria-label="基本情報">
      <SectionHeading>基本情報</SectionHeading>
      <TextField label="タイトル" value={draft.title} maxLength={80} onChange={(event) => onChange({ title: event.target.value })} placeholder="「愛さない」契約なのに…" />
      <FormTextarea label="あらすじ" value={draft.summary} rows={3} maxLength={500} onChange={(event) => onChange({ summary: event.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="作者名" value={draft.authorName} maxLength={80} onChange={(event) => onChange({ authorName: event.target.value })} />
        <TextField label="作者URL" value={draft.authorUrl} inputMode="url" placeholder="https://…" onChange={(event) => onChange({ authorUrl: event.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="ライセンス" value={draft.license} maxLength={80} description="例： All-Rights-Reserved" onChange={(event) => onChange({ license: event.target.value })} />
        <div className="grid gap-2">
          <span className="text-sm font-medium text-foreground">対象年齢</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="対象年齢">
            {(["all", "r15", "r18"] as const).map((rating) => (
              <SegmentedOption key={rating} selected={draft.rating === rating} onClick={() => onChange({ rating })}>
                {rating === "all" ? "全年齢" : rating.toUpperCase()}
              </SegmentedOption>
            ))}
          </div>
        </div>
      </div>
      <TextField
        label="タグ"
        value={draft.tags}
        description="読点（、）や改行で区切って12個まで"
        onChange={(event) => onChange({ tags: event.target.value })}
        placeholder="契約結婚、公爵、ファンタジー"
      />
      <FormTextarea label="紹介文" value={draft.description} rows={3} maxLength={2000} onChange={(event) => onChange({ description: event.target.value })} />
      <div className="grid gap-2">
        <span className="text-sm font-medium text-foreground">想定読者</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="想定読者">
          {(["all", "men", "women"] as const).map((audience) => (
            <SegmentedOption key={audience} selected={draft.audience === audience} onClick={() => onChange({ audience })}>
              {audience === "all" ? "みんな" : audience === "men" ? "男性向け" : "女性向け"}
            </SegmentedOption>
          ))}
        </div>
      </div>
      <AssetPicker
        id="cover"
        label="カバー画像"
        description="webp・png・jpg（16MBまで）"
        kind="image"
        accept=".webp,.png,.jpg,.jpeg,image/*"
        asset={draft.cover}
        onSelect={(cover) => onChange({ cover })}
      />
    </section>
  )
}
