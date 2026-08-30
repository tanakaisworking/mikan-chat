import { cn } from "@/lib/utils"

export function CharacterStage({ image, name, className }: { image: string; name: string; className?: string }) {
  return (
    <figure className={cn("min-h-0 overflow-hidden bg-surface-soft/60", className)}>
      <div className="size-full overflow-hidden border-r border-border/70 bg-surface shadow-soft max-md:border-r-0">
        <img
          src={image}
          alt={`${name}のキャラクタービジュアル`}
          className="size-full object-cover object-top max-md:object-[50%_22%]"
        />
      </div>
    </figure>
  )
}
