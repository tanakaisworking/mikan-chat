import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export function GenrePicker({ genres, value, onChange }: { genres: string[]; value: string[]; onChange: (genres: string[]) => void }) {
  const selected = new Set(value)

  return (
    <div className="flex max-h-64 flex-wrap content-start gap-2 overflow-y-auto rounded-md border border-border bg-background p-4" role="group" aria-label="好きなジャンル">
      {genres.map((genre) => {
        const active = selected.has(genre)
        return (
          <button
            key={genre}
            type="button"
            aria-pressed={active}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold transition-[border-color,color] duration-150 hover:border-primary/60",
              active && "border-primary text-primary",
            )}
            onClick={() => onChange(active ? value.filter((item) => item !== genre) : [...value, genre])}
          >
            {active ? <Check className="size-4" aria-hidden="true" /> : null}
            {genre}
          </button>
        )
      })}
    </div>
  )
}
