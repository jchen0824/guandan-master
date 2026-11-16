// Checks Conventional Commits. The rules are in CONTRIBUTING.md.
//   node scripts/check-commits.mjs "feat(ui): add a pile counter"   check the given subjects
//   PR_TITLE="..." node scripts/check-commits.mjs                     check a pull request title
//   node scripts/check-commits.mjs --range origin/main..HEAD         check every commit in a range
import { execFileSync } from "node:child_process"

export const TYPES = ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"]
export const SCOPES = ["engine", "holdem", "bot", "ui", "agents", "ci", "deps"]
const MAX = 72

export function problems(subject) {
  const out = []
  const match = /^([a-z]+)(?:\(([^)]*)\))?(!)?: (.+)$/.exec(subject)
  if (!match) return [`must look like "<type>(<scope>): <summary>", for example "fix(bot): hold bombs until late"`]
  const [, type, scope, , summary] = match
  if (!TYPES.includes(type)) out.push(`type "${type}" is not one of: ${TYPES.join(", ")}`)
  if (scope !== undefined && !SCOPES.includes(scope)) out.push(`scope "${scope}" is not one of: ${SCOPES.join(", ")} (or leave the scope out)`)
  if (/^[A-Z]/.test(summary)) out.push("summary must start in lower case")
  if (/[.。]$/.test(summary)) out.push("summary must not end with a full stop")
  if (subject.length > MAX) out.push(`subject is ${subject.length} characters; the limit is ${MAX}`)
  return out
}

function subjects() {
  const args = process.argv.slice(2)
  const range = args.indexOf("--range")
  if (range !== -1) {
    const log = execFileSync("git", ["log", "--no-merges", "--format=%s", args[range + 1]], { encoding: "utf8" })
    return log.split("\n").filter(Boolean)
  }
  if (args.length > 0) return args
  return process.env.PR_TITLE ? [process.env.PR_TITLE] : []
}

const list = subjects()
if (list.length === 0) {
  console.error("Nothing to check. Pass subjects, set PR_TITLE, or use --range <git range>.")
  process.exit(1)
}
let bad = 0
for (const subject of list) {
  const found = problems(subject)
  if (found.length === 0) {
    console.log(`✓ ${subject}`)
    continue
  }
  bad++
  console.error(`✗ ${subject}`)
  for (const problem of found) console.error(`    ${problem}`)
}
if (bad > 0) {
  console.error("\nSee the Commits section of CONTRIBUTING.md.")
  process.exit(1)
}
