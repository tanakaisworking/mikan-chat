import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { ReactNode } from "react"
import { BrowserRouter, HashRouter, useLocation, useMatch, useNavigate } from "react-router"

import { ConversationHistorySheet } from "@/components/chat/conversation-history-sheet"
import { ImportChatPackDialog } from "@/components/library/import-chat-pack-dialog"
import { type ConnectionSettings, type ConnectionType } from "@/components/settings/ai-connection-dialog"
import { ChatSettingsDialog } from "@/components/settings/chat-settings-dialog"
import { DesktopTitleBar } from "@/components/ui/desktop-title-bar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { characters, type Character } from "@/data/characters"
import { readIdleVideo } from "@/data/scenario-source"
import { loadScenarios } from "@/data/scenario-source"
import { GOOGLE_AI_STUDIO_ENDPOINT, GOOGLE_AI_STUDIO_MODEL, getConnectionError } from "@/lib/ai-chat"
import type { LoadedChatPack } from "@/lib/chat-pack"
import { resolveChatPackText } from "@/lib/chat-pack-template"
import { rankScenarios, readScenarioRecommendation } from "@/lib/scenario-recommendation"
import { getScenarioVoiceDesigns, hasScenarioReferenceAudio, isScenarioVoiceConfirmed, recoverScenarioVoice, scenarioVersion, type ScenarioVoiceSelection } from "@/lib/scenario-voice"
import { getDesktopBridge, isDesktopApp } from "@/lib/platform"
import { DEFAULT_TTS_SETTINGS, getIrodoriRuntimeSnapshot, isIrodoriTtsSettings, subscribeIrodoriRuntime, type TtsSettings } from "@/lib/tts"
import { DEFAULT_BUILTIN_MODEL_SOURCE } from "../shared/local-ai"
import { HomeScreen, type HomeTab } from "@/screens/HomeScreen"
import { OnboardingScreen, type OnboardingGender, type OnboardingProfile } from "@/screens/OnboardingScreen"
import { SetupScreen, type AppearanceSettings } from "@/screens/SetupScreen"
import { ScenarioRouteState, ScenarioScreen } from "@/screens/ScenarioScreen"
import { TalkScreen } from "@/screens/TalkScreen"
import { TechDocsScreen } from "@/screens/TechDocsScreen"

type Screen = "settings" | "home" | "scenario" | "talk" | "docs" | "not-found"
type Overlay = "connection" | "import" | "voice" | "bgm" | "history" | null
const CONNECTION_STORAGE_KEY = "mikan-chat.connection.v1"
const ONBOARDING_STORAGE_KEY = "mikan-chat.onboarding.v1"
const APPEARANCE_STORAGE_KEY = "mikan-chat.appearance.v1"
const TTS_STORAGE_KEY = "mikan-chat.tts.v1"
const SCENARIO_VOICES_STORAGE_KEY = "mikan-chat.scenario-voices.v1"
const ONBOARDING_GENDERS: OnboardingGender[] = ["woman", "man", "nonbinary", "prefer-not-to-say"]

function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <DesktopTitleBar />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

function createDefaultConnection(): ConnectionSettings {
  const hasBuiltinAI = Boolean(getDesktopBridge()?.localAI)
  return {
    type: hasBuiltinAI ? "builtin" : isDesktopApp() ? "local" : "online",
    apiKey: "",
    endpoint: hasBuiltinAI ? "" : isDesktopApp() ? "http://127.0.0.1:11434/v1" : GOOGLE_AI_STUDIO_ENDPOINT,
    model: hasBuiltinAI ? DEFAULT_BUILTIN_MODEL_SOURCE : isDesktopApp() ? "" : GOOGLE_AI_STUDIO_MODEL,
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
    if (!stored || (stored.provider !== "browser" && stored.provider !== "kokoro" && stored.provider !== "irodori" && stored.provider !== "openai-compatible" && stored.provider !== "elevenlabs")) return DEFAULT_TTS_SETTINGS
    const settings: TtsSettings = {
      provider: stored.provider,
      apiKey: typeof stored.apiKey === "string" ? stored.apiKey : "",
      endpoint: typeof stored.endpoint === "string" ? stored.endpoint : DEFAULT_TTS_SETTINGS.endpoint,
      model: typeof stored.model === "string" ? stored.model : DEFAULT_TTS_SETTINGS.model,
      voice: typeof stored.voice === "string" ? stored.voice : DEFAULT_TTS_SETTINGS.voice,
      irodoriQuality: stored.irodoriQuality === "fast" || stored.irodoriQuality === "balanced" || stored.irodoriQuality === "quality"
        ? stored.irodoriQuality
        : undefined,
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

function readScenarioVoiceSelections(): Record<string, ScenarioVoiceSelection> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SCENARIO_VOICES_STORAGE_KEY) ?? "{}") as Record<string, unknown>
    return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, ScenarioVoiceSelection] => {
      const value = entry[1] as Partial<ScenarioVoiceSelection> | null
      return Boolean(value)
        && typeof value?.characterId === "string" && value.characterId.length > 0 && value.characterId.length <= 64
        && typeof value.voiceId === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value.voiceId)
        && typeof value.caption === "string" && value.caption.trim().length > 0 && value.caption.length <= 1_000
        && Number.isInteger(value.seed) && (value.seed ?? -1) >= 0 && (value.seed ?? Number.MAX_SAFE_INTEGER) <= 2_147_483_647
        && typeof value.scenarioVersion === "string" && value.scenarioVersion.length > 0 && value.scenarioVersion.length <= 100
    }))
  } catch {
    return {}
  }
}

