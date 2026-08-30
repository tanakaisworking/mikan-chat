import { useMemo, useState } from "react"

import { ConversationHistorySheet } from "@/components/chat/conversation-history-sheet"
import { ImportCharacterDialog } from "@/components/library/import-character-dialog"
import { AIConnectionDialog, type ConnectionSettings, type ConnectionType } from "@/components/settings/ai-connection-dialog"
import { VoiceSettingsSheet } from "@/components/settings/voice-settings-sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import { assets, characters, type Character } from "@/data/characters"
import { HomeScreen } from "@/screens/HomeScreen"
import { SetupScreen } from "@/screens/SetupScreen"
import { TalkScreen } from "@/screens/TalkScreen"

type Screen = "setup" | "home" | "talk"
type Overlay = "connection" | "import" | "voice" | "history" | null

const importedCharacter: Character = {
  id: "shizuku",
  name: "雫",
  description: "閉店後の喫茶店で出会った、少し不思議な常連客。",
  lastMessage: "雨の音、落ち着きますね。",
  lastActive: "たった今",
  image: assets.shizukuStage,
}

function readInitialState() {
  const params = new URLSearchParams(window.location.search)
  const requestedScreen = params.get("screen")
  const requestedOverlay = params.get("overlay")
  const screen: Screen = requestedScreen === "setup" || requestedScreen === "talk" ? requestedScreen : "home"
  const overlay: Overlay =
    requestedOverlay === "connection" ||
    requestedOverlay === "import" ||
    requestedOverlay === "voice" ||
    requestedOverlay === "history"
      ? requestedOverlay
      : null

  return { screen, overlay }
}

export function App() {
  const initialState = useMemo(readInitialState, [])
  const [screen, setScreen] = useState<Screen>(initialState.screen)
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(characters[0])
  const [library, setLibrary] = useState<Character[]>(characters)
  const [overlay, setOverlay] = useState<Overlay>(initialState.overlay)
  const [activeConversationId, setActiveConversationId] = useState("today")
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>({
    type: "local",
    apiKey: "",
    endpoint: "http://127.0.0.1:11434",
  })
  const [connectionType, setConnectionType] = useState<ConnectionType>(connectionSettings.type)

  const openOverlay = (nextOverlay: Exclude<Overlay, null>) => setOverlay(nextOverlay)
  const openConnection = (connection: ConnectionType = connectionSettings.type) => {
    setConnectionType(connection)
    openOverlay("connection")
  }
  const setOverlayOpen = (target: Exclude<Overlay, null>, open: boolean) => {
    setOverlay((current) => (open ? target : current === target ? null : current))
  }

  const talkWith = (character: Character) => {
    setSelectedCharacter(character)
    setActiveConversationId("today")
    setScreen("talk")
  }

  const addImportedCharacter = () => {
    setLibrary((current) => current.some((character) => character.id === importedCharacter.id) ? current : [...current, importedCharacter])
  }

  const importToLibrary = () => {
    addImportedCharacter()
    setOverlay(null)
  }

  const importAndTalk = () => {
    addImportedCharacter()
    setSelectedCharacter(importedCharacter)
    setOverlay(null)
    setScreen("talk")
  }

  return (
    <TooltipProvider>
      {screen === "setup" ? (
        <SetupScreen
          onContinue={() => setScreen("home")}
          onOpenConnection={openConnection}
        />
      ) : null}

      {screen === "home" ? (
        <HomeScreen
          characters={library}
          onSelectCharacter={talkWith}
          onAddCharacter={() => openOverlay("import")}
          onOpenSettings={() => openConnection()}
        />
      ) : null}

      {screen === "talk" ? (
        <TalkScreen
          character={selectedCharacter}
          conversationId={activeConversationId}
          onBack={() => setScreen("home")}
          onOpenConnection={() => openConnection()}
          onOpenVoice={() => openOverlay("voice")}
          onOpenHistory={() => openOverlay("history")}
        />
      ) : null}

      <AIConnectionDialog
        open={overlay === "connection"}
        initialConnection={connectionType}
        initialApiKey={connectionSettings.apiKey}
        initialEndpoint={connectionSettings.endpoint}
        onOpenChange={(open) => {
          if (!open) setConnectionType(connectionSettings.type)
          setOverlayOpen("connection", open)
        }}
        onConfirm={(settings) => {
          setConnectionSettings(settings)
          setConnectionType(settings.type)
          setOverlay(null)
          if (screen === "setup") setScreen("home")
        }}
      />
      <ImportCharacterDialog
        open={overlay === "import"}
        onOpenChange={(open) => setOverlayOpen("import", open)}
        onAddToLibrary={importToLibrary}
        onAddAndTalk={importAndTalk}
      />
      <VoiceSettingsSheet
        open={overlay === "voice"}
        onOpenChange={(open) => setOverlayOpen("voice", open)}
      />
      <ConversationHistorySheet
        open={overlay === "history"}
        characterName={selectedCharacter.name}
        activeConversationId={activeConversationId}
        onOpenChange={(open) => setOverlayOpen("history", open)}
        onSelectConversation={(conversationId) => {
          setActiveConversationId(conversationId)
          setOverlay(null)
        }}
      />
    </TooltipProvider>
  )
}
