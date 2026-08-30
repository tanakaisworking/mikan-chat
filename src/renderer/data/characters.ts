import aoiStage from "@/assets/characters/optimized-output/images/aoi-stage-optimized.webp"
import aoiWelcome from "@/assets/characters/optimized-output/images/aoi-welcome-optimized.webp"
import koharuStage from "@/assets/characters/optimized-output/images/koharu-stage-optimized.webp"
import miaStage from "@/assets/characters/optimized-output/images/mia-stage-optimized.webp"
import rinStage from "@/assets/characters/optimized-output/images/rin-stage-optimized.webp"
import shizukuStage from "@/assets/characters/optimized-output/images/shizuku-stage-optimized.webp"

export type Character = {
  id: string
  name: string
  description: string
  lastMessage: string
  lastActive: string
  image: string
}

export const characters: Character[] = [
  {
    id: "aoi",
    name: "葵",
    description: "穏やかな夜を一緒に過ごす、少し世話焼きな幼なじみ。",
    lastMessage: "おかえり。今日は少し遅かったね。",
    lastActive: "12分前",
    image: aoiStage,
  },
  {
    id: "mia",
    name: "ミア",
    description: "異世界の酒場で働く、落ち着いた銀髪のエルフ。",
    lastMessage: "また酒場に来てくれたのね。",
    lastActive: "昨日",
    image: miaStage,
  },
  {
    id: "rin",
    name: "凛",
    description: "静かに話を聞いてくれる、知的で頼れる先輩。",
    lastMessage: "今日はどんな一日だった？",
    lastActive: "3日前",
    image: rinStage,
  },
  {
    id: "koharu",
    name: "こはる",
    description: "小さなアトリエで絵を描く、明るく好奇心旺盛な友人。",
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
