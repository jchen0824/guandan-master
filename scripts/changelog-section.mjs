// Prints the CHANGELOG.md section for one version, for use as GitHub Release notes.
//   node scripts/changelog-section.mjs 0.1.0
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export function section(version) {
  const lines = readFileSync(join(root, "CHANGELOG.md"), "utf8").split("\n")
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`))
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith("## ["))
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2]
  const text = version ? section(version) : null
  if (!text) {
    console.error(`CHANGELOG.md has no section "## [${version ?? "<version>"}]".`)
    process.exit(1)
  }
  console.log(text)
}
