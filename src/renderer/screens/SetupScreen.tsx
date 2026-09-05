import { Bot, Check, Monitor, Moon, Sun, Type, UserRound, Volume2 } from "lucide-react"

import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import { AppHeader } from "@/components/ui/app-header"
import { BirthYearField } from "@/components/ui/birth-year-field"
import { Button } from "@/components/ui/button"
import { GenrePicker } from "@/components/ui/genre-picker"
import { cn } from "@/lib/utils"
import { isIrodoriTtsSettings, type TtsSettings } from "@/lib/tts"
import type { OnboardingGender, OnboardingProfile } from "@/screens/OnboardingScreen"

export type AppearanceSettings = {
  textSize: "small" | "medium" | "large"
  theme: "light" | "dark"
}

type SetupScreenProps = {
  connection: ConnectionSettings
  ttsSettings: TtsSettings
  profile: OnboardingProfile
  genres: string[]
  appearance: AppearanceSettings
  onBack: () => void
  onOpenConnection: () => void
  onOpenVoice: () => void
  onProfileChange: (profile: OnboardingProfile) => void
  onAppearanceChange: (appearance: AppearanceSettings) => void
}

const GENDERS: Array<{ value: OnboardingGender; label: string }> = [
  { value: "woman", label: "女性" },
  { value: "man", label: "男性" },
  { value: "nonbinary", label: "その他" },
  { value: "prefer-not-to-say", label: "回答しない" },
]

