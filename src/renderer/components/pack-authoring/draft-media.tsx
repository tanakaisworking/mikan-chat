import { ScenarioBgmPlayer } from "@/components/chat/scenario-bgm-player"
import { SectionHeading } from "@/components/ui/section-heading"
import { AUTHORING_DRAFT_SCENARIO_ID } from "@/lib/pack-authoring/types"

export function DraftMedia() {
  return (
    <section className="grid gap-4" aria-label="BGM">
      <SectionHeading>BGM</SectionHeading>
      <p className="-mt-2 text-sm leading-relaxed text-muted-foreground">
        同梱曲・URL・手持ち音声から選びます。選択はエクスポートにそのまま含まれます。
      </p>
      <ScenarioBgmPlayer
        key={AUTHORING_DRAFT_SCENARIO_ID}
        scenarioId={AUTHORING_DRAFT_SCENARIO_ID}
        title="作成中のシナリオ"
        mode="settings"
      />
    </section>
  )
}
