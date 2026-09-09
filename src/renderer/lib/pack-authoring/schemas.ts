import { z } from "zod"

const nonEmptyString = (label: string) =>
  z.string({ error: `${label}を入力してください` })
    .min(1, `${label}を入力してください`)
    .regex(/\S/, `${label}を入力してください`)

const localId = (label: string) =>
  z.string({ error: `${label}を入力してください` }).regex(
    /^[a-z][a-z0-9-]{0,63}$/,
    `${label}は半角小文字・数字・- で入力してください`,
  )

const assetPath = z.string().regex(
  /^assets\/[a-z0-9][a-z0-9.-]*(?:\/[a-z0-9][a-z0-9.-]*)*$/,
  "素材パスが不正です",
)

const voiceProfileSchema = z.object({
  language: z.string().optional(),
  gender: z.enum(["male", "female"], { error: "声の性別を選んでください" }).optional(),
  description: z.string().max(1000, "声の説明が長すぎます").optional(),
  traits: z.array(nonEmptyString("声の特徴")).max(12, "声の特徴は12個までです").optional(),
  speed: z.number().positive("話速は0より大きくしてください").optional(),
  pitch: z.number().optional(),
}).passthrough()

const referenceAudioSchema = z.object({
  asset: assetPath,
  transcript: z.string().max(2000, "参照音声の文面が長すぎます").optional(),
  language: z.string().optional(),
  creator: z.string().max(200, "作成者名が長すぎます").optional(),
  source: z.string().url("参照元URLが不正です").optional(),
  license: z.string().max(500, "ライセンス表記が長すぎます").optional(),
}).passthrough()

const preferredVoiceSchema = z.object({
  provider: nonEmptyString("プロバイダー"),
  voiceId: nonEmptyString("声ID"),
  parameters: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

const voiceSchema = z.object({
  profile: voiceProfileSchema.optional(),
  referenceAudio: referenceAudioSchema.optional(),
  preferred: z.array(preferredVoiceSchema).optional(),
}).passthrough()

const characterSchema = z.object({
  id: localId("キャラクターID"),
  name: nonEmptyString("キャラクター名").max(60, "キャラクター名が長すぎます"),
  profile: nonEmptyString("プロフィール").max(2000, "プロフィールが長すぎます"),
  image: assetPath.optional(),
  voice: voiceSchema.optional(),
}).passthrough()

const narrationEventSchema = z.object({
  type: z.literal("narration"),
  text: nonEmptyString("本文").max(4096, "本文が長すぎます"),
  image: assetPath.optional(),
}).passthrough()

const dialogueEventSchema = z.object({
  type: z.literal("dialogue"),
  speaker: localId("話者"),
  text: nonEmptyString("セリフ").max(4096, "セリフが長すぎます"),
  image: assetPath.optional(),
}).passthrough()

const openingEventSchema = z.union([narrationEventSchema, dialogueEventSchema])

const discoverySchema = z.object({
  covers: z.array(assetPath).max(4, "カバーは4枚までです").optional(),
  tags: z.array(nonEmptyString("タグ")).max(12, "タグは12個までです").optional(),
  description: z.string().max(2000, "説明が長すぎます").optional(),
  authorComment: z.string().max(2000, "作者コメントが長すぎます").optional(),
}).passthrough()

const plotSchema = z.object({
  premise: nonEmptyString("前提").max(4000, "前提が長すぎます"),
  instructions: z.string().max(8000, "指針が長すぎます").optional(),
  characters: z.array(characterSchema).min(1, "登場人物を1人以上追加してください").max(8, "登場人物は8人までです"),
  opening: z.array(openingEventSchema).min(1, "導入を1件以上追加してください").max(60, "導入は60件までです"),
}).passthrough().superRefine((plot, context) => {
  const ids = new Set(plot.characters.map((character) => character.id))
  plot.opening.forEach((event, index) => {
    if (event.type === "dialogue" && event.speaker !== "user" && !ids.has(event.speaker)) {
      context.addIssue({
        code: "custom",
        message: `導入${index + 1}件目の話者は登場人物のIDか user にしてください`,
        path: ["opening", index, "speaker"],
      })
    }
  })
  const speakers = new Set(
    plot.opening.filter((event) => event.type === "dialogue").map((event) => event.speaker),
  )
  if (![...speakers].some((speaker) => speaker !== "user")) {
    context.addIssue({ code: "custom", message: "キャラクターのセリフを1件以上入れてください", path: ["opening"] })
  }
})

export const chatPackSchema = z.object({
  spec: z.literal("mikan.chat-pack"),
  specVersion: z.literal("0.1"),
  id: z.string().uuid("IDが不正です"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "バージョンは 1.0.0 の形式にしてください"),
  language: z.string().min(1, "言語を入力してください"),
  title: nonEmptyString("タイトル").max(80, "タイトルが長すぎます"),
  summary: nonEmptyString("あらすじ").max(500, "あらすじが長すぎます"),
  author: z.object({
    name: nonEmptyString("作者名").max(80, "作者名が長すぎます"),
    url: z.string().url("作者URLが不正です").optional().or(z.literal("")),
  }).passthrough(),
  license: nonEmptyString("ライセンス").max(80, "ライセンスが長すぎます"),
  licenseNotice: z.string().max(2000, "ライセンス注記が長すぎます").optional(),
  rating: z.enum(["all", "r15", "r18"], { error: "対象年齢を選んでください" }),
  discovery: discoverySchema,
  plot: plotSchema,
}).passthrough()

export type ChatPackInput = z.input<typeof chatPackSchema>
export type ChatPackOutput = z.output<typeof chatPackSchema>

export function formatPackIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  const seen = new Set<string>()
  const issues: Array<{ path: string; message: string }> = []
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".") || "(全体)"
    const key = `${path}\n${issue.message}`
    if (seen.has(key)) continue
    seen.add(key)
    issues.push({ path, message: issue.message })
  }
  return issues
}