export function SetupScreen({ connection, ttsSettings, profile, genres, appearance, onBack, onOpenConnection, onOpenVoice, onProfileChange, onAppearanceChange }: SetupScreenProps) {
  const availableGenres = [...new Set([...genres, ...profile.favoriteGenres])]
  const ttsLabel = ttsSettings.provider === "browser" ? "ブラウザ標準TTS" : ttsSettings.provider === "kokoro" ? "Kokoro" : ttsSettings.provider === "elevenlabs" ? "ElevenLabs" : isIrodoriTtsSettings(ttsSettings) ? "Irodori TTS" : "外部TTS"
  const ttsDescription = ttsSettings.provider === "browser" ? "APIキー不要" : ttsSettings.provider === "kokoro" ? "無料・端末内で生成" : ttsSettings.voice ? `${ttsSettings.model} / ${ttsSettings.voice}` : ttsSettings.provider === "elevenlabs" ? "Voice IDは未設定です" : "音声は未設定です"

  return (
    <main className="grid h-screen grid-rows-[88px_minmax(0,1fr)] overflow-hidden bg-background supports-[height:100dvh]:h-dvh max-md:grid-rows-[64px_minmax(0,1fr)]" data-testid="settings-screen">
      <AppHeader title="設定" onBack={onBack} />

      <div className="overflow-y-auto px-6 py-10 max-md:px-4 max-md:py-6">
        <div className="mx-auto grid w-full max-w-3xl gap-8 pb-10 max-md:gap-5">
          <header>
            <h2 className="text-3xl font-semibold tracking-[0.01em] max-md:text-2xl">アプリの設定</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">表示やプロフィール、会話AI、読み上げ音声を変更できます。</p>
          </header>

          <section className="rounded-lg border border-border bg-surface p-7 shadow-soft max-md:p-5" aria-labelledby="appearance-settings">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-surface-accent text-primary" aria-hidden="true"><Type /></span>
              <div>
                <h2 id="appearance-settings" className="text-xl font-semibold">表示</h2>
                <p className="mt-1 text-sm text-muted-foreground">読みやすい文字サイズと画面の明るさを選べます。</p>
              </div>
            </div>

            <div className="mt-6 grid gap-6">
              <fieldset>
                <legend className="text-sm font-semibold">文字サイズ</legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {([ ["small", "小さめ"], ["medium", "標準"], ["large", "大きめ"] ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={appearance.textSize === value}
                      className={cn("flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm transition-colors hover:border-primary/50", appearance.textSize === value && "border-primary font-semibold text-primary")}
                      onClick={() => onAppearanceChange({ ...appearance, textSize: value })}
                    >
                      {appearance.textSize === value ? <Check className="size-4" aria-hidden="true" /> : null}
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold">テーマ</legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {([ ["light", "ライト", <Sun key="sun" />], ["dark", "ダーク", <Moon key="moon" />] ] as const).map(([value, label, icon]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={appearance.theme === value}
                      className={cn("flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm transition-colors hover:border-primary/50 [&_svg]:size-5", appearance.theme === value && "border-primary font-semibold text-primary")}
                      onClick={() => onAppearanceChange({ ...appearance, theme: value })}
                    >
                      {icon}{label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-7 shadow-soft max-md:p-5" aria-labelledby="profile-settings">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-surface-accent text-primary" aria-hidden="true"><UserRound /></span>
              <div>
                <h2 id="profile-settings" className="text-xl font-semibold">ユーザー情報</h2>
                <p className="mt-1 text-sm text-muted-foreground">おすすめする物語の参考にします。</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <label className="grid gap-2 text-sm font-semibold">
                性別
                <select className="h-12 rounded-md border border-input bg-surface px-4 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/20" value={profile.gender} onChange={(event) => onProfileChange({ ...profile, gender: event.target.value as OnboardingGender })}>
                  {GENDERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <BirthYearField
                id="settings-birth-year"
                value={profile.birthYear}
                onChange={(birthYear) => onProfileChange({ ...profile, birthYear })}
              />
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-semibold">好きなジャンル</legend>
                <p className="mt-1 text-xs font-normal text-muted-foreground">複数選べます。1つ以上選んでください。</p>
                <div className="mt-3">
                  <GenrePicker
                    genres={availableGenres}
                    value={profile.favoriteGenres}
                    onChange={(favoriteGenres) => {
                      if (favoriteGenres.length > 0) onProfileChange({ ...profile, favoriteGenres })
                    }}
                  />
                </div>
              </fieldset>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">この端末にのみ保存されます。</p>
          </section>

          <section className="rounded-lg border border-border bg-surface p-7 shadow-soft max-md:p-5" aria-labelledby="ai-settings">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-surface-accent text-primary" aria-hidden="true"><Bot /></span>
              <div>
                <h2 id="ai-settings" className="text-xl font-semibold">AIの接続</h2>
                <p className="mt-1 text-sm text-muted-foreground">キャラクターとの会話に使うAIを設定します。</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-md border border-border bg-background p-4 max-sm:flex-col max-sm:items-start">
              <div className="flex items-center gap-3">
                <span className="text-primary" aria-hidden="true">{connection.type === "local" ? <Monitor /> : <Bot />}</span>
                <div>
                  <p className="font-semibold">{connection.type === "builtin" ? "内蔵AI" : connection.type === "local" ? "LM Studio / Ollama" : "オンラインAI"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{connection.type === "online" && !connection.apiKey ? "APIキーは未設定です" : connection.model || "モデルを接続時に確認します"}</p>
                </div>
              </div>
              <Button variant="outline" onClick={onOpenConnection}>接続設定</Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-7 shadow-soft max-md:p-5" aria-labelledby="tts-settings">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-surface-accent text-primary" aria-hidden="true"><Volume2 /></span>
              <div>
                <h2 id="tts-settings" className="text-xl font-semibold">読み上げの音声</h2>
                <p className="mt-1 text-sm text-muted-foreground">キャラクターの返答を読む音声を設定します。</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-md border border-border bg-background p-4 max-sm:flex-col max-sm:items-start">
              <div className="flex items-center gap-3">
                <span className="text-primary" aria-hidden="true"><Volume2 /></span>
                <div>
                  <p className="font-semibold">{ttsLabel}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ttsDescription}</p>
                </div>
              </div>
              <Button variant="outline" onClick={onOpenVoice}>音声設定</Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
