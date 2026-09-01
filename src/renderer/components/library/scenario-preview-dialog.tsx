import { BookOpenText, UserRound, UsersRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Character } from "@/data/characters"

export function ScenarioPreviewDialog({
  character,
  onOpenChange,
  onStart,
}: {
  character: Character | null
  onOpenChange: (open: boolean) => void
  onStart: () => void
}) {
  const preview = character ? readPreview(character) : null

  return (
    <Dialog open={Boolean(character)} onOpenChange={onOpenChange}>
      {character && preview ? (
        <DialogContent className="flex h-[min(86vh,860px)] max-w-[960px] flex-row gap-0 overflow-hidden p-0 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:flex-col max-md:rounded-none max-md:border-0 max-md:p-0">
          <div className="relative w-[340px] shrink-0 overflow-hidden bg-surface-soft max-md:h-56 max-md:w-full">
            {character.image ? (
              <img src={character.image} alt={`${preview.title}の物語カバー`} className="size-full object-cover object-top" />
            ) : (
              <div className="grid size-full place-items-center bg-surface-accent text-8xl font-semibold text-primary/35" role="img" aria-label="カバー画像はありません">
                {character.name.slice(0, 1)}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/78 to-transparent px-6 pt-16 pb-6 text-white max-md:px-4 max-md:pt-12 max-md:pb-4">
              <p className="text-sm font-semibold">{character.conversationLabel ?? `${preview.characters.length}人と会話`}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {preview.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full border border-white/30 bg-black/28 px-2.5 py-1 text-xs">#{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            <div className="min-h-0 flex-1 overflow-y-auto px-9 pt-9 pb-6 max-md:px-5 max-md:pt-6 max-md:pb-5">
              <p className="text-sm font-semibold text-primary">これから、あなたが入る物語</p>
              <DialogTitle className="mt-2 max-w-[24ch] text-3xl text-balance max-md:text-2xl">{preview.title}</DialogTitle>
              <DialogDescription className="mt-3 leading-6">
                状況と登場人物を確認してから、物語を始められます。
              </DialogDescription>

              <div className="mt-7 grid gap-6">
                <PreviewSection icon={<BookOpenText />} title="物語の状況">
                  <p>{preview.premise}</p>
                </PreviewSection>

                <PreviewSection icon={<UserRound />} title="あなたの役">
                  <p className="font-semibold text-foreground">{preview.player.name}</p>
                  <p className="mt-1">{preview.player.description}</p>
                </PreviewSection>

                <PreviewSection icon={<UsersRound />} title="登場人物">
                  <div className="grid gap-3">
                    {preview.characters.map((item) => (
                      <div key={item.name} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-md bg-surface-soft p-3">
                        <span className="grid size-11 place-items-center rounded-full bg-surface-accent text-base font-semibold text-primary" aria-hidden="true">
                          {item.name.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{item.name}</p>
                          <p className="mt-0.5 text-sm leading-6">{item.profile}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </PreviewSection>
              </div>

              {preview.author || preview.rating ? (
                <p className="mt-7 border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
                  {[preview.author ? `作者: ${preview.author}` : null, preview.rating].filter(Boolean).join(" ・ ")}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-border bg-surface px-9 py-5 max-md:px-5 max-md:pt-4 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex flex-row-reverse items-center justify-start gap-3 max-md:flex-col">
                <Button size="lg" className="min-w-56 max-md:w-full" onClick={onStart}>この物語をはじめる</Button>
                <DialogClose render={<Button variant="ghost" className="max-md:w-full" />}>別のシナリオを見る</DialogClose>
              </div>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function PreviewSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      <span className="mt-0.5 text-primary-bright [&_svg]:size-5" aria-hidden="true">{icon}</span>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="mt-2 text-[15px] leading-7 text-muted-foreground">{children}</div>
      </div>
    </section>
  )
}

function readPreview(character: Character) {
  const pack = isRecord(character.pack) ? character.pack : null
  const plot = pack && isRecord(pack.plot) ? pack.plot : null
  const characters = Array.isArray(plot?.characters)
    ? plot.characters.flatMap((item) => isRecord(item) && typeof item.name === "string"
      ? [{ name: item.name, profile: typeof item.profile === "string" ? item.profile : "この物語の登場人物です。" }]
      : [])
    : []
  const playerProfiles = Array.isArray(plot?.playerProfiles)
    ? plot.playerProfiles.filter((item) => isRecord(item) && typeof item.name === "string" && typeof item.description === "string")
    : []
  const defaultPlayerId = typeof plot?.defaultPlayerProfile === "string" ? plot.defaultPlayerProfile : null
  const player = playerProfiles.find((item) => item.id === defaultPlayerId) ?? playerProfiles[0]
  const author = pack && isRecord(pack.author) && typeof pack.author.name === "string" ? pack.author.name : null
  const rating = pack?.rating === "r15" ? "R15" : pack?.rating === "r18" ? "R18" : pack?.rating === "all" ? "全年齢" : null

  return {
    title: character.packTitle ?? character.name,
    premise: typeof plot?.premise === "string" ? plot.premise : character.description,
    tags: character.tags ?? [],
    characters: characters.length > 0 ? characters : [{ name: character.name, profile: character.description }],
    player: player
      ? { name: String(player.name), description: String(player.description) }
      : { name: "物語の中のあなた", description: "あなた自身の言葉と選択で、登場人物との関係を作っていきます。" },
    author,
    rating,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
