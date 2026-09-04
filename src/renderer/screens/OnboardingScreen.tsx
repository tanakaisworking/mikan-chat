import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"

import { Brand } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { GenrePicker } from "@/components/ui/genre-picker"
import { cn } from "@/lib/utils"

export type OnboardingGender = "woman" | "man" | "nonbinary" | "prefer-not-to-say"

export type OnboardingProfile = {
  gender: OnboardingGender
  birthYear: number
  favoriteGenres: string[]
}

type OnboardingScreenProps = {
  genres: string[]
  genresLoading: boolean
  genresError?: string | null
  onRetryGenres?: () => void
  onComplete: (profile: OnboardingProfile) => void
}

type Step = "gender" | "birthYear" | "genre"

const CURRENT_YEAR = new Date().getFullYear()
const BIRTH_YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, index) => CURRENT_YEAR - index)
const STEPS: Step[] = ["gender", "birthYear", "genre"]
const GENDER_OPTIONS: Array<{ value: OnboardingGender; label: string; description: string }> = [
  { value: "woman", label: "女性", description: "女性として楽しみたい" },
  { value: "man", label: "男性", description: "男性として楽しみたい" },
  { value: "nonbinary", label: "その他", description: "男女のどちらにも限定しない" },
  { value: "prefer-not-to-say", label: "回答しない", description: "性別を設定せずに進む" },
]

