import { assignCharacterId, nextDraftKey, type PackDraft } from "@/lib/pack-authoring/types"

export const AI_DRAFT_SYSTEM_PROMPT = [
  "あなたはチャット小説のシナリオ作家です。ユーザーの希望をもとに、下の形式どおりのMarkdownだけを出力してください。",
  "挨拶・解説・コードブロックは書かず、見出しと本文だけにします。",
  "",
  "## タイトル",
  "物語の題名を1行で",
  "## あらすじ",
  "2〜3文で",
  "## 前提",
  "世界観と導入状況を数文で",
  "## 指針",
  "会話の進め方・禁則を箇条書きで（なければ「特になし」と書く）",
  "## タグ",
  "読点区切りで3〜6個",
  "## 登場人物",
  "### 名前",
  "- プロフィール: 年齢・立場・性格を2〜3文で",
  "- 声の性別: 男性・女性・中性的のいずれか",
  "- 声の特徴: 読点区切りで2〜4個",
  "- 声の指示: 1文で（なければ空欄）",
  "## 導入",
  "- ナレーション: 情景描写を1文で",
  "- 名前: セリフを1文で",
  "- あなた: 主人公のセリフ（あってもなくてもよい）",
  "",
  "制約:",
  "- 登場人物は1〜3人にする",
  "- 導入は3〜6件にし、必ず誰かのセリフを1件以上入れる",
  "- 固有名詞の表記は全体で統一する",
].join("\n")

export type AiDraftCharacter = {
  name: string
  profile: string
  gender: "" | "male" | "female" | "neutral"
  traits: string
  caption: string
}

export type AiDraftEvent =
  | { type: "narration"; text: string }
  | { type: "dialogue"; speaker: string; text: string }

export type AiDraft = {
  title: string
  summary: string
  premise: string
  instructions: string
  tags: string
  characters: AiDraftCharacter[]
  opening: AiDraftEvent[]
}

const KNOWN_SECTIONS = new Set(["タイトル", "あらすじ", "前提", "指針", "タグ", "登場人物", "導入"])

function splitBullets(text: string) {
  return text.split("\n").map((line) => line.trim().replace(/^([-*・]|\d+[.)])\s*/, "").trim()).filter(Boolean)
}

function splitKeyValue(line: string) {
  const separator = line.search(/[:：]/)
  if (separator < 0) return null
  return {
    key: line.slice(0, separator).trim(),
    value: line.slice(separator + 1).trim(),
  }
}

function readGender(value: string): AiDraftCharacter["gender"] {
  if (/^(男性|男|male)$/i.test(value)) return "male"
  if (/^(女性|女|female)$/i.test(value)) return "female"
  if (/中性/.test(value) || /^neutral$/i.test(value)) return "neutral"
  return ""
}

function parseCharacters(section: string) {
  const characters: AiDraftCharacter[] = []
  const headings = [...section.matchAll(/^###\s*(.+?)\s*$/gm)]
  for (let index = 0; index < headings.length; index += 1) {
    const name = headings[index][1].trim().replace(/[:：]$/, "")
    if (!name) continue
    const body = section.slice((headings[index].index ?? 0) + headings[index][0].length, headings[index + 1]?.index ?? section.length)
    const character: AiDraftCharacter = { name, profile: "", gender: "", traits: "", caption: "" }
    for (const line of splitBullets(body)) {
      const pair = splitKeyValue(line)
      if (!pair) {
        if (!character.profile) character.profile = line
        continue
      }
      if (pair.key.includes("プロフィール")) character.profile = pair.value
      else if (pair.key.includes("性別")) character.gender = readGender(pair.value)
      else if (pair.key.includes("特徴")) character.traits = pair.value
      else if (pair.key.includes("指示") || pair.key.includes("声")) character.caption = pair.value
      else if (!character.profile) character.profile = line
    }
    characters.push(character)
  }
  return characters
}

function parseOpening(section: string) {
  const events: AiDraftEvent[] = []
  for (const line of splitBullets(section)) {
    const pair = splitKeyValue(line)
    if (!pair || !pair.value) continue
    if (/^(ナレーション|描写|情景)/.test(pair.key)) {
      events.push({ type: "narration", text: pair.value })
    } else {
      events.push({ type: "dialogue", speaker: pair.key, text: pair.value })
    }
  }
  return events
}

export function parseAiScenario(markdown: string): AiDraft {
  const draft: AiDraft = { title: "", summary: "", premise: "", instructions: "", tags: "", characters: [], opening: [] }
  const sections = new Map<string, string[]>()
  let current: string | null = null
  for (const rawLine of markdown.replace(/\r/g, "").split("\n")) {
    // ### は登場人物名なのでセクション切り替えにしない。
    // 未知の ## 見出しは無視し、直前のセクションへの混入も止める。
    const heading = rawLine.match(/^#{1,2}(?!#)\s*(.+?)\s*$/)
    if (heading) {
      current = KNOWN_SECTIONS.has(heading[1].trim()) ? heading[1].trim() : null
      if (current && !sections.has(current)) sections.set(current, [])
      continue
    }
    if (current) sections.get(current)?.push(rawLine)
  }
  const textOf = (name: string) => (sections.get(name) ?? []).join("\n").trim()
  draft.title = textOf("タイトル").split("\n")[0].trim()
  draft.summary = textOf("あらすじ")
  draft.premise = textOf("前提")
  const instructions = textOf("指針")
  draft.instructions = instructions === "特になし" ? "" : instructions
  draft.tags = textOf("タグ").split("\n")[0].trim()
  draft.characters = parseCharacters(textOf("登場人物"))
  draft.opening = parseOpening(textOf("導入"))
  return draft
}

/** パース結果を新規下書きへ載せる。IDは衝突しないよう採番し、話者名をIDへ結び直す。 */
export function aiDraftToNewDraft(parsed: AiDraft, base: PackDraft): PackDraft {
  const characters = parsed.characters.map((character) => ({
    key: nextDraftKey(),
    id: "",
    name: character.name,
    profile: character.profile,
    image: null,
    voice: { gender: character.gender, description: "", traits: character.traits, caption: character.caption, seed: "", referenceAudio: null },
  }))
  for (const character of characters) {
    character.id = assignCharacterId(characters.filter((item) => item !== character && item.id))
  }
  const idOfName = new Map(characters.map((character) => [character.name, character.id]))
  return {
    ...base,
    title: parsed.title || base.title,
    summary: parsed.summary || base.summary,
    premise: parsed.premise || base.premise,
    instructions: parsed.instructions || base.instructions,
    tags: parsed.tags || base.tags,
    characters,
    opening: parsed.opening.map((event) => {
      if (event.type === "narration") return { key: nextDraftKey(), type: "narration" as const, text: event.text }
      const speaker = event.speaker === "あなた" ? "user" : (idOfName.get(event.speaker) ?? event.speaker)
      return { key: nextDraftKey(), type: "dialogue" as const, speaker, text: event.text }
    }),
  }
}
