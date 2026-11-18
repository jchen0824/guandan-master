// Takes the pictures a CI run made and saves them as the baselines in e2e/__screenshots__.
//   npm run screenshots:accept -- <run-id>        download the run's `playwright-report` artifact with gh, then accept
//   npm run screenshots:accept -- --from <dir>    accept the `*-actual.png` files under a local folder (a downloaded
//                                                 artifact, or a test-results folder from a run with CI=1)
// Look at the pictures before committing them: this script only moves them into place.
import { execFileSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const destination = join(root, "e2e", "__screenshots__")

/** The project names in playwright.config.ts. A test-results folder is named `<file>-<title>-<project>[-retryN]`. */
export function projectNames(config) {
  return [...config.matchAll(/\bname:\s*"([^"]+)"/g)].map((match) => match[1])
}

/** Which project and picture an `-actual.png` is, from its path, or undefined when it is not one of ours. */
export function locate(file, projects) {
  const name = basename(file)
  if (!name.endsWith("-actual.png")) return undefined
  const folder = basename(dirname(file)).replace(/-retry\d+$/, "")
  const project = projects.find((candidate) => folder.endsWith(`-${candidate}`))
  if (!project) return undefined
  return { project, picture: name.replace(/-actual\.png$/, ".png") }
}

function* walk(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else yield path
  }
}

/** Copies every picture under `folder` to its place and returns what it did, one line each. */
export function accept(folder, projects) {
  const lines = []
  const seen = new Map()
  for (const file of walk(folder)) {
    const found = locate(file, projects)
    if (found) seen.set(`${found.project}/${found.picture}`, { ...found, file })
  }
  for (const { project, picture, file } of seen.values()) {
    const target = join(destination, project, picture)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(file, target)
    lines.push(`${relative(root, target)}  <-  ${file}`)
  }
  return lines
}

function main(args) {
  const from = args[0] === "--from" ? args[1] : undefined
  const runId = from ? undefined : args[0]
  if (!from && !runId) {
    console.error("usage: npm run screenshots:accept -- <run-id>\n       npm run screenshots:accept -- --from <folder>")
    process.exit(1)
  }
  const projects = projectNames(readFileSync(join(root, "playwright.config.ts"), "utf8"))
  let folder = from && resolve(from)
  let temp
  if (runId) {
    temp = mkdtempSync(join(tmpdir(), "playwright-report-"))
    execFileSync("gh", ["run", "download", runId, "-n", "playwright-report", "-D", temp], { stdio: "inherit" })
    folder = temp
  }
  try {
    const lines = accept(folder, projects)
    if (lines.length === 0) {
      console.error(`no *-actual.png found under ${folder}. A run that failed for another reason has none; see its report.`)
      process.exit(1)
    }
    console.log(lines.join("\n"))
    console.log(`\n${lines.length} picture(s) saved under e2e/__screenshots__. Look at them, then commit.`)
  } finally {
    if (temp) rmSync(temp, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
