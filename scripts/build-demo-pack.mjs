import { copyFile, readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { zipSync } from "fflate"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourceRoot = path.join(projectRoot, "examples/rainy-cafe")
const outputDirectory = path.join(projectRoot, "src/renderer/assets/examples")
const publicSchemaDirectory = path.join(projectRoot, "public/schema")

const files = {
  "pack.json": new Uint8Array(await readFile(path.join(sourceRoot, "pack.json"))),
  "assets/cover-main.webp": new Uint8Array(await readFile(path.join(sourceRoot, "assets/cover-main.webp"))),
  "assets/aoi.webp": new Uint8Array(await readFile(path.join(sourceRoot, "assets/aoi.webp"))),
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(path.join(outputDirectory, "rainy-cafe.mikanchat"), zipSync(files, { level: 6, mtime: new Date("1980-01-01T00:00:00Z") }))
await mkdir(publicSchemaDirectory, { recursive: true })
await copyFile(path.join(projectRoot, "schema/chat-pack-0.1.json"), path.join(publicSchemaDirectory, "chat-pack-0.1.json"))
