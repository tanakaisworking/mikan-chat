import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { BrowserRouter, HashRouter, useLocation, useMatch, useNavigate } from "react-router"

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
import { rankScenarios, readScenarioRecommendation } from "@/lib/scenario-recommendation"
import { getDesktopBridge, isDesktopApp } from "@/lib/platform"
import { DEFAULT_TTS_SETTINGS, type TtsSettings } from "@/lib/tts"
import { HomeScreen, type HomeTab } from "@/screens/HomeScreen"
import { OnboardingScreen, type OnboardingGender, type OnboardingProfile } from "@/screens/OnboardingScreen"
import { SetupScreen, type AppearanceSettings } from "@/screens/SetupScreen"
import { ScenarioRouteState, ScenarioScreen } from "@/screens/ScenarioScreen"
import { TalkScreen } from "@/screens/TalkScreen"
import { TechDocsScreen } from "@/screens/TechDocsScreen"

type Screen = "settings" | "home" | "scenario" | "talk" | "docs" | "not-found"
type Overlay = "connection" | "import" | "voice" | "history" | null
const CONNECTION_STORAGE_KEY = "mikan-chat.connection.v1"
const ONBOARDING_STORAGE_KEY = "mikan-chat.onboarding.v1"
const APPEARANCE_STORAGE_KEY = "mikan-chat.appearance.v1"
const TTS_STORAGE_KEY = "mikan-chat.tts.v1"
const ONBOARDING_GENDERS: OnboardingGender[] = ["woman", "man", "nonbinary", "prefer-not-to-say"]

function createDefaultConnection(): ConnectionSettings {
  return {
    type: isDesktopApp() ? "local" : "online",
    apiKey: "",
    endpoint: isDesktopApp() ? "http://127.0.0.1:11434/v1" : GOOGLE_AI_STUDIO_ENDPOINT,
    model: isDesktopApp() ? "" : GOOGLE_AI_STUDIO_MODEL,
  }
}

function readInitialConnection() {
  const fallback = createDefaultConnection()
  if (isDesktopApp()) return fallback
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
  if (isDesktopApp()) return
  try {
    window.localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection))
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

function readTtsSettings(): TtsSettings {
  if (isDesktopApp()) return DEFAULT_TTS_SETTINGS
  try {
    const stored = JSON.parse(window.localStorage.getItem(TTS_STORAGE_KEY) ?? "null") as Partial<TtsSettings> | null
    if (!stored || (stored.provider !== "browser" && stored.provider !== "kokoro" && stored.provider !== "openai-compatible" && stored.provider !== "elevenlabs")) return DEFAULT_TTS_SETTINGS
    const settings: TtsSettings = {
      provider: stored.provider,
      apiKey: typeof stored.apiKey === "string" ? stored.apiKey : "",
      endpoint: typeof stored.endpoint === "string" ? stored.endpoint : DEFAULT_TTS_SETTINGS.endpoint,
      model: typeof stored.model === "string" ? stored.model : DEFAULT_TTS_SETTINGS.model,
      voice: typeof stored.voice === "string" ? stored.voice : DEFAULT_TTS_SETTINGS.voice,
    }
    return settings
  } catch {
    return DEFAULT_TTS_SETTINGS
  }
}

function persistTtsSettings(settings: TtsSettings) {
  if (isDesktopApp()) return
  try {
    window.localStorage.setItem(TTS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

function readOnboardingProfile(): OnboardingProfile | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? "null") as unknown
    if (!stored || typeof stored !== "object") return null
    const candidate = stored as Partial<OnboardingProfile> & { favoriteGenre?: unknown }
    const currentYear = new Date().getFullYear()
    if (!ONBOARDING_GENDERS.includes(candidate.gender as OnboardingGender)) return null
    if (!Number.isInteger(candidate.birthYear) || (candidate.birthYear ?? 0) < 1900 || (candidate.birthYear ?? 0) > currentYear) return null
    const favoriteGenres = Array.isArray(candidate.favoriteGenres)
      ? [...new Set(candidate.favoriteGenres.filter((genre): genre is string => typeof genre === "string").map((genre) => genre.trim()).filter(Boolean))]
      : typeof candidate.favoriteGenre === "string" && candidate.favoriteGenre.trim()
        ? [candidate.favoriteGenre.trim()]
        : []
    if (favoriteGenres.length === 0) return null
    const profile: OnboardingProfile = { gender: candidate.gender as OnboardingGender, birthYear: candidate.birthYear as number, favoriteGenres }
    if (!Array.isArray(candidate.favoriteGenres)) persistOnboardingProfile(profile)
    return profile
  } catch {
    return null
  }
}

