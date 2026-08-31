import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import Ajv2020 from "ajv/dist/2020.js"
import standaloneCode from "ajv/dist/standalone/index.js"

const root = process.cwd()
const schema = JSON.parse(readFileSync(path.join(root, "schema/chat-pack-0.1.json"), "utf8"))
const ajv = new Ajv2020({ allErrors: true, strict: false, code: { source: true, esm: true } })
ajv.addFormat("uuid", /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i)
ajv.addFormat("uri", /^[A-Za-z][A-Za-z0-9+.-]*:\S+$/)
const outputDirectory = path.join(root, "src/renderer/lib/generated")
const generated = standaloneCode(ajv, ajv.compile(schema))
  .replace(
    /const (func\d+) = require\("ajv\/dist\/runtime\/ucs2length"\)\.default;/,
    'const $1 = (value) => [...value].length;',
  )
  .replace(
    /const (func\d+) = require\("ajv\/dist\/runtime\/equal"\)\.default;/,
    'const $1 = (left, right) => JSON.stringify(left) === JSON.stringify(right);',
  )

if (/\brequire\(|new Function/.test(generated)) {
  throw new Error("生成したvalidatorにCSP非互換コードが残っています。")
}

mkdirSync(outputDirectory, { recursive: true })
writeFileSync(path.join(outputDirectory, "chat-pack-validator.js"), generated)
