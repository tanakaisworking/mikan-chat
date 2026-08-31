import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ConversationHistorySheet } from "@/components/chat/conversation-history-sheet"
import { ImportChatPackDialog } from "@/components/library/import-chat-pack-dialog"
import { AIConnectionDialog, type ConnectionSettings, type ConnectionType } from "@/components/settings/ai-connection-dialog"
import { VoiceSettingsSheet } from "@/components/settings/voice-settings-sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import { characters, type Character } from "@/data/characters"
import { loadScenarios } from "@/data/scenario-source"
import { GOOGLE_AI_STUDIO_ENDPOINT, GOOGLE_AI_STUDIO_MODEL, getConnectionError } from "@/lib/ai-chat"
import type { LoadedChatPack } from "@/lib/chat-pack"
import { resolveChatPackText } from "@/lib/chat-pack-template"
import { HomeScreen, type HomeTab } from "@/screens/HomeScreen"
import { SetupScreen } from "@/screens/SetupScreen"
import { TalkScreen } from "@/screens/TalkScreen"
import { TechDocsScreen } from "@/screens/TechDocsScreen"

type Screen = "setup" | "home" | "talk" | "docs"
type Overlay = "connection" | "import" | "voice" | "history" | null
const CONNECTION_STORAGE_KEY = "mikan-chat.connection.v1"

function createDefaultConnection(): ConnectionSettings {
  return {
    type: window.mikan ? "local" : "online",
    apiKey: "",
    endpoint: window.mikan ? "http://127.0.0.1:11434/v1" : GOOGLE_AI_STUDIO_ENDPOINT,
    model: window.mikan ? "" : GOOGLE_AI_STUDIO_MODEL,
  }
}

function readInitialConnection() {
  const fallback = createDefaultConnection()
  if (window.mikan) return fallback
  try {
    const saved = window.localStorage.getItem(CONNECTION_STORAGE_KEY)
    const legacy = saved === null ? window.sessionStorage.getItem(CONNECTION_STORAGE_KEY) : null
    const stored = JSON.parse(saved ?? legacy ?? "null") as unknown
    if (!stored || typeof stored !== "object") return fallback
    const candidate = stored as Partial<ConnectionSettings>
    if (candidate.type !== "online" || typeof candidate.apiKey !== "string" || typeof candidate.endpoint !== "string" || typeof candidate.model !== "string") return fallback
    const connection: ConnectionSettings = { type: candidate.type, apiKey: candidate.apiKey, endpoint: candidate.endpoint, model: candidate.model }
    if (getConnectionError(connection)) return fallback
    if (legacy !== null) {
      window.localStorage.setItem(CONNECTION_STORAGE_KEY, legacy)
      window.sessionStorage.removeItem(CONNECTION_STORAGE_KEY)
    }
    return connection
  } catch {
    return fallback
  }
}

function persistConnection(connection: ConnectionSettings) {
  if (window.mikan) return
  try {
    window.localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection))
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

function readInitialState() {
  const params = new URLSearchParams(window.location.search)
  const requestedScreen = params.get("screen")
  const requestedOverlay = params.get("overlay")
  const docsPath = window.location.pathname === "/docs" || window.location.pathname === "/docs/"
  const screen: Screen = docsPath
    ? "docs"
    : requestedScreen === "setup" || requestedScreen === "docs" || (requestedScreen === "talk" && window.mikan)
      ? requestedScreen
      : "home"
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
  const hasUserSelectedCharacter = useRef(false)
  const [homeTab, setHomeTab] = useState<HomeTab>("home")
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(characters[0])
  const [library, setLibrary] = useState<Character[]>(window.mikan ? characters : [])
  const [scenariosLoading, setScenariosLoading] = useState(!window.mikan)
  const [scenariosError, setScenariosError] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<Overlay>(initialState.overlay)
  const [activeConversationId, setActiveConversationId] = useState("today")
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>(readInitialConnection)
  const [connectionType, setConnectionType] = useState<ConnectionType>(connectionSettings.type)

  const refreshScenarios = useCallback(async () => {
    setScenariosLoading(true)
    setScenariosError(null)
    try {
      const loaded = await loadScenarios()
      setLibrary((current) => {
        const serverIds = new Set(loaded.map((character) => character.id))
        return [...loaded, ...current.filter((character) => !serverIds.has(character.id))]
      })
      if (loaded[0] && !hasUserSelectedCharacter.current) setSelectedCharacter(loaded[0])
    } catch (error) {
      console.error("Failed to load scenarios", error)
      setScenariosError("シナリオを読み込めませんでした。通信状況を確認して、もう一度お試しください。")
    } finally {
      setScenariosLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!window.mikan) void refreshScenarios()
  }, [refreshScenarios])

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
    hasUserSelectedCharacter.current = true
    setSelectedCharacter(character)
    setActiveConversationId("today")
    setHomeTab(source)
    setScreen("talk")
  }

  const toCharacter = (loaded: LoadedChatPack): Character => {
    const primary = loaded.pack.plot.characters[0]
    const coverPath = loaded.pack.discovery.covers?.[0]
    const names = new Map(loaded.pack.plot.characters.map((character) => [character.id, character.name]))
    const opening = loaded.pack.plot.opening.map((event) => {
      const image = event.image ? loaded.assets[event.image] : undefined
      if (event.type === "narration") return { role: "narration" as const, text: resolveChatPackText(event.text), image }
      if (event.speaker === "user") return { role: "user" as const, text: resolveChatPackText(event.text), image }
      const dialogue = resolveChatPackText(event.text)
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
      image: coverPath ? loaded.assets[coverPath] : undefined,
      stageImage: primary.image ? loaded.assets[primary.image] : undefined,
      opening,
      pack: loaded.raw,
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
    hasUserSelectedCharacter.current = true
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
          isDesktop={Boolean(window.mikan)}
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
          loading={scenariosLoading}
          error={scenariosError}
          onRetry={refreshScenarios}
        />
      ) : null}

      {screen === "talk" ? (
        <TalkScreen
          character={selectedCharacter}
          conversationId={activeConversationId}
          connection={connectionSettings}
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
        initialModel={connectionSettings.model}
        isDesktop={Boolean(window.mikan)}
        onOpenChange={(open) => {
          if (!open) setConnectionType(connectionSettings.type)
          setOverlayOpen("connection", open)
        }}
        onConfirm={(settings) => {
          persistConnection(settings)
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
