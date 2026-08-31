import { useMemo, useState } from "react"

import { ConversationHistorySheet } from "@/components/chat/conversation-history-sheet"
import { ImportChatPackDialog } from "@/components/library/import-chat-pack-dialog"
import { AIConnectionDialog, type ConnectionSettings, type ConnectionType } from "@/components/settings/ai-connection-dialog"
import { VoiceSettingsSheet } from "@/components/settings/voice-settings-sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import { characters, type Character } from "@/data/characters"
import type { LoadedChatPack } from "@/lib/chat-pack"
import { HomeScreen, type HomeTab } from "@/screens/HomeScreen"
import { SetupScreen } from "@/screens/SetupScreen"
import { TalkScreen } from "@/screens/TalkScreen"
import { TechDocsScreen } from "@/screens/TechDocsScreen"

type Screen = "setup" | "home" | "talk" | "docs"
type Overlay = "connection" | "import" | "voice" | "history" | null

function readInitialState() {
  const params = new URLSearchParams(window.location.search)
  const requestedScreen = params.get("screen")
  const requestedOverlay = params.get("overlay")
  const docsPath = window.location.pathname === "/docs" || window.location.pathname === "/docs/"
  const screen: Screen = docsPath ? "docs" : requestedScreen === "setup" || requestedScreen === "talk" || requestedScreen === "docs" ? requestedScreen : "home"
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
  const [homeTab, setHomeTab] = useState<HomeTab>("home")
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
  const showScreen = (nextScreen: Screen) => {
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      window.history.replaceState({}, "", nextScreen === "docs" ? "/docs/" : "/")
    }
    setScreen(nextScreen)
  }
  const openConnection = (connection: ConnectionType = connectionSettings.type) => {
    setConnectionType(connection)
    openOverlay("connection")
  }
  const setOverlayOpen = (target: Exclude<Overlay, null>, open: boolean) => {
    setOverlay((current) => (open ? target : current === target ? null : current))
  }

  const talkWith = (character: Character, source: HomeTab = "home") => {
    setSelectedCharacter(character)
    setActiveConversationId("today")
    setHomeTab(source)
    setScreen("talk")
  }

  const toCharacter = (loaded: LoadedChatPack): Character => {
    const primary = loaded.pack.plot.characters[0]
    const names = new Map(loaded.pack.plot.characters.map((character) => [character.id, character.name]))
    const resolveText = (text: string) => text.replaceAll("{{user}}さん", "あなた").replaceAll("{{user}}", "あなた")
    const opening = loaded.pack.plot.opening.map((event) => {
      const image = event.image ? loaded.assets[event.image] : undefined
      if (event.type === "narration") return { role: "narration" as const, text: resolveText(event.text), image }
      if (event.speaker === "user") return { role: "user" as const, text: resolveText(event.text), image }
      const dialogue = resolveText(event.text)
      return { role: "character" as const, text: dialogue, speakerName: names.get(event.speaker) ?? event.speaker, image }
    })
    const lastMessage = [...opening].reverse().find((event) => event.role === "character")?.text ?? loaded.pack.summary

    return {
      id: loaded.pack.id,
      name: primary.name,
      packTitle: loaded.pack.title,
      tags: loaded.pack.discovery.tags,
      conversationLabel: `${loaded.pack.plot.characters.length}人と会話`,
      description: loaded.pack.discovery.description ?? loaded.pack.summary,
      lastMessage,
      lastActive: "たった今",
      image: loaded.assets[loaded.pack.discovery.covers[0]],
      stageImage: loaded.assets[primary.image],
      opening,
    }
  }

  const addImportedPack = (loaded: LoadedChatPack) => {
    const imported = toCharacter(loaded)
    const existing = library.find((character) => character.id === imported.id)
    if (existing) return null
    setLibrary((current) => [...current, imported])
    return imported
  }

  const importToLibrary = (loaded: LoadedChatPack) => {
    if (!addImportedPack(loaded)) return "同じIDのチャットパックは追加済みです。更新機能は今後対応します。"
    setOverlay(null)
  }

  const importAndTalk = (loaded: LoadedChatPack) => {
    const imported = addImportedPack(loaded)
    if (!imported) return "同じIDのチャットパックは追加済みです。既存のパックをホームから開いてください。"
    setSelectedCharacter(imported)
    setActiveConversationId("today")
    setHomeTab("home")
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
          activeTab={homeTab}
          onTabChange={setHomeTab}
          onSelectCharacter={talkWith}
          onAddPack={() => openOverlay("import")}
          onOpenDocs={() => showScreen("docs")}
          onOpenSettings={() => openConnection()}
        />
      ) : null}

      {screen === "talk" ? (
        <TalkScreen
          character={selectedCharacter}
          conversationId={activeConversationId}
          onBack={() => showScreen("home")}
          onOpenConnection={() => openConnection()}
          onOpenVoice={() => openOverlay("voice")}
          onOpenHistory={() => openOverlay("history")}
        />
      ) : null}

      {screen === "docs" ? (
        <TechDocsScreen
          onBack={() => showScreen("home")}
          onTryDemo={() => openOverlay("import")}
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
      <ImportChatPackDialog
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
        key={selectedCharacter.id}
        open={overlay === "history"}
        characterName={selectedCharacter.name}
        importedPack={Boolean(selectedCharacter.opening)}
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
