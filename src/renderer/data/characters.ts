import aoiStage from "@/assets/characters/optimized-output/images/aoi-stage-optimized.webp"
import aoiWelcome from "@/assets/characters/optimized-output/images/aoi-welcome-optimized.webp"
import koharuStage from "@/assets/characters/optimized-output/images/koharu-stage-optimized.webp"
import miaStage from "@/assets/characters/optimized-output/images/mia-stage-optimized.webp"
import rinStage from "@/assets/characters/optimized-output/images/rin-stage-optimized.webp"
import shizukuStage from "@/assets/characters/optimized-output/images/shizuku-stage-optimized.webp"

export type Character = {
  id: string
  name: string
  packTitle?: string
  tags?: string[]
  conversationLabel?: string
  description: string
  lastMessage: string
  lastActive: string
  image?: string
  stageImage?: string
  pack?: Record<string, unknown>
  opening?: Array<{
    role: "narration" | "character" | "user"
    text: string
    speakerName?: string
    image?: string
  }>
}

export const characters: Character[] = [
  {
    id: "aoi",
    name: "葵",
    packTitle: "雨の夜、幼なじみの部屋で",
    description: "終電を逃した夜。久しぶりに会った幼なじみと、雨音を聞きながら二人きりになる。",
    tags: ["日常", "幼なじみ", "雨の夜"],
    conversationLabel: "1人と会話",
    lastMessage: "おかえり。今日は少し遅かったね。",
    lastActive: "12分前",
    image: aoiStage,
  },
  {
    id: "mia",
    name: "ミア",
    packTitle: "閉店後の酒場で、秘密の依頼を",
    description: "異世界の酒場で最後の客になったあなたへ、エルフの店主が人には言えない依頼を持ちかける。",
    tags: ["異世界", "ファンタジー", "冒険"],
    conversationLabel: "1人と会話",
    lastMessage: "また酒場に来てくれたのね。",
    lastActive: "昨日",
    image: miaStage,
  },
  {
    id: "rin",
    name: "凛",
    packTitle: "放課後の図書室に閉じ込められて",
    description: "突然の停電で扉が開かない。静かな先輩と二人、迎えを待つあいだに距離が近づいていく。",
    tags: ["学園", "先輩", "青春"],
    conversationLabel: "1人と会話",
    lastMessage: "今日はどんな一日だった？",
    lastActive: "3日前",
    image: rinStage,
  },
  {
    id: "koharu",
    name: "こはる",
    packTitle: "絵のモデルを頼まれた午後",
    description: "友人のアトリエを訪ねると、次の作品のモデルになってほしいと突然お願いされる。",
    tags: ["日常", "友人", "創作"],
    conversationLabel: "1人と会話",
    lastMessage: "新しい絵、見ていかない？",
    lastActive: "8月24日",
    image: koharuStage,
  },
]

export const assets = {
  aoiStage,
  aoiWelcome,
  shizukuStage,
}
