import { MessageSquareText, ScrollText, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FormTextarea } from "@/components/ui/form-textarea"
import { SectionHeading } from "@/components/ui/section-heading"
import { nextDraftKey, type DraftCharacter, type DraftEvent } from "@/lib/pack-authoring/types"

export function DraftOpening({
  opening,
  characters,
  onChange,
}: {
  opening: DraftEvent[]
  characters: DraftCharacter[]
  onChange: (opening: DraftEvent[]) => void
}) {
  const update = (key: string, patch: Partial<DraftEvent>) => {
    onChange(opening.map((event) => event.key === key ? { ...event, ...patch } as DraftEvent : event))
  }

  return (
    <section className="grid gap-4" aria-label="導入">
      <div className="flex items-end justify-between gap-3">
        <SectionHeading>導入</SectionHeading>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={opening.length >= 60}
            onClick={() => onChange([...opening, { key: nextDraftKey(), type: "dialogue", speaker: characters[0]?.id ?? "", text: "" }])}
          >
            <MessageSquareText />セリフ
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={opening.length >= 60}
            onClick={() => onChange([...opening, { key: nextDraftKey(), type: "narration", text: "" }])}
          >
            <ScrollText />描写
          </Button>
        </div>
      </div>
      {opening.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">物語の出だしを追加してください。セリフか情景描写を選べます。</p>
      ) : null}
      <ol className="grid gap-3">
        {opening.map((event, index) => (
          <li key={event.key} className="grid gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-soft text-xs font-bold text-primary" aria-hidden="true">
                {index + 1}
              </span>
              <span className="text-sm font-semibold">{event.type === "dialogue" ? "セリフ" : "情景描写"}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label={`導入${index + 1}を削除`}
                onClick={() => onChange(opening.filter((item) => item.key !== event.key))}
              >
                <Trash2 className="text-danger" />
              </Button>
            </div>
            {event.type === "dialogue" ? (
              <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
                <span>話者</span>
                <select
                  value={event.speaker}
                  onChange={(e) => update(event.key, { speaker: e.target.value })}
                  className="h-12 w-full min-w-0 rounded-md border border-input bg-surface px-4 text-base text-foreground shadow-soft outline-none focus:border-primary"
                >
                  <option value="">選択してください</option>
                  <option value="user">あなた（プレイヤー）</option>
                  {characters.filter((character) => character.id.trim()).map((character) => (
                    <option key={character.key} value={character.id.trim()}>
                      {character.name.trim() || character.id.trim()}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <FormTextarea
              label={event.type === "dialogue" ? "セリフ" : "本文"}
              value={event.text}
              rows={2}
              maxLength={4096}
              onChange={(e) => update(event.key, { text: e.target.value })}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

export function DraftGuide({
  premise,
  instructions,
  onChange,
}: {
  premise: string
  instructions: string
  onChange: (patch: { premise?: string; instructions?: string }) => void
}) {
  return (
    <section className="grid gap-4" aria-label="会話の指針">
      <SectionHeading>会話の指針</SectionHeading>
      <FormTextarea label="前提" value={premise} rows={4} maxLength={4000} onChange={(event) => onChange({ premise: event.target.value })} />
      <FormTextarea
        label="振る舞いの指針"
        value={instructions}
        rows={5}
        maxLength={8000}
        description="空欄可。キャラクターの話し方・禁則・話題の振り方など"
        onChange={(event) => onChange({ instructions: event.target.value })}
      />
    </section>
  )
}
