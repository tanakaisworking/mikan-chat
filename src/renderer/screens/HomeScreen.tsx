import { MessageCircleMore, Plus, Settings } from "lucide-react"

import { Brand } from "@/components/ui/brand"
import { IconButton } from "@/components/ui/icon-button"
import { SectionHeading } from "@/components/ui/section-heading"
import { StatusIndicator } from "@/components/ui/status-indicator"
import type { Character } from "@/data/characters"

type HomeScreenProps = {
  onSelectCharacter: (character: Character) => void
  characters: Character[]
  onAddCharacter: () => void
  onOpenSettings: () => void
}

export function HomeScreen({
  onSelectCharacter,
  characters,
  onAddCharacter,
  onOpenSettings,
}: HomeScreenProps) {
  return (
    <main className="grid h-screen grid-cols-[300px_minmax(0,1fr)] overflow-hidden bg-background max-md:block max-md:h-dvh max-md:overflow-y-auto" data-testid="home-screen">
      <aside className="flex h-full flex-col border-r border-border/70 bg-surface-soft/65 p-6 max-md:sticky max-md:top-0 max-md:z-20 max-md:h-auto max-md:flex-row max-md:items-center max-md:border-r-0 max-md:border-b max-md:bg-background/92 max-md:p-3 max-md:backdrop-blur-xl">
        <Brand className="mt-4 max-md:mt-0 max-md:gap-2 max-md:[&_img]:size-10 max-md:[&_span]:text-xl" />
        <IconButton
          label="キャラクターを追加"
          className="mt-8 h-13 w-full gap-2 rounded-md bg-primary px-7 text-white shadow-soft hover:bg-primary/90 max-md:ml-auto max-md:mt-0 max-md:size-11 max-md:rounded-full max-md:px-0"
          onClick={onAddCharacter}
        >
          <Plus />
          <span className="max-md:sr-only">キャラクターを追加</span>
        </IconButton>

        <div className="mt-auto border-t border-border/70 pt-5 max-md:mt-0 max-md:border-0 max-md:pt-0">
          <IconButton
            label="設定"
            className="h-13 w-full justify-start gap-2 rounded-md px-7 max-md:size-11 max-md:justify-center max-md:rounded-full max-md:px-0"
            onClick={onOpenSettings}
          >
            <Settings />
            <span className="max-md:sr-only">設定</span>
          </IconButton>
        </div>
      </aside>

      <section className="min-w-0 overflow-y-auto px-10 py-8 max-md:overflow-visible max-md:px-4 max-md:py-5">
        <div className="mx-auto max-w-[1120px]">
          <h1 className="sr-only">ホーム</h1>
          <div className="mb-3 flex items-center justify-between">
            <SectionHeading>続きから</SectionHeading>
            <StatusIndicator label="このPCで処理" />
          </div>

          <div className="divide-y divide-border/70 border-y border-border/70">
            {characters.slice(0, 2).map((character) => (
              <button
                key={character.id}
                type="button"
                className="group flex w-full items-center gap-5 px-2 py-5 text-left transition-colors hover:bg-surface-soft/70 max-md:gap-3 max-md:py-4"
                onClick={() => onSelectCharacter(character)}
              >
                <img
                  src={character.image}
                  alt=""
                  className="size-20 shrink-0 rounded-full border border-border object-cover object-top shadow-soft max-md:size-14"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold max-md:text-base">{character.name}</span>
                  <span className="mt-1 block truncate text-base text-muted-foreground max-md:text-sm">{character.lastMessage}</span>
                </span>
                <span className="text-sm text-muted-foreground max-md:text-xs">{character.lastActive}</span>
                <MessageCircleMore className="size-5 text-primary-bright opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </button>
            ))}
          </div>

          <SectionHeading className="mt-9 max-md:mt-7">キャラクター</SectionHeading>
          <div className="mt-5 grid grid-cols-4 gap-4 max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-5">
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onClick={() => onSelectCharacter(character)}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function CharacterCard({ character, onClick }: { character: Character; onClick: () => void }) {
  return (
    <button
      type="button"
      className="group min-w-0 text-left"
      onClick={onClick}
      aria-label={`${character.name}と話す`}
    >
      <span className="relative block aspect-[9/16] overflow-hidden rounded-lg border border-border bg-surface shadow-soft transition-[transform,box-shadow] duration-200 ease-mikan group-hover:-translate-y-1 group-hover:shadow-overlay">
        <img
          src={character.image}
          alt={`${character.name}のキャラクター画像`}
          className="size-full object-cover object-top transition-transform duration-300 ease-mikan group-hover:scale-[1.025]"
        />
        <span className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-foreground/40 to-transparent" aria-hidden="true" />
      </span>
      <span className="mt-3 block text-center text-lg font-semibold max-md:mt-2 max-md:text-base">{character.name}</span>
    </button>
  )
}
