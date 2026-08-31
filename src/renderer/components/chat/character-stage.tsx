import { cn } from "@/lib/utils"

export function CharacterStage({ image, name, className }: { image?: string; name: string; className?: string }) {
  return (
    <figure className={cn("min-h-0 overflow-hidden bg-surface-soft/60", className)}>
      <div className="size-full overflow-hidden border-r border-border/70 bg-surface shadow-soft max-md:border-r-0">
        {image ? (
          <img
            src={image}
            alt={`${name}のキャラクタービジュアル`}
            className="size-full object-cover object-top max-md:object-[50%_22%]"
          />
        ) : (
          <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_35%,#ffe1c7_0%,#f8cda8_38%,#d87835_100%)]" role="img" aria-label={`${name}の画像はありません`}>
            <span className="grid size-28 place-items-center rounded-full border border-white/55 bg-white/28 text-5xl font-semibold text-white shadow-overlay backdrop-blur-sm max-md:size-24 max-md:text-4xl">{name.slice(0, 1)}</span>
          </div>
        )}
      </div>
    </figure>
  )
}
