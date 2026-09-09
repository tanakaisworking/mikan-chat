import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FormTextarea } from "@/components/ui/form-textarea"
import { SectionHeading } from "@/components/ui/section-heading"
import { TextField } from "@/components/ui/text-field"
import { AssetPicker } from "@/components/pack-authoring/asset-picker"
import { createEmptyCharacter, nextDraftKey, type DraftCharacter } from "@/lib/pack-authoring/types"
import { cn } from "@/lib/utils"

export function DraftCharacters({
  characters,
  onChange,
}: {
  characters: DraftCharacter[]
  onChange: (characters: DraftCharacter[]) => void
}) {
  const update = (key: string, patch: Partial<DraftCharacter>) => {
    onChange(characters.map((character) => character.key === key ? { ...character, ...patch } : character))
  }

  return (
    <section className="grid gap-4" aria-label="登場人物">
      <div className="flex items-end justify-between gap-3">
        <SectionHeading>登場人物</SectionHeading>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={characters.length >= 8}
          onClick={() => onChange([...characters, createEmptyCharacter(nextDraftKey())])}
        >
          <Plus />追加
        </Button>
      </div>
      {characters.map((character, index) => (
        <article key={character.key} className="grid gap-4 rounded-xl border border-border bg-surface p-4" aria-label={`登場人物${index + 1}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{character.name.trim() || `登場人物${index + 1}`}</h3>
            {characters.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${character.name.trim() || `登場人物${index + 1}`}を削除`}
                onClick={() => onChange(characters.filter((item) => item.key !== character.key))}
              >
                <Trash2 className="text-danger" />
              </Button>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="ID"
              value={character.id}
              description="半角小文字・数字・-（例：lucien）"
              onChange={(event) => update(character.key, { id: event.target.value })}
            />
            <TextField label="名前" value={character.name} maxLength={60} onChange={(event) => update(character.key, { name: event.target.value })} />
          </div>
          <FormTextarea label="プロフィール" value={character.profile} rows={3} maxLength={2000} onChange={(event) => update(character.key, { profile: event.target.value })} />
          <AssetPicker
            id={`image-${character.key}`}
            label="立ち絵・画像"
            description="webp・png・jpg（16MBまで）"
            kind="image"
            accept=".webp,.png,.jpg,.jpeg,image/*"
            asset={character.image}
            onSelect={(image) => update(character.key, { image })}
          />
          <VoiceFields character={character} onChange={(voice) => update(character.key, { voice })} />
        </article>
      ))}
    </section>
  )
}

function VoiceFields({
  character,
  onChange,
}: {
  character: DraftCharacter
  onChange: (voice: DraftCharacter["voice"]) => void
}) {
  const voice = character.voice
  const set = (patch: Partial<DraftCharacter["voice"]>) => onChange({ ...voice, ...patch })
  return (
    <fieldset className="grid gap-4 rounded-lg border border-border/70 p-4">
      <legend className="px-1 text-sm font-semibold">声</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="声の性別">
        {([
          { value: "", label: "未設定" },
          { value: "female", label: "女性" },
          { value: "male", label: "男性" },
        ] as const).map((option) => (
          <Button
            key={option.label}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={voice.gender === option.value}
            className={cn(voice.gender === option.value && "bg-surface font-bold text-primary hover:bg-surface")}
            onClick={() => set({ gender: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <TextField
        label="声の特徴"
        value={voice.traits}
        description="読点（、）区切りで12個まで（例：落ち着いた、丁寧）"
        onChange={(event) => set({ traits: event.target.value })}
      />
      <FormTextarea label="声の指示文" value={voice.caption} rows={2} maxLength={1000} description="読み上げ時の声の指定（空欄可）" onChange={(event) => set({ caption: event.target.value })} />
      <TextField label="シード" value={voice.seed} inputMode="numeric" description="空欄可。同じ数値で同じ声になりやすい" onChange={(event) => set({ seed: event.target.value })} />
      <AssetPicker
        id={`reference-${character.key}`}
        label="参照音声"
        description="wav・mp3・flac・m4a（16MBまで）。この声の見本として同梱"
        kind="audio"
        accept=".wav,.mp3,.flac,.m4a,audio/*"
        asset={voice.referenceAudio}
        onSelect={(referenceAudio) => set({ referenceAudio })}
      />
    </fieldset>
  )
}
