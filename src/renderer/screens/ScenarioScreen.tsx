import { ArrowLeft, BookOpenText, UserRound, UsersRound } from "lucide-react"

import { Brand } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import type { Character } from "@/data/characters"
import { readScenarioContext } from "@/lib/scenario-context"

export function ScenarioScreen({
  character,
  onBack,
  onStart,
}: {
  character: Character
  onBack: () => void
  onStart: () => void
}) {
  const preview = readScenarioContext(character)

  return (
    <main className="grid h-screen grid-rows-[80px_minmax(0,1fr)_auto] overflow-hidden bg-background max-md:h-dvh max-md:grid-rows-[64px_minmax(0,1fr)_auto]" data-testid="scenario-screen">
      <ScenarioHeader onBack={onBack} />

      <div className="grid min-h-0 grid-cols-[clamp(320px,34vw,440px)_minmax(0,1fr)] overflow-hidden max-md:block max-md:overflow-y-auto" data-testid="scenario-preview-scroll">
        <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden border-r border-border bg-surface-soft max-md:block max-md:overflow-visible max-md:border-r-0 max-md:border-b">
          <div className="relative mx-auto aspect-[9/16] h-full max-h-full w-auto max-w-full overflow-hidden bg-surface-soft max-md:h-auto max-md:w-full" data-testid="scenario-preview-cover-frame">
            {character.image ? (
              <img src={character.image} alt={`${preview.title}の物語カバー`} className="size-full object-contain object-center" />
            ) : (
              <div className="grid size-full place-items-center bg-surface-accent text-8xl font-semibold text-primary/35" role="img" aria-label="カバー画像はありません">
                {character.name.slice(0, 1)}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/55 to-transparent px-7 pt-24 pb-7 max-md:px-5 max-md:pt-20 max-md:pb-5" data-testid="scenario-preview-title-overlay">
              <h1 className="text-2xl leading-snug font-semibold text-balance text-white max-md:text-[22px]">{preview.title}</h1>
            </div>
          </div>
          {preview.tags.length > 0 ? (
            <div className="border-t border-border bg-surface px-7 py-5 max-md:px-5 max-md:py-4" data-testid="scenario-preview-metadata">
              <div className="flex flex-wrap gap-2">
                {preview.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">#{tag}</span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="min-h-0 min-w-0 overflow-y-auto px-[8%] py-10 max-md:overflow-visible max-md:px-5 max-md:py-7" data-testid="scenario-preview-details">
          <div className="mx-auto max-w-[760px]">
            <p className="text-sm font-semibold text-primary">これから、あなたが入る物語</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">状況と登場人物を確認してから、物語を始められます。</p>

            <div className="mt-8 grid gap-7">
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
                      <span className="grid size-11 place-items-center rounded-full bg-surface-accent text-base font-semibold text-primary" aria-hidden="true">{item.name.slice(0, 1)}</span>
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
              <p className="mt-8 border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
                {[preview.author ? `作者: ${preview.author}` : null, preview.rating].filter(Boolean).join(" ・ ")}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="border-t border-border bg-surface px-8 py-4 max-md:px-5 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]" data-testid="scenario-preview-actions">
        <div className="mx-auto flex max-w-[760px] flex-row-reverse items-center gap-3 max-md:flex-col">
          <Button size="lg" className="min-w-64 max-md:w-full" onClick={onStart}>この物語をはじめる</Button>
          <Button variant="ghost" className="max-md:w-full" onClick={onBack}>別のシナリオを見る</Button>
        </div>
      </div>
    </main>
  )
}

export function ScenarioRouteState({ title, message, onBack }: { title: string; message: string; onBack: () => void }) {
  return (
    <main className="grid h-screen grid-rows-[80px_minmax(0,1fr)] bg-background max-md:h-dvh max-md:grid-rows-[64px_minmax(0,1fr)]">
      <ScenarioHeader onBack={onBack} />
      <section className="grid place-items-center px-5 text-center" role="status" aria-live="polite">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
          <Button className="mt-6" onClick={onBack}>ホームへ戻る</Button>
        </div>
      </section>
    </main>
  )
}

function ScenarioHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="flex h-full items-center border-b border-border/70 bg-background/96 px-6 max-md:px-3">
      <IconButton label="戻る" className="shrink-0" onClick={onBack}><ArrowLeft /></IconButton>
      <Brand compact className="ml-3 max-md:[&_span]:text-lg" />
    </header>
  )
}

function PreviewSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      <span className="mt-0.5 text-primary-bright [&_svg]:size-5" aria-hidden="true">{icon}</span>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="mt-2 text-[15px] leading-7 text-muted-foreground">{children}</div>
      </div>
    </section>
  )
}
