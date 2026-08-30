import { ChevronRight, Cloud, MonitorCog } from "lucide-react"

import { assets } from "@/data/characters"
import { Brand } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { ChoiceCard } from "@/components/ui/choice-card"
import type { ConnectionType } from "@/components/settings/ai-connection-dialog"

type SetupScreenProps = {
  onContinue: () => void
  onOpenConnection: (connection: ConnectionType) => void
}

export function SetupScreen({ onContinue, onOpenConnection }: SetupScreenProps) {
  return (
    <main className="grid h-screen grid-cols-[46.5%_53.5%] overflow-hidden bg-background max-md:block max-md:h-dvh max-md:overflow-y-auto" data-testid="setup-screen">
      <section className="relative overflow-hidden border-r border-border/70 bg-surface-soft max-md:h-[42dvh] max-md:min-h-[300px] max-md:border-r-0 max-md:border-b">
        <img
          src={assets.aoiWelcome}
          alt="初期設定を案内する葵"
          className="absolute inset-0 size-full object-cover object-[50%_36%]"
        />
        <div className="absolute inset-x-0 top-0 h-36 bg-linear-to-b from-background/90 to-transparent" />
        <Brand className="absolute top-8 left-9 max-md:top-4 max-md:left-4 max-md:gap-2 max-md:[&_img]:size-10 max-md:[&_span]:text-xl" />
        <div className="absolute right-9 bottom-9 left-9 min-h-56 rounded-lg border border-white/80 bg-background/92 px-10 py-9 shadow-overlay max-[1100px]:min-h-0 max-[1100px]:px-7 max-[1100px]:py-6 max-md:right-4 max-md:bottom-4 max-md:left-4 max-md:px-5 max-md:py-4">
          <p className="text-3xl leading-relaxed font-semibold text-primary-bright max-[1100px]:text-2xl max-md:text-xl">
            AIとつないで、
            <br />
            会話をはじめよう
          </p>
          <p className="mt-2 text-base text-foreground max-md:text-sm">難しい設定は必要ありません。</p>
        </div>
      </section>

      <section className="flex min-w-0 flex-col px-[9%] py-10 max-md:px-5 max-md:py-6">
        <ol className="ml-auto flex items-center gap-5 text-sm text-muted-foreground max-md:gap-2" aria-label="初期設定の進み具合">
          {[1, 2, 3].map((step) => (
            <li key={step} className="flex items-center gap-5">
              <span
                className={
                  step === 1
                    ? "grid size-10 place-items-center rounded-full border-2 border-primary-bright bg-surface text-base font-semibold text-primary-bright"
                    : "grid size-10 place-items-center rounded-full border border-border bg-surface text-base"
                }
                aria-current={step === 1 ? "step" : undefined}
              >
                {step}
              </span>
              {step < 3 ? <span className="h-px w-20 bg-border max-md:w-8" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>

        <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center">
          <div className="mb-12 flex items-center gap-4 max-[1100px]:mb-8 max-md:mt-7 max-md:mb-6">
            <Brand compact />
            <h1 className="text-[40px] leading-tight font-semibold tracking-[0.015em] max-[1100px]:text-3xl max-md:text-3xl">はじめかた</h1>
          </div>

          <div className="grid gap-5">
            <ChoiceCard
              size="setup"
              icon={<MonitorCog />}
              title="このPCのAIを使う"
              description="インストール済みのAIを自動で探します"
              trailing={<ChevronRight className="size-8 text-primary-bright transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
              onClick={() => onOpenConnection("local")}
            />
            <ChoiceCard
              size="setup"
              icon={<Cloud />}
              title="AIサービスに接続する"
              description="APIキーを使ってオンラインAIにつなぎます"
              trailing={<ChevronRight className="size-8 text-primary-bright transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
              onClick={() => onOpenConnection("online")}
            />
          </div>

          <Button variant="link" className="mx-auto mt-8 text-muted-foreground" onClick={onContinue}>
            あとで設定する
          </Button>
        </div>
      </section>
    </main>
  )
}
