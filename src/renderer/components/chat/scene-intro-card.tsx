import { BookOpenText, UserRound, UsersRound } from "lucide-react"

import type { ScenarioContext } from "@/lib/scenario-context"

export function SceneIntroCard({ context, visibleSections = 4 }: { context: ScenarioContext; visibleSections?: number }) {
  if (visibleSections === 0) return null

  return (
    <article className="animate-in overflow-hidden rounded-lg border border-border/70 bg-surface shadow-soft fade-in slide-in-from-bottom-1 duration-300 max-md:rounded-2xl max-md:border-white/35 max-md:bg-black/58 max-md:text-white max-md:shadow-overlay max-md:backdrop-blur-md">
      <header className="border-b border-border/65 px-6 py-5 max-md:border-white/20 max-md:px-4 max-md:py-4">
        <p className="text-xs font-semibold text-primary max-md:text-[#ffb17a]">物語のはじまり</p>
        <h2 className="mt-1 text-xl font-semibold leading-8 text-foreground max-md:text-lg max-md:leading-7 max-md:text-white">{context.title}</h2>
      </header>

      <div className="grid gap-5 px-6 py-5 max-md:gap-4 max-md:px-4 max-md:py-4">
        {visibleSections >= 2 ? (
          <IntroSection icon={<UserRound />} title="あなた">
            <p className="font-semibold text-foreground max-md:text-white">{context.player.name}</p>
            <p className="mt-1">{context.player.description}</p>
          </IntroSection>
        ) : null}

        {visibleSections >= 3 ? (
          <IntroSection icon={<BookOpenText />} title="いまの状況">
            <p>{context.summary}</p>
          </IntroSection>
        ) : null}

        {visibleSections >= 4 ? (
          <IntroSection icon={<UsersRound />} title="登場人物">
            <div className="grid gap-3">
              {context.characters.map((character) => (
                <div key={character.name}>
                  <p className="line-clamp-2 font-semibold text-foreground max-md:text-white">{character.name} — {character.profile}</p>
                </div>
              ))}
            </div>
          </IntroSection>
        ) : null}
      </div>
    </article>
  )
}

function IntroSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="animate-in grid grid-cols-[24px_minmax(0,1fr)] gap-3 fade-in slide-in-from-bottom-1 duration-300">
      <span className="mt-0.5 text-primary-bright max-md:text-[#ffb17a] [&_svg]:size-5" aria-hidden="true">{icon}</span>
      <div>
        <h3 className="text-sm font-semibold text-foreground max-md:text-white">{title}</h3>
        <div className="mt-1.5 text-[15px] leading-7 text-muted-foreground max-md:text-sm max-md:leading-6 max-md:text-white/88">{children}</div>
      </div>
    </section>
  )
}
