import { useId } from "react"
import { BookOpenText, House, MessageCircleMore, MessagesSquare, Plus, Settings } from "lucide-react"

import { Brand } from "@/components/ui/brand"
import { IconButton } from "@/components/ui/icon-button"
import { SectionHeading } from "@/components/ui/section-heading"
import { StatusIndicator } from "@/components/ui/status-indicator"
import type { Character } from "@/data/characters"

type HomeScreenProps = {
  onSelectCharacter: (character: Character, source: HomeTab) => void
  characters: Character[]
  activeTab: HomeTab
  onTabChange: (tab: HomeTab) => void
  onAddPack: () => void
  onOpenDocs: () => void
  onOpenSettings: () => void
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
}: HomeScreenProps) {
  return (
    <main className="grid h-screen grid-cols-[300px_minmax(0,1fr)] overflow-hidden bg-background max-md:block max-md:h-dvh max-md:overflow-y-auto max-md:pb-[calc(72px+env(safe-area-inset-bottom))]" data-testid="home-screen">
      <aside className="flex h-full flex-col border-r border-border/70 bg-surface-soft/65 p-6 max-md:sticky max-md:top-0 max-md:z-20 max-md:h-auto max-md:flex-row max-md:items-center max-md:border-r-0 max-md:border-b max-md:bg-background/92 max-md:p-3 max-md:backdrop-blur-xl">
        <Brand className="mt-4 max-md:mt-0 max-md:gap-2 max-md:[&_img]:size-10 max-md:[&_span]:text-xl" />
        <IconButton
          label="チャットパックを追加"
          className="mt-8 h-13 w-full gap-2 rounded-md bg-primary px-7 text-white shadow-soft hover:bg-primary/90 max-md:ml-auto max-md:mt-0 max-md:size-11 max-md:rounded-full max-md:px-0"
          onClick={onAddPack}
        >
          <Plus />
          <span className="max-md:sr-only">チャットパックを追加</span>
        </IconButton>

        <div className="mt-auto grid gap-1 border-t border-border/70 pt-5 max-md:mt-0 max-md:flex max-md:border-0 max-md:pt-0">
          <IconButton
            label="技術ドキュメント"
            className="h-13 w-full justify-start gap-2 rounded-md px-7 max-md:size-11 max-md:justify-center max-md:rounded-full max-md:px-0"
            onClick={onOpenDocs}
          >
            <BookOpenText />
            <span className="max-md:sr-only">技術ドキュメント</span>
          </IconButton>
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
          <div className={activeTab === "chat" ? "block" : "max-md:hidden"}>
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
                  onClick={() => onSelectCharacter(character, "chat")}
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
          </div>

          <div className={activeTab === "home" ? "block" : "max-md:hidden"}>
            <div className="mt-9 max-md:mt-0">
              <SectionHeading>シナリオを探す</SectionHeading>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">気になる状況から、物語の中へ入りましょう。</p>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-5 max-[1023px]:grid-cols-2 max-md:gap-3">
              {characters.map((character) => (
                <ScenarioCard
                  key={character.id}
                  character={character}
                  onClick={() => onSelectCharacter(character, "home")}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <nav
        aria-label="メインナビゲーション"
        className="fixed inset-x-0 bottom-0 z-30 hidden h-[calc(72px+env(safe-area-inset-bottom))] grid-cols-2 border-t border-border/80 bg-surface/96 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgb(91_62_40_/_8%)] backdrop-blur-xl max-md:grid"
      >
        <MobileTabButton
          active={activeTab === "home"}
          label="ホーム"
          icon={<House />}
          onClick={() => onTabChange("home")}
        />
        <MobileTabButton
          active={activeTab === "chat"}
          label="チャット"
          icon={<MessagesSquare />}
          onClick={() => onTabChange("chat")}
        />
      </nav>
    </main>
  )
}

function MobileTabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className="relative flex min-h-11 flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 aria-current:text-primary [&_svg]:size-6"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {active ? <span className="absolute top-0 h-0.5 w-12 rounded-full bg-primary" aria-hidden="true" /> : null}
    </button>
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
        <img
          src={character.image}
          alt={`${title}のカバー画像`}
          className="size-full object-cover object-top transition-transform duration-300 ease-mikan group-hover:scale-[1.025]"
        />
        <span className="absolute top-3 left-3 rounded-full bg-black/62 px-3 py-1.5 text-xs font-semibold text-white shadow-overlay backdrop-blur-sm max-md:top-2 max-md:left-2 max-md:px-2.5 max-md:py-1">
          {conversationLabel}
        </span>
        <span className="absolute inset-x-0 bottom-0 h-[76%] bg-linear-to-t from-[#201712]/98 via-[#2a2019]/82 to-transparent" aria-hidden="true" />
        <span className="absolute inset-x-0 bottom-0 block p-5 text-white max-md:p-3">
          <span id={titleId} className="block text-xl leading-snug font-semibold text-balance max-md:text-[15px]">{title}</span>
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