function persistOnboardingProfile(profile: OnboardingProfile) {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

function readAppearanceSettings(): AppearanceSettings {
  try {
    const stored = JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? "null") as Partial<AppearanceSettings> | null
    return {
      textSize: stored?.textSize === "small" || stored?.textSize === "large" ? stored.textSize : "medium",
      theme: stored?.theme === "dark" ? "dark" : "light",
    }
  } catch {
    return { textSize: "medium", theme: "light" }
  }
}

function applyAppearanceSettings(settings: AppearanceSettings) {
  document.documentElement.dataset.textSize = settings.textSize
  document.documentElement.dataset.theme = settings.theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", settings.theme === "dark" ? "#171310" : "#fff9f4")
}

function persistAppearanceSettings(settings: AppearanceSettings) {
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

function readInitialOverlay(search: string) {
  const params = new URLSearchParams(search)
  const requestedOverlay = params.get("overlay")
  return (
    requestedOverlay === "connection" ||
    requestedOverlay === "import" ||
    requestedOverlay === "voice" ||
    requestedOverlay === "history"
      ? requestedOverlay
      : null
  ) satisfies Overlay
}

function scenarioPublicId(character: Character) {
  if (!character.publicId) throw new Error("シナリオの公開IDがありません。")
  return character.publicId
}

function scenarioPath(character: Character) {
  return `/scenarios/${scenarioPublicId(character)}`
}

export function App() {
  const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter
  return <Router><AppContent /></Router>
}

export function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const scenarioMatch = useMatch("/scenarios/:publicId")
  const talkMatch = useMatch("/scenarios/:publicId/chat")
  const docsMatch = useMatch("/docs")
  const setupMatch = useMatch("/setup")
  const settingsMatch = useMatch("/settings")
  const chatsMatch = useMatch("/chats")
  const legacyScreen = location.pathname === "/" ? new URLSearchParams(location.search).get("screen") : null
  const routePublicId = talkMatch?.params.publicId ?? scenarioMatch?.params.publicId
  const screen: Screen = talkMatch
    ? "talk"
    : scenarioMatch
      ? "scenario"
      : docsMatch || legacyScreen === "docs"
        ? "docs"
          : settingsMatch || setupMatch || legacyScreen === "setup"
          ? "settings"
          : location.pathname === "/" || chatsMatch
            ? legacyScreen === "talk" && isDesktopApp() ? "talk" : "home"
            : "not-found"
  const hasUserSelectedCharacter = useRef(false)
  const scenariosRequestId = useRef(0)
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(characters[0])
  const [library, setLibrary] = useState<Character[]>(isDesktopApp() ? characters : [])
  const [scenariosLoading, setScenariosLoading] = useState(!isDesktopApp())
  const [scenariosError, setScenariosError] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<Overlay>(() => readInitialOverlay(location.search))
  const [activeConversationId, setActiveConversationId] = useState("today")
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>(readInitialConnection)
  const [connectionType, setConnectionType] = useState<ConnectionType>(connectionSettings.type)
  const [readAloud, setReadAloud] = useState(false)
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(readTtsSettings)
  const [showStoryIntro, setShowStoryIntro] = useState(false)
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile | null>(readOnboardingProfile)
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(readAppearanceSettings)
  const [desktopReady, setDesktopReady] = useState(!isDesktopApp() || !getDesktopBridge()?.store)
  const routeCharacter = routePublicId ? library.find((character) => character.publicId === routePublicId) ?? null : null
  const activeCharacter = routeCharacter ?? selectedCharacter
  const homeTab: HomeTab = chatsMatch ? "chat" : "home"
  const talkBackTo = (location.state as { backTo?: string } | null)?.backTo

  const refreshScenarios = useCallback(async () => {
    const requestId = ++scenariosRequestId.current
    setScenariosLoading(!isDesktopApp())
    setScenariosError(null)
    try {
      const loaded = await loadScenarios()
      if (requestId !== scenariosRequestId.current) return
      setLibrary((current) => {
        const serverIds = new Set(loaded.map((character) => character.id))
        const serverPublicIds = new Set(loaded.map((character) => character.publicId))
        const importedPublicIds = new Set(current.filter((character) => character.imported).map((character) => character.publicId))
        return [
          ...loaded.filter((character) => !importedPublicIds.has(character.publicId)),
          ...current.filter((character) => character.imported || (!serverIds.has(character.id) && !serverPublicIds.has(character.publicId))),
        ]
      })
      if (loaded[0] && !isDesktopApp() && !hasUserSelectedCharacter.current) setSelectedCharacter(loaded[0])
    } catch (error) {
      if (requestId !== scenariosRequestId.current) return
      console.error("Failed to load scenarios", error)
      setScenariosError("シナリオを読み込めませんでした。通信状況を確認して、もう一度お試しください。")
    } finally {
      if (requestId === scenariosRequestId.current) setScenariosLoading(false)
    }
  }, [])

  useEffect(() => { void refreshScenarios() }, [refreshScenarios])

  useEffect(() => {
    const store = getDesktopBridge()?.store
    if (!store) return
    let active = true
    void store.load().then(({ settings }) => {
      if (!active) return
      setConnectionSettings(settings.connection)
      setConnectionType(settings.connection.type)
      setTtsSettings(settings.tts)
      setOnboardingProfile((current) => settings.profile ?? current)
      setAppearanceSettings((current) => window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ? current : settings.appearance)
      setReadAloud(settings.readAloud)
    }).catch((error) => {
      console.error("Failed to load desktop settings", error)
    }).finally(() => {
      if (active) setDesktopReady(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const store = getDesktopBridge()?.store
    if (!store || !desktopReady) return
    const timer = window.setTimeout(() => {
      void store.saveSettings({
        connection: connectionSettings,
        tts: ttsSettings,
        profile: onboardingProfile,
        appearance: appearanceSettings,
        readAloud,
      }).then(() => {
        window.localStorage.removeItem(ONBOARDING_STORAGE_KEY)
        window.localStorage.removeItem(APPEARANCE_STORAGE_KEY)
      }).catch((error) => console.error("Failed to save desktop settings", error))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [appearanceSettings, connectionSettings, desktopReady, onboardingProfile, readAloud, ttsSettings])

  useLayoutEffect(() => {
    applyAppearanceSettings(appearanceSettings)
  }, [appearanceSettings])

  const openOverlay = (nextOverlay: Exclude<Overlay, null>) => setOverlay(nextOverlay)
  const showScreen = (nextScreen: Screen) => {
    if (nextScreen === "docs") navigate("/docs")
    else if (nextScreen === "settings") navigate("/settings")
    else if (nextScreen === "talk") navigate(`${scenarioPath(activeCharacter)}/chat`)
    else navigate("/")
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
    setShowStoryIntro(source === "home")
    navigate(
      source === "home" ? scenarioPath(character) : `${scenarioPath(character)}/chat`,
      source === "chat" ? { state: { backTo: "/chats" } } : undefined,
    )
  }

  const startScenario = (character: Character) => {
    hasUserSelectedCharacter.current = true
    setSelectedCharacter(character)
    setActiveConversationId("today")
    setShowStoryIntro(true)
    navigate(`${scenarioPath(character)}/chat`, { state: { backTo: scenarioPath(character) } })
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
      publicId: loaded.pack.id,
      slug: loaded.pack.id,
      name: primary.name,
      packTitle: loaded.pack.title,
      tags: loaded.pack.discovery.tags,
      recommendation: readScenarioRecommendation(loaded.raw),
      conversationLabel: `${loaded.pack.plot.characters.length}人と会話`,
      description: loaded.pack.discovery.description ?? loaded.pack.summary,
      lastMessage,
      lastActive: "たった今",
      image: coverPath ? loaded.assets[coverPath] : undefined,
      stageImage: primary.image ? loaded.assets[primary.image] : undefined,
      imported: true,
      opening,
      pack: loaded.raw,
    }
  }

  const addImportedPack = (loaded: LoadedChatPack) => {
    const imported = toCharacter(loaded)
    const existing = library.find((character) => character.id === imported.id || character.publicId === imported.publicId)
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
    setShowStoryIntro(true)
    setOverlay(null)
    navigate(`${scenarioPath(imported)}/chat`, { state: { backTo: scenarioPath(imported) } })
  }

  const onboardingGenres = useMemo(() => {
    const counts = new Map<string, number>()
    library.forEach((character) => {
      character.tags?.forEach((tag) => {
        const normalized = tag.trim()
        if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
      })
    })
    return [...counts.entries()]
      .sort(([tagA, countA], [tagB, countB]) => countB - countA || tagA.localeCompare(tagB, "ja"))
      .map(([tag]) => tag)
  }, [library])

  const recommendedLibrary = useMemo(
    () => onboardingProfile ? rankScenarios(library, onboardingProfile) : library,
    [library, onboardingProfile],
  )

  if (!desktopReady) return <main className="h-dvh bg-background" aria-label="アプリを準備しています" />

  if (!onboardingProfile && screen !== "docs" && screen !== "scenario" && screen !== "not-found") {
    return (
      <TooltipProvider>
        <OnboardingScreen
          genres={onboardingGenres}
          genresLoading={scenariosLoading}
          genresError={scenariosError}
          onRetryGenres={refreshScenarios}
          onComplete={(profile) => {
            persistOnboardingProfile(profile)
            setOnboardingProfile(profile)
          }}
        />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      {screen === "settings" && onboardingProfile ? (
        <SetupScreen
          connection={connectionSettings}
          ttsSettings={ttsSettings}
          profile={onboardingProfile}
          genres={onboardingGenres}
          appearance={appearanceSettings}
          onBack={() => navigate("/")}
          onOpenConnection={() => openConnection()}
          onOpenVoice={() => openOverlay("voice")}
          onProfileChange={(profile) => {
            persistOnboardingProfile(profile)
            setOnboardingProfile(profile)
          }}
          onAppearanceChange={(settings) => {
            applyAppearanceSettings(settings)
            persistAppearanceSettings(settings)
            setAppearanceSettings(settings)
          }}
        />
      ) : null}

      {screen === "home" ? (
        <HomeScreen
          characters={library}
          recommendedCharacters={recommendedLibrary}
          activeTab={homeTab}
          onTabChange={(tab) => navigate(tab === "home" ? "/" : "/chats")}
          onSelectCharacter={talkWith}
          onAddPack={() => openOverlay("import")}
          onOpenDocs={() => showScreen("docs")}
          onOpenSettings={() => showScreen("settings")}
          loading={scenariosLoading}
          error={scenariosError}
          onRetry={refreshScenarios}
        />
      ) : null}

      {screen === "scenario" ? (
        routeCharacter ? (
          <ScenarioScreen
            character={routeCharacter}
            onBack={() => navigate("/")}
            onStart={() => startScenario(routeCharacter)}
          />
        ) : (
          <ScenarioRouteState
            title={scenariosLoading ? "シナリオを読み込んでいます…" : "シナリオが見つかりません"}
            message={scenariosLoading ? "少しお待ちください。" : scenariosError ?? "URLを確認するか、ホームから別の物語を選んでください。"}
            onBack={() => navigate("/")}
          />
        )
      ) : null}

      {screen === "talk" ? (
        routePublicId && !routeCharacter ? (
          <ScenarioRouteState
            title={scenariosLoading ? "チャットを準備しています…" : "シナリオが見つかりません"}
            message={scenariosLoading ? "少しお待ちください。" : scenariosError ?? "URLを確認するか、ホームから別の物語を選んでください。"}
            onBack={() => navigate("/")}
          />
        ) : (
          <TalkScreen
            character={activeCharacter}
            scenarioId={activeCharacter.id}
            conversationId={activeConversationId}
            connection={connectionSettings}
            ttsSettings={ttsSettings}
            readAloud={readAloud}
            isNewStory={showStoryIntro}
            onBack={() => navigate(talkBackTo ?? (routePublicId ? scenarioPath(activeCharacter) : "/"))}
            onOpenConnection={() => openConnection()}
            onOpenVoice={() => openOverlay("voice")}
            onOpenHistory={() => openOverlay("history")}
          />
        )
      ) : null}

      {screen === "docs" ? (
        <TechDocsScreen
          onBack={() => showScreen("home")}
          onTryDemo={() => openOverlay("import")}
        />
      ) : null}

      {screen === "not-found" ? (
        <ScenarioRouteState title="ページが見つかりません" message="URLを確認するか、ホームへ戻ってください。" onBack={() => navigate("/")} />
      ) : null}

      <AIConnectionDialog
        open={overlay === "connection"}
        initialConnection={connectionType}
        initialApiKey={connectionSettings.apiKey}
        initialEndpoint={connectionSettings.endpoint}
        initialModel={connectionSettings.model}
        isDesktop={isDesktopApp()}
        onOpenChange={(open) => {
          if (!open) setConnectionType(connectionSettings.type)
          setOverlayOpen("connection", open)
        }}
        onConfirm={(settings) => {
          persistConnection(settings)
          setConnectionSettings(settings)
          setConnectionType(settings.type)
          setOverlay(null)
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
        readAloud={readAloud}
        ttsSettings={ttsSettings}
        onReadAloudChange={setReadAloud}
        onTtsSettingsChange={(settings) => {
          persistTtsSettings(settings)
          setTtsSettings(settings)
        }}
        onOpenChange={(open) => setOverlayOpen("voice", open)}
      />
      <ConversationHistorySheet
        key={activeCharacter.id}
        open={overlay === "history"}
        scenarioId={activeCharacter.id}
        characterName={activeCharacter.name}
        importedPack={Boolean(activeCharacter.opening)}
        activeConversationId={activeConversationId}
        onOpenChange={(open) => setOverlayOpen("history", open)}
        onSelectConversation={(conversationId) => {
          setActiveConversationId(conversationId)
          setShowStoryIntro(false)
          setOverlay(null)
        }}
      />
    </TooltipProvider>
  )
}