function persistScenarioVoiceSelections(selections: Record<string, ScenarioVoiceSelection>) {
  try {
    window.localStorage.setItem(SCENARIO_VOICES_STORAGE_KEY, JSON.stringify(selections))
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
}

function voiceSelectionKey(scenarioId: string, characterId: string) {
  return `${scenarioId}:${characterId}`
}

function findVoiceSelection(selections: Record<string, ScenarioVoiceSelection>, scenarioId: string, characterId: string) {
  return selections[voiceSelectionKey(scenarioId, characterId)]
    ?? (selections[scenarioId]?.characterId === characterId ? selections[scenarioId] : undefined)
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
    requestedOverlay === "bgm" ||
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
  const [scenarioVoiceSelections, setScenarioVoiceSelections] = useState<Record<string, ScenarioVoiceSelection>>(readScenarioVoiceSelections)
  const [voiceSetupRequired, setVoiceSetupRequired] = useState(false)
  const [voiceSetupCharacterId, setVoiceSetupCharacterId] = useState("")
  const [confirmedVoiceGateKey, setConfirmedVoiceGateKey] = useState("")
  const [voiceGateRetry, setVoiceGateRetry] = useState(0)
  const checkedVoiceGate = useRef("")
  const voiceGatePrompted = useRef(false)
  const irodoriSelected = isIrodoriTtsSettings(ttsSettings)
  const irodoriRuntime = useSyncExternalStore(subscribeIrodoriRuntime, getIrodoriRuntimeSnapshot)
  const [showStoryIntro, setShowStoryIntro] = useState(false)
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile | null>(readOnboardingProfile)
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(readAppearanceSettings)
  const [desktopReady, setDesktopReady] = useState(!isDesktopApp() || !getDesktopBridge()?.store)
  const [conversationScenarioIds, setConversationScenarioIds] = useState<Set<string>>(new Set())
  const [conversationsLoaded, setConversationsLoaded] = useState(!getDesktopBridge()?.conversations)
  const routeCharacter = routePublicId ? library.find((character) => character.publicId === routePublicId) ?? null : null
  const activeCharacter = routeCharacter ?? selectedCharacter
  const homeTab: HomeTab = chatsMatch ? "chat" : "home"
  const talkBackTo = (location.state as { backTo?: string } | null)?.backTo
  const activeVoiceDesigns = getScenarioVoiceDesigns(activeCharacter)
  const activeVoiceDesign = activeVoiceDesigns.find((design) => design.characterId === voiceSetupCharacterId) ?? activeVoiceDesigns[0]
  const activeVoiceSelections = activeVoiceDesigns.flatMap((design) => {
    const selection = findVoiceSelection(scenarioVoiceSelections, activeCharacter.id, design.characterId)
    return selection ? [selection] : []
  })
  const activeVoiceGateKey = activeVoiceDesigns.length ? `${activeCharacter.id}:${scenarioVersion(activeCharacter)}` : ""
  const voiceGateApplies = desktopReady && screen === "talk" && irodoriSelected && Boolean(getDesktopBridge()?.tts?.hasReference) && activeVoiceDesigns.some((design) => !hasScenarioReferenceAudio(activeCharacter, design.characterId))
  const ttsVoiceReady = !voiceGateApplies || confirmedVoiceGateKey === activeVoiceGateKey

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
    const conversations = getDesktopBridge()?.conversations
    if (!desktopReady || screen !== "home" || !conversations) return
    let active = true
    setConversationsLoaded(false)
    void conversations.list().then((items) => {
      if (active) setConversationScenarioIds(new Set(items.map((item) => item.scenarioId)))
    }).catch((error) => {
      console.error("Failed to list conversations", error)
    }).finally(() => {
      if (active) setConversationsLoaded(true)
    })
    return () => { active = false }
  }, [desktopReady, screen])

  useEffect(() => {
    if (!desktopReady) return
    const bridge = getDesktopBridge()?.irodori
    if (!bridge) return
    if (!irodoriSelected) {
      void bridge.stop().catch(() => undefined)
      return
    }
    let active = true
    void bridge.status().then((runtime) => {
      if (!active) return
      if (runtime.state === "ready" || runtime.state === "running" || runtime.state === "starting") return bridge.start()
    }).catch(() => undefined)
    return () => { active = false }
  }, [desktopReady, irodoriSelected])

  useEffect(() => {
    if (screen !== "talk") {
      checkedVoiceGate.current = ""
      voiceGatePrompted.current = false
      setVoiceSetupRequired(false)
      setConfirmedVoiceGateKey("")
      return
    }
    if (!irodoriSelected) {
      checkedVoiceGate.current = ""
      voiceGatePrompted.current = false
      setVoiceSetupRequired(false)
      setConfirmedVoiceGateKey("")
      return
    }
    const bridge = getDesktopBridge()
    const designs = getScenarioVoiceDesigns(activeCharacter)
    if (!desktopReady || !bridge?.irodori || !bridge.tts?.hasReference || !designs.length) {
      setVoiceSetupRequired(false)
      return
    }
    if (irodoriRuntime && !["ready", "running"].includes(irodoriRuntime.state)) {
      checkedVoiceGate.current = ""
      setConfirmedVoiceGateKey("")
      setVoiceSetupRequired(false)
      return
    }
    const gateKey = `${activeCharacter.id}:${scenarioVersion(activeCharacter)}`
    if (checkedVoiceGate.current === gateKey) return
    let active = true
    let retryTimer: number | undefined
    void (async () => {
      for (let attempt = 0; attempt < 3 && active; attempt += 1) {
        try {
          const runtime = await bridge.irodori!.status()
          if (!active || !["ready", "running"].includes(runtime.state)) return
          let missing = null
          const recovered: ScenarioVoiceSelection[] = []
          for (const design of designs) {
            if (hasScenarioReferenceAudio(activeCharacter, design.characterId)) continue
            const selection = findVoiceSelection(scenarioVoiceSelections, activeCharacter.id, design.characterId)
            if (!await isScenarioVoiceConfirmed(activeCharacter, selection, bridge.tts!.hasReference!)) {
              const findReference = bridge.tts!.findReference
              const restored = findReference ? await recoverScenarioVoice(activeCharacter, design, findReference) : null
              if (!restored) {
                missing = design
                break
              }
              recovered.push(restored)
            }
          }
          if (!active) return
          if (recovered.length) {
            const next = { ...scenarioVoiceSelections }
            for (const selection of recovered) next[voiceSelectionKey(activeCharacter.id, selection.characterId)] = selection
            persistScenarioVoiceSelections(next)
            setScenarioVoiceSelections(next)
          }
          checkedVoiceGate.current = gateKey
          if (!missing) {
            setConfirmedVoiceGateKey(gateKey)
            setVoiceSetupRequired(false)
            if (voiceGatePrompted.current) {
              voiceGatePrompted.current = false
              setOverlay(null)
            }
            return
          }
          setConfirmedVoiceGateKey("")
          setVoiceSetupCharacterId(missing.characterId)
          setVoiceSetupRequired(true)
          voiceGatePrompted.current = true
          setOverlay("voice")
          return
        } catch {
          if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 750))
        }
      }
      if (active) retryTimer = window.setTimeout(() => setVoiceGateRetry((current) => current + 1), 2_000)
    })()
    return () => {
      active = false
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    }
  }, [activeCharacter, desktopReady, irodoriRuntime, irodoriSelected, scenarioVoiceSelections, screen, voiceGateRetry])

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
      setScenarioVoiceSelections((current) => settings.scenarioVoices && Object.keys(settings.scenarioVoices).length ? settings.scenarioVoices : current)
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
        scenarioVoices: scenarioVoiceSelections,
      }).then(() => {
        window.localStorage.removeItem(ONBOARDING_STORAGE_KEY)
        window.localStorage.removeItem(APPEARANCE_STORAGE_KEY)
        window.localStorage.removeItem(SCENARIO_VOICES_STORAGE_KEY)
      }).catch((error) => console.error("Failed to save desktop settings", error))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [appearanceSettings, connectionSettings, desktopReady, onboardingProfile, readAloud, scenarioVoiceSelections, ttsSettings])

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
    const idleVideo = readIdleVideo(loaded.raw)

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
      idleVideo: idleVideo.asset ? loaded.assets[idleVideo.asset] : idleVideo.url,
      imported: true,
      opening,
      pack: loaded.raw,
      assets: loaded.assets,
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

  const conversationLibrary = useMemo(
    () => getDesktopBridge()?.conversations ? library.filter((character) => conversationScenarioIds.has(character.id)) : library,
    [conversationScenarioIds, library],
  )
  const recommendedLibrary = useMemo(
    () => {
      const unread = library.filter((character) => !conversationScenarioIds.has(character.id))
      return onboardingProfile ? rankScenarios(unread, onboardingProfile) : unread
    },
    [conversationScenarioIds, library, onboardingProfile],
  )

  if (!desktopReady) {
    return (
      <TooltipProvider>
        <AppFrame>
          <main className="h-full bg-background" aria-label="アプリを準備しています" />
        </AppFrame>
      </TooltipProvider>
    )
  }

  if (!onboardingProfile && screen !== "docs" && screen !== "scenario" && screen !== "not-found") {
    return (
      <TooltipProvider>
        <AppFrame>
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
        </AppFrame>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <AppFrame>
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
          characters={conversationLibrary}
          recommendedCharacters={conversationsLoaded ? recommendedLibrary : []}
          activeTab={homeTab}
          onTabChange={(tab) => navigate(tab === "home" ? "/" : "/chats")}
          onSelectCharacter={talkWith}
          onAddPack={() => openOverlay("import")}
          onOpenDocs={() => showScreen("docs")}
          onOpenSettings={() => showScreen("settings")}
          loading={scenariosLoading || !conversationsLoaded}
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
            voiceSelections={activeVoiceSelections}
            ttsVoiceReady={ttsVoiceReady}
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

      <ChatSettingsDialog
        open={overlay === "connection" || overlay === "voice" || overlay === "bgm"}
        section={overlay === "voice" ? "voice" : overlay === "bgm" ? "bgm" : "connection"}
        connection={{ ...connectionSettings, type: connectionType }}
        isDesktop={isDesktopApp()}
        readAloud={readAloud}
        ttsSettings={ttsSettings}
        character={screen === "talk" ? activeCharacter : undefined}
        voiceDesign={screen === "talk" ? activeVoiceDesign : undefined}
        voiceSelection={screen === "talk" && activeVoiceDesign ? findVoiceSelection(scenarioVoiceSelections, activeCharacter.id, activeVoiceDesign.characterId) : undefined}
        voiceSetupRequired={voiceSetupRequired}
        onSectionChange={setOverlay}
        onOpenChange={(open) => {
          if (!open) setConnectionType(connectionSettings.type)
          if (!open) setOverlay(null)
        }}
        onConnectionConfirm={(settings) => {
          persistConnection(settings)
          setConnectionSettings(settings)
          setConnectionType(settings.type)
          setOverlay(null)
        }}
        onReadAloudChange={setReadAloud}
        onTtsSettingsChange={(settings) => {
          persistTtsSettings(settings)
          setTtsSettings(settings)
          if (!isIrodoriTtsSettings(settings)) setVoiceSetupRequired(false)
        }}
        onVoiceConfirmed={(selection) => {
          const next = { ...scenarioVoiceSelections, [voiceSelectionKey(activeCharacter.id, selection.characterId)]: selection }
          persistScenarioVoiceSelections(next)
          setScenarioVoiceSelections(next)
          checkedVoiceGate.current = ""
        }}
        onVoiceReset={() => {
          if (!activeVoiceDesign) return
          const next = { ...scenarioVoiceSelections }
          delete next[voiceSelectionKey(activeCharacter.id, activeVoiceDesign.characterId)]
          persistScenarioVoiceSelections(next)
          setScenarioVoiceSelections(next)
          checkedVoiceGate.current = ""
        }}
      />
      <ImportChatPackDialog
        open={overlay === "import"}
        onOpenChange={(open) => setOverlayOpen("import", open)}
        onAddToLibrary={importToLibrary}
        onAddAndTalk={importAndTalk}
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
      </AppFrame>
    </TooltipProvider>
  )
}