export function OnboardingScreen({ genres, genresLoading, genresError, onRetryGenres, onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState<Step>("gender")
  const [gender, setGender] = useState<OnboardingGender | null>(null)
  const [birthYear, setBirthYear] = useState<number | null>(null)
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([])
  const questionRef = useRef<HTMLHeadingElement>(null)
  const stepIndex = STEPS.indexOf(step)

  useEffect(() => {
    questionRef.current?.focus()
  }, [step])

  const goBack = () => {
    if (step === "genre") setStep("birthYear")
    if (step === "birthYear") setStep("gender")
  }

  return (
    <main className="relative h-screen overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background px-5 py-10 supports-[height:100dvh]:h-dvh max-md:pt-[calc(1.75rem+env(safe-area-inset-top))] max-md:pb-[calc(1.75rem+env(safe-area-inset-bottom))]" data-testid="onboarding-screen">
      <div className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full border-[40px] border-surface-accent/70" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-12 -left-16 size-44 rounded-full bg-surface-soft" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-[760px] flex-col justify-center max-md:min-h-[calc(100dvh-56px)]">
        <header className="text-center">
          <div className="inline-flex items-center gap-3 text-primary">
            <Brand compact />
            <span className="text-xl font-semibold tracking-[0.02em]">Mikan Chat</span>
          </div>
          <h1 className="mt-6 text-5xl leading-[1.28] font-semibold tracking-[-0.025em] text-balance max-md:mt-5 max-md:text-3xl">
            未完成の物語を、<br className="max-sm:hidden" />AIチャットで楽しもう。
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground max-md:text-sm max-md:leading-6">
            あなたに合う物語を見つけるために、最初に3つだけ教えてください。
          </p>
        </header>

        <section className="mt-10 rounded-lg border border-border bg-surface px-10 py-8 shadow-overlay max-md:mt-7 max-md:px-5 max-md:py-6" aria-labelledby="onboarding-question">
          <div className="flex items-center justify-between gap-4">
            <ol className="flex items-center gap-2" aria-label="オンボーディングの進み具合">
              {STEPS.map((item, index) => (
                <li key={item}>
                  <span
                    className={index <= stepIndex ? "block h-1.5 w-12 rounded-full bg-primary max-sm:w-9" : "block h-1.5 w-12 rounded-full bg-border max-sm:w-9"}
                    aria-current={index === stepIndex ? "step" : undefined}
                  />
                  <span className="sr-only">{index + 1} / {STEPS.length}</span>
                </li>
              ))}
            </ol>
            <span className="text-sm font-semibold text-muted-foreground">{stepIndex + 1} / {STEPS.length}</span>
          </div>

          <div key={step} className="mt-7 animate-in fade-in slide-in-from-right-2 duration-200">
            {step !== "gender" ? (
              <Button variant="ghost" size="sm" className="-ml-3 mb-3 text-muted-foreground" onClick={goBack}>
                <ArrowLeft aria-hidden="true" />戻る
              </Button>
            ) : null}

            {step === "gender" ? (
              <div>
                <p className="text-sm font-semibold text-primary">あなたについて</p>
                <h2 ref={questionRef} id="onboarding-question" tabIndex={-1} className="mt-2 text-2xl leading-snug font-semibold outline-none max-md:text-xl">性別を教えてください</h2>
                <div className="mt-6 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                  {GENDER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={gender === option.value}
                      className={cn(
                        "group flex min-h-20 items-center justify-between gap-4 rounded-md border px-5 py-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 ease-mikan hover:border-primary/55 hover:bg-surface-soft active:translate-y-px",
                        gender === option.value ? "border-primary bg-surface-soft shadow-soft" : "border-border bg-background",
                      )}
                      onClick={() => {
                        setGender(option.value)
                        setStep("birthYear")
                      }}
                    >
                      <span>
                        <span className="block font-semibold">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {step === "birthYear" ? (
              <div>
                <p className="text-sm font-semibold text-primary">年代に合う物語のために</p>
                <h2 ref={questionRef} id="onboarding-question" tabIndex={-1} className="mt-2 text-2xl leading-snug font-semibold outline-none max-md:text-xl">生まれた年を教えてください</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">選ぶと次の質問へ進みます。</p>
                <label className="mt-7 block" htmlFor="onboarding-birth-year">
                  <span className="mb-2 block text-sm font-semibold">生年</span>
                  <select
                    id="onboarding-birth-year"
                    value={birthYear ?? ""}
                    className="h-13 w-full rounded-md border border-input bg-background px-4 text-base outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-ring/20"
                    onChange={(event) => {
                      const selectedYear = Number(event.target.value)
                      if (!Number.isInteger(selectedYear)) return
                      setBirthYear(selectedYear)
                      setStep("genre")
                    }}
                  >
                    <option value="" disabled>生年を選ぶ</option>
                    {BIRTH_YEARS.map((year) => <option key={year} value={year}>{year}年</option>)}
                  </select>
                </label>
              </div>
            ) : null}

            {step === "genre" ? (
              <div>
                <p className="text-sm font-semibold text-primary">最後の質問</p>
                <h2 ref={questionRef} id="onboarding-question" tabIndex={-1} className="mt-2 text-2xl leading-snug font-semibold outline-none max-md:text-xl">好きなジャンルを選んでください</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">複数選べます。現在公開されているシナリオのタグから選んでください。</p>

                {genresLoading ? <p className="py-10 text-center text-sm text-muted-foreground" role="status">ジャンルを読み込んでいます…</p> : null}
                {!genresLoading && genresError ? (
                  <div className="mt-6 rounded-md border border-border bg-surface-soft p-5 text-center" role="alert">
                    <p className="text-sm">ジャンルを読み込めませんでした。</p>
                    {onRetryGenres ? <Button variant="outline" size="sm" className="mt-4" onClick={onRetryGenres}>もう一度試す</Button> : null}
                  </div>
                ) : null}
                {!genresLoading && !genresError && genres.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground" role="status">選べるジャンルがまだありません。</p>
                ) : null}
                {!genresLoading && !genresError && genres.length > 0 ? (
                  <div className="mt-6 grid gap-5">
                    <GenrePicker genres={genres} value={favoriteGenres} onChange={setFavoriteGenres} />
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={!gender || !birthYear || favoriteGenres.length === 0}
                      onClick={() => {
                        if (!gender || !birthYear || favoriteGenres.length === 0) return
                        onComplete({ gender, birthYear, favoriteGenres })
                      }}
                    >
                      はじめる
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">選択内容はこのブラウザにのみ保存されます。</p>
      </div>
    </main>
  )
}
