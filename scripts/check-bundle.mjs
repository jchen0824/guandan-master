// Fails when the production bundle outgrows its budget. Run after `npm run build`.
// A jump here usually means a heavy dependency or a root import that defeated tree shaking.
// To raise a budget on purpose, change the number in the same pull request and say why.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

// The CSS budget went from 20 to 21 kB when the mahjong table got a square 牌河 on upright phones and rules with
// example tiles: together they came to 20,515 bytes, 35 over, with no unused styles left to remove.
const BUDGET_KB = { js: 185, css: 21 }

const assets = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "dist", "assets")
if (!existsSync(assets)) {
  console.error("dist/assets not found. Run `npm run build` first.")
  process.exit(1)
}

const total = { js: 0, css: 0 }
for (const name of readdirSync(assets)) {
  const kind = name.endsWith(".js") ? "js" : name.endsWith(".css") ? "css" : null
  if (kind) total[kind] += gzipSync(readFileSync(join(assets, name))).length
}

let failed = false
for (const kind of ["js", "css"]) {
  const kb = total[kind] / 1024
  const over = kb > BUDGET_KB[kind]
  failed ||= over
  console.log(`${over ? "✗" : "✓"} ${kind}: ${kb.toFixed(1)} kB gzipped (budget ${BUDGET_KB[kind]} kB)`)
}
if (failed) {
  console.error("\nBundle is over budget. Look for a new dependency or a root import; see scripts/check-bundle.mjs.")
  process.exit(1)
}
