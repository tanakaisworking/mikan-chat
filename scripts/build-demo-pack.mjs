import { copyFile, readFile, readdir, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { zipSync } from "fflate"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = path.join(projectRoot, "src/renderer/assets/examples")
const publicSchemaDirectory = path.join(projectRoot, "public/schema")

const packs = [
  { directory: "rainy-cafe", fileName: "rainy-cafe.mikanchat", assets: ["cover-main.webp", "aoi.webp"] },
  { directory: "atelier-unknown-portrait", fileName: "atelier-unknown-portrait.mikanchat", assets: ["cover-main.webp"] },
  { directory: "late-night-radio", fileName: "late-night-radio.mikanchat", assets: ["cover-main.webp"] },
  { directory: "storm-observatory", fileName: "storm-observatory.mikanchat", assets: ["cover-main.webp"] },
  { directory: "friday-flower-shop", fileName: "friday-flower-shop.mikanchat", assets: ["cover-main.webp"] },
  { directory: "grandmother-house", fileName: "grandmother-house.mikanchat", assets: ["cover-main.webp"] },
  { directory: "downer-girl-first-love", fileName: "downer-girl-first-love.mikanchat", assets: ["cover-main.webp"] },
  { directory: "contract-honest-duke", fileName: "contract-honest-duke.mikanchat", assets: ["cover-main.webp"] },
  { directory: "midnight-fox-convenience", fileName: "midnight-fox-convenience.mikanchat", assets: ["cover-main.webp"] },
  { directory: "fake-date-wedding", fileName: "fake-date-wedding.mikanchat", assets: ["cover-main.webp"] },
  { directory: "voice-memory-android", fileName: "voice-memory-android.mikanchat", assets: ["cover-main.webp"] },
  { directory: "rewind-accomplice-guard", fileName: "rewind-accomplice-guard.mikanchat", assets: ["cover-main.webp"] },
  { directory: "forgotten-rules-apartment", fileName: "forgotten-rules-apartment.mikanchat", assets: ["cover-main.webp"] },
  { directory: "demon-queen-diner", fileName: "demon-queen-diner.mikanchat", assets: ["cover-main.webp"] },
  { directory: "dragon-nursery-caretaker", fileName: "dragon-nursery-caretaker.mikanchat", assets: ["cover-main.webp"] },
  { directory: "rainy-ronin-escort", fileName: "rainy-ronin-escort.mikanchat", assets: ["cover-main.webp"] },
  { directory: "game-shutdown-last-npc", fileName: "game-shutdown-last-npc.mikanchat", assets: ["cover-main.webp"] },
  { directory: "lost-sock-witch", fileName: "lost-sock-witch.mikanchat", assets: ["cover-main.webp"] },
  { directory: "memory-pawnshop-detective", fileName: "memory-pawnshop-detective.mikanchat", assets: ["cover-main.webp"] },
  { directory: "retirement-rival-boxer", fileName: "retirement-rival-boxer.mikanchat", assets: ["cover-main.webp"] },
  { directory: "palace-poison-taster", fileName: "palace-poison-taster.mikanchat", assets: ["cover-main.webp"] },
  { directory: "final-live-new-song", fileName: "final-live-new-song.mikanchat", assets: ["cover-main.webp"] },
  { directory: "museum-thief-counsel", fileName: "museum-thief-counsel.mikanchat", assets: ["cover-main.webp"] },
  { directory: "last-shared-apartment", fileName: "last-shared-apartment.mikanchat", assets: ["cover-main.webp"] },
  { directory: "opposing-lawyers-alliance", fileName: "opposing-lawyers-alliance.mikanchat", assets: ["cover-main.webp"] },
  { directory: "stream-off-real-name", fileName: "stream-off-real-name.mikanchat", assets: ["cover-main.webp"] },
  { directory: "sunken-observatory-radio", fileName: "sunken-observatory-radio.mikanchat", assets: ["cover-main.webp"] },
  { directory: "last-train-manifest", fileName: "last-train-manifest.mikanchat", assets: ["cover-main.webp"] },
  { directory: "embroidered-family-tree", fileName: "embroidered-family-tree.mikanchat", assets: ["cover-main.webp"] },
  { directory: "unscripted-riverside-walk", fileName: "unscripted-riverside-walk.mikanchat", assets: ["cover-main.webp"] },
  { directory: "mapless-town-delivery", fileName: "mapless-town-delivery.mikanchat", assets: ["cover-main.webp"] },
  { directory: "retired-hero-career", fileName: "retired-hero-career.mikanchat", assets: ["cover-main.webp"] },
  { directory: "reaper-extra-day-audit", fileName: "reaper-extra-day-audit.mikanchat", assets: ["cover-main.webp"] },
  { directory: "mars-last-flower", fileName: "mars-last-flower.mikanchat", assets: ["cover-main.webp"] },
  { directory: "dream-nightmare-auction", fileName: "dream-nightmare-auction.mikanchat", assets: ["cover-main.webp"] },
  { directory: "resigning-wizard-handover", fileName: "resigning-wizard-handover.mikanchat", assets: ["cover-main.webp"] },
  { directory: "voiceless-rakugo-new-story", fileName: "voiceless-rakugo-new-story.mikanchat", assets: ["cover-main.webp"] },
  { directory: "tomorrow-forecast-name", fileName: "tomorrow-forecast-name.mikanchat", assets: ["cover-main.webp"] },
  { directory: "hundred-year-castle-conservator", fileName: "hundred-year-castle-conservator.mikanchat", assets: ["cover-main.webp"] },
  { directory: "future-letter-post-office", fileName: "future-letter-post-office.mikanchat", assets: ["cover-main.webp"] },
  { directory: "ghost-full-apartment", fileName: "ghost-full-apartment.mikanchat", assets: ["cover-main.webp"] },
  { directory: "ai-final-word", fileName: "ai-final-word.mikanchat", assets: ["cover-main.webp"] },
  { directory: "moon-convenience-delay", fileName: "moon-convenience-delay.mikanchat", assets: ["cover-main.webp"] },
  { directory: "dragon-bathhouse", fileName: "dragon-bathhouse.mikanchat", assets: ["cover-main.webp"] },
  { directory: "retirement-shogi-mystery", fileName: "retirement-shogi-mystery.mikanchat", assets: ["cover-main.webp"] },
  { directory: "edo-cold-well-smoke", fileName: "edo-cold-well-smoke.mikanchat", assets: ["cover-main.webp"] },
  { directory: "palace-unordered-dish", fileName: "palace-unordered-dish.mikanchat", assets: ["cover-main.webp"] },
  { directory: "aquarium-sleepless-jellyfish", fileName: "aquarium-sleepless-jellyfish.mikanchat", assets: ["cover-main.webp"] },
  { directory: "chef-imperfect-dish", fileName: "chef-imperfect-dish.mikanchat", assets: ["cover-main.webp"] },
  { directory: "former-partner-repaired-chair", fileName: "former-partner-repaired-chair.mikanchat", assets: ["cover-main.webp"] },
  { directory: "rain-missing-footsteps", fileName: "rain-missing-footsteps.mikanchat", assets: ["cover-main.webp"] },
]

await mkdir(outputDirectory, { recursive: true })
for (const pack of packs) {
  const sourceRoot = path.join(projectRoot, "examples", pack.directory)
  const files = {
    "pack.json": new Uint8Array(await readFile(path.join(sourceRoot, "pack.json"))),
  }
  const discoveredAssets = (await readdir(path.join(sourceRoot, "assets"))).filter((asset) => /\.(?:webp|png|jpe?g|wav|mp3|flac|m4a|mp4)$/i.test(asset))
  for (const asset of new Set([...pack.assets, ...discoveredAssets])) {
    files[`assets/${asset}`] = new Uint8Array(await readFile(path.join(sourceRoot, "assets", asset)))
  }
  await writeFile(path.join(outputDirectory, pack.fileName), zipSync(files, { level: 6, mtime: new Date("1980-01-01T00:00:00Z") }))
}
await mkdir(publicSchemaDirectory, { recursive: true })
await copyFile(path.join(projectRoot, "schema/chat-pack-0.1.json"), path.join(publicSchemaDirectory, "chat-pack-0.1.json"))
