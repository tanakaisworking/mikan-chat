import { useId, useState } from "react"
import { MessageCircleMore } from "lucide-react"

import { ScenarioPreviewDialog } from "@/components/library/scenario-preview-dialog"
import { DesktopSidebar, MobileHeader, MobileNavigation } from "@/components/navigation/app-navigation"
import { SectionHeading } from "@/components/ui/section-heading"
import type { Character } from "@/data/characters"

type HomeScreenProps = {
  onSelectCharacter: (character: Character, source: HomeTab) => void
  characters: Character[]
  activeTab: HomeTab
  onTabChange: (tab: HomeTab) => void
  onAddPack: () => void
  onOpenDocs: () => void
  onOpenSettings: () => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

export type HomeTab = "home" | "chat"

export function HomeScreen({
  onSelectCharacter,
  characters,
  activeTab,
  onTabChange,
  onAddPack,
  onOpenDocs,
  onOpenSettings,
  loading = false,
  error = null,
  onRetry,
}: HomeScreenProps) {
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null)

  return (
    <main className="grid h-screen grid-cols-[300px_minmax(0,1fr)] overflow-hidden bg-background max-md:block max-md:h-dvh max-md:overflow-y-auto max-md:pb-[calc(148px+env(safe-area-inset-bottom))]" data-testid="home-screen">
      <DesktopSidebar activePage={activeTab} onPageChange={onTabChange} onAddPack={onAddPack} onOpenDocs={onOpenDocs} onOpenSettings={onOpenSettings} />
      <MobileHeader onOpenDocs={onOpenDocs} onOpenSettings={onOpenSettings} />

      <section className="min-w-0 overflow-y-auto px-10 py-8 max-md:overflow-visible max-md:px-4 max-md:py-5">
        <div className="mx-auto max-w-[1120px]">
          <h1 className="sr-only">{activeTab === "home" ? "ホーム" : "チャット"}</h1>
          {loading && characters.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground" role="status">シナリオを読み込んでいます…</p> : null}
          {error ? (
            <div className={`mx-auto max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-soft ${characters.length > 0 ? "mb-6" : "my-12"}`} role="alert">
              <p className="font-semibold">{error}</p>
              <button type="button" className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={onRetry}>もう一度試す</button>
            </div>
          ) : null}
          {characters.length > 0 || (!loading && !error) ? <>
          {activeTab === "chat" ? <div>
            <div className="mb-3">
              <SectionHeading>続きから</SectionHeading>
            </div>

            <div className="divide-y divide-border/70 border-y border-border/70">
              {characters.slice(0, 2).map((character) => (
                <button
                  key={character.id}
                  type="button"
                  className="group flex w-full items-center gap-5 px-2 py-5 text-left transition-colors hover:bg-surface-soft/70 max-md:gap-3 max-md:py-4"
                  onClick={() => onSelectCharacter(character, "chat")}
                >
                  {character.image ? (
                    <img src={character.image} alt="" className="size-20 shrink-0 rounded-full border border-border object-cover object-top shadow-soft max-md:size-14" />
                  ) : (
                    <span className="grid size-20 shrink-0 place-items-center rounded-full border border-border bg-surface-accent text-xl font-semibold text-primary shadow-soft max-md:size-14">{character.name.slice(0, 1)}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold max-md:text-base">{character.name}</span>
                    <span className="mt-1 block truncate text-base text-muted-foreground max-md:text-sm">{character.lastMessage}</span>
                  </span>
                  <span className="text-sm text-muted-foreground max-md:text-xs">{character.lastActive}</span>
                  <MessageCircleMore className="size-5 text-primary-bright opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div> : null}

          {activeTab === "home" ? <div>
            <div className="mt-9 max-md:mt-0">
              <SectionHeading>シナリオを探す</SectionHeading>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">気になる状況から、物語の中へ入りましょう。</p>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-5 max-[1023px]:grid-cols-2 max-md:gap-3">
              {characters.map((character) => (
                <ScenarioCard
                  key={character.id}
                  character={character}
                  onClick={() => setPreviewCharacter(character)}
                />
              ))}
            </div>
          </div> : null}
          </> : null}
        </div>
      </section>

      <MobileNavigation activePage={activeTab} onPageChange={onTabChange} onAddPack={onAddPack} />
      <ScenarioPreviewDialog
        character={previewCharacter}
        onOpenChange={(open) => { if (!open) setPreviewCharacter(null) }}
        onStart={() => {
          if (!previewCharacter) return
          onSelectCharacter(previewCharacter, "home")
          setPreviewCharacter(null)
        }}
      />
    </main>
  )
}

function ScenarioCard({ character, onClick }: { character: Character; onClick: () => void }) {
  const title = character.packTitle ?? character.name
  const titleId = useId()
  const detailsId = useId()
  const conversationLabel = character.conversationLabel ?? "1人と会話"
  return (
    <button
      type="button"
      className="group min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
      onClick={onClick}
      aria-labelledby={titleId}
      aria-describedby={detailsId}
    >
      <span id={detailsId} className="sr-only">
        {conversationLabel}。{character.description}。タグ：{(character.tags ?? []).join("、")}。登場人物：{character.name}
      </span>
      <span className="relative block aspect-[3/4] overflow-hidden rounded-lg border border-border bg-surface shadow-soft transition-[transform,box-shadow] duration-200 ease-mikan group-hover:-translate-y-1 group-hover:shadow-overlay">
        {character.image ? (
          <img src={character.image} alt={`${title}のカバー画像`} className="size-full object-cover object-top transition-transform duration-300 ease-mikan group-hover:scale-[1.025]" />
        ) : (
          <span className="grid size-full place-items-center bg-[radial-gradient(circle_at_68%_18%,#ffe6cf_0%,#e7a06e_48%,#8d4a2a_100%)] text-7xl font-semibold text-white/72" role="img" aria-label={`${title}のカバー画像はありません`}>{character.name.slice(0, 1)}</span>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-black/62 px-3 py-1.5 text-xs font-semibold text-white shadow-overlay backdrop-blur-sm max-md:top-2 max-md:left-2 max-md:px-2.5 max-md:py-1">
          {conversationLabel}
        </span>
        <span className="absolute inset-x-0 bottom-0 h-[76%] bg-linear-to-t from-[#201712]/98 via-[#2a2019]/82 to-transparent" aria-hidden="true" />
        <span className="absolute inset-x-0 bottom-0 block p-5 text-white max-md:p-3">
          <span id={titleId} className="line-clamp-2 text-xl leading-snug font-semibold break-words text-balance max-md:text-[15px]">{title}</span>
          <span className="mt-2 block max-h-12 overflow-hidden text-sm leading-6 text-white/84 max-md:mt-1.5 max-md:max-h-10 max-md:text-xs max-md:leading-5">{character.description}</span>
          <span className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-white/75 max-md:mt-2 max-md:text-[11px]">
            {(character.tags ?? []).slice(0, 3).map((tag, index) => <span key={tag} className={index === 2 ? "max-md:hidden" : undefined}>#{tag}</span>)}
          </span>
          <span className="mt-3 block border-t border-white/20 pt-3 text-xs text-white/72 max-md:hidden">登場人物：{character.name}</span>
        </span>
      </span>
    </button>
  )
}
