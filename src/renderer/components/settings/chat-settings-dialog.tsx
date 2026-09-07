import { AudioLines, Bot, Music2 } from "lucide-react"

import { ScenarioBgmPlayer } from "@/components/chat/scenario-bgm-player"
import { AIConnectionDialog, type ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import { VoiceSettingsSheet } from "@/components/settings/voice-settings-sheet"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Character } from "@/data/characters"
import type { ScenarioVoiceDesign, ScenarioVoiceSelection } from "@/lib/scenario-voice"
import type { TtsSettings } from "@/lib/tts"

export type ChatSettingsSection = "connection" | "voice" | "bgm"

type ChatSettingsDialogProps = {
  open: boolean
  section: ChatSettingsSection
  connection: ConnectionSettings
  isDesktop: boolean
  readAloud: boolean
  ttsSettings: TtsSettings
  character?: Character
  voiceDesign?: ScenarioVoiceDesign | null
  voiceSelection?: ScenarioVoiceSelection
  voiceSetupRequired?: boolean
  onSectionChange: (section: ChatSettingsSection) => void
  onOpenChange: (open: boolean) => void
  onConnectionConfirm: (settings: ConnectionSettings) => void
  onReadAloudChange: (checked: boolean) => void
  onTtsSettingsChange: (settings: TtsSettings) => void
  onVoiceConfirmed?: (selection: ScenarioVoiceSelection) => void
}

export function ChatSettingsDialog({
  open,
  section,
  connection,
  isDesktop,
  readAloud,
  ttsSettings,
  character,
  voiceDesign,
  voiceSelection,
  voiceSetupRequired = false,
  onSectionChange,
  onOpenChange,
  onConnectionConfirm,
  onReadAloudChange,
  onTtsSettingsChange,
  onVoiceConfirmed,
}: ChatSettingsDialogProps) {
  const title = section === "connection"
    ? "会話AIの設定"
    : section === "bgm"
      ? "BGM設定"
      : voiceSetupRequired ? "キャラクターの声を決める" : "音声設定"
  const description = section === "connection"
    ? "キャラクターとの会話に使うAIを選びます。"
    : section === "bgm"
      ? "会話中に流れる音楽と音量を変更します。"
      : "声での入力と、キャラクターの読み上げ音声を設定します。"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-[720px] flex-col gap-0 overflow-hidden p-0" data-testid="chat-settings-dialog">
        <div className="grid gap-4 border-b border-border/70 px-8 py-6 pr-20 max-md:px-5 max-md:py-4 max-md:pr-16">
          <div className={`grid gap-2 rounded-lg bg-surface-soft p-1 ${character ? "grid-cols-3" : "grid-cols-2"}`} role="group" aria-label="設定項目">
            <Button
              type="button"
              variant="ghost"
              className={section === "connection" ? "bg-background font-bold text-primary hover:bg-background hover:text-primary" : "bg-background text-muted-foreground hover:bg-background"}
              aria-pressed={section === "connection"}
              onClick={() => onSectionChange("connection")}
            >
              <Bot aria-hidden="true" />会話AI
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={section === "voice" ? "bg-background font-bold text-primary hover:bg-background hover:text-primary" : "bg-background text-muted-foreground hover:bg-background"}
              aria-pressed={section === "voice"}
              onClick={() => onSectionChange("voice")}
            >
              <AudioLines aria-hidden="true" />音声
            </Button>
            {character ? (
              <Button
                type="button"
                variant="ghost"
                className={section === "bgm" ? "bg-background font-bold text-primary hover:bg-background hover:text-primary" : "bg-background text-muted-foreground hover:bg-background"}
                aria-pressed={section === "bgm"}
                onClick={() => onSectionChange("bgm")}
              >
                <Music2 aria-hidden="true" />BGM
              </Button>
            ) : null}
          </div>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 max-md:px-5 max-md:py-4" hidden={section !== "connection"}>
          <AIConnectionDialog
            embedded
            open={open}
            initialConnection={connection.type}
            initialApiKey={connection.apiKey}
            initialEndpoint={connection.endpoint}
            initialModel={connection.model}
            isDesktop={isDesktop}
            onOpenChange={onOpenChange}
            onConfirm={onConnectionConfirm}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" hidden={section !== "voice"}>
          <VoiceSettingsSheet
            embedded
            open={open}
            active={section === "voice"}
            readAloud={readAloud}
            ttsSettings={ttsSettings}
            character={character}
            voiceDesign={voiceDesign}
            voiceSelection={voiceSelection}
            voiceSetupRequired={voiceSetupRequired}
            onReadAloudChange={onReadAloudChange}
            onTtsSettingsChange={onTtsSettingsChange}
            onVoiceConfirmed={onVoiceConfirmed}
            onOpenChange={onOpenChange}
          />
        </div>

        {character ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 max-md:px-5 max-md:py-4" hidden={section !== "bgm"}>
            <ScenarioBgmPlayer
              key={character.id}
              scenarioId={character.id}
              pack={character.pack}
              title={character.packTitle ?? character.name}
              mode="settings"
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
