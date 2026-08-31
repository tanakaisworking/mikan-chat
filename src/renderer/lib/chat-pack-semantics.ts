const localIdPattern = /^[a-z][a-z0-9-]{0,63}$/
const reservedCharacterIds = new Set(["user", "narrator"])

export function getChatPackSemanticIssue(input: unknown): string | null {
  if (!isRecord(input) || !isRecord(input.plot) || !Array.isArray(input.plot.characters)) return "plotを確認してください。"

  const characterIds = new Set<string>()
  for (const value of input.plot.characters) {
    if (!isRecord(value) || typeof value.id !== "string" || !localIdPattern.test(value.id) || reservedCharacterIds.has(value.id) || characterIds.has(value.id)) {
      return `登場人物IDを確認してください: ${isRecord(value) ? String(value.id) : ""}`
    }
    characterIds.add(value.id)
  }

  const openingIssue = validateEvents(input.plot.opening, characterIds)
  if (openingIssue) return openingIssue

  const profileIds = new Set<string>()
  if (input.plot.playerProfiles !== undefined) {
    if (!Array.isArray(input.plot.playerProfiles)) return "plot.playerProfilesを確認してください。"
    for (const value of input.plot.playerProfiles) {
      if (!isRecord(value) || typeof value.id !== "string") return "plot.playerProfilesを確認してください。"
      if (profileIds.has(value.id)) return `ユーザープロフィールIDが重複しています: ${value.id}`
      profileIds.add(value.id)
    }
  }
  if (input.plot.defaultPlayerProfile !== undefined && (typeof input.plot.defaultPlayerProfile !== "string" || !profileIds.has(input.plot.defaultPlayerProfile))) {
    return `defaultPlayerProfileが存在しません: ${String(input.plot.defaultPlayerProfile)}`
  }

  if (input.plot.situationExamples !== undefined) {
    if (!Array.isArray(input.plot.situationExamples)) return "plot.situationExamplesを確認してください。"
    for (const value of input.plot.situationExamples) {
      if (!isRecord(value)) return "plot.situationExamplesを確認してください。"
      const issue = validateEvents(value.events, characterIds)
      if (issue) return issue
    }
  }

  const bookIds = new Set<string>()
  if (input.plot.settingBooks !== undefined) {
    if (!Array.isArray(input.plot.settingBooks)) return "plot.settingBooksを確認してください。"
    for (const value of input.plot.settingBooks) {
      if (!isRecord(value) || typeof value.id !== "string" || !Array.isArray(value.entries)) return "plot.settingBooksを確認してください。"
      if (bookIds.has(value.id)) return `設定集IDが重複しています: ${value.id}`
      bookIds.add(value.id)
      const entryIds = new Set<string>()
      for (const entry of value.entries) {
        if (!isRecord(entry) || typeof entry.id !== "string") return `plot.settingBooks[${value.id}].entriesを確認してください。`
        if (entryIds.has(entry.id)) return `設定集エントリIDが重複しています: ${value.id}/${entry.id}`
        entryIds.add(entry.id)
      }
    }
  }

  return null
}

function validateEvents(value: unknown, characterIds: Set<string>) {
  if (!Array.isArray(value)) return "導入イベントを確認してください。"
  for (const event of value) {
    if (!isRecord(event)) return "導入イベントを確認してください。"
    if (event.type === "dialogue" && (typeof event.speaker !== "string" || (event.speaker !== "user" && !characterIds.has(event.speaker)))) {
      return `存在しない話者です: ${String(event.speaker)}`
    }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
