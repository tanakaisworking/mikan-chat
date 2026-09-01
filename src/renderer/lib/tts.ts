export type TtsDriver = {
  label: string
  supported: boolean
  unavailableReason: string | null
  speak: (text: string, callbacks?: { onEnd?: () => void }) => void
  stop: () => void
}

export function createTtsDriver(): TtsDriver {
  if (window.mikan) {
    return {
      label: "Irodori TTS",
      supported: false,
      unavailableReason: "Irodori TTS接続後に利用できます",
      speak: () => undefined,
      stop: () => undefined,
    }
  }

  const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
  return {
    label: "ブラウザ標準TTS",
    supported,
    unavailableReason: supported ? null : "この環境では利用できません",
    speak: (text, { onEnd } = {}) => {
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "ja-JP"
      utterance.onend = utterance.onerror = () => onEnd?.()
      window.speechSynthesis.speak(utterance)
    },
    stop: () => window.speechSynthesis?.cancel(),
  }
}
