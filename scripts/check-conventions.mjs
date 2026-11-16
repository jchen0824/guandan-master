// Repo rules that a linter cannot express. Run with `npm run check:conventions`.
// Every failure names the file, the rule and the fix, so an agent can act on it without more context.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const failures = []
const fail = (file, rule, fix) => failures.push({ file, rule, fix })
const read = (path) => readFileSync(join(root, path), "utf8")
const exists = (path) => existsSync(join(root, path))

function walk(dir, keep) {
  const out = []
  for (const name of readdirSync(join(root, dir))) {
    const path = join(dir, name)
    if (statSync(join(root, path)).isDirectory()) out.push(...walk(path, keep))
    else if (keep(path)) out.push(path)
  }
  return out
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length

// 1. ui-sdk ships these widgets. A hand-written role means its keyboard and focus handling is missing.
const WIDGET_ROLES =
  /role=\{?["'](alertdialog|checkbox|combobox|dialog|listbox|menu|menubar|menuitem|option|radio|radiogroup|separator|slider|switch|tab|tablist|tabpanel|toolbar|tooltip|tree|treeitem)["']/g
for (const file of walk("src", (p) => p.endsWith(".tsx"))) {
  const text = read(file)
  for (const match of text.matchAll(WIDGET_ROLES)) {
    fail(
      `${file}:${lineOf(text, match.index)}`,
      `hand-written role="${match[1]}"`,
      "Use the @ui-sdk/react component for this widget. The list is in node_modules/@ui-sdk/core/skills/ui-sdk/references/build-interface.md.",
    )
  }
}

// 2. The engine stays deterministic: randomness comes in as a parameter so tests can seed it.
for (const file of ["src/engine", "src/holdem"].flatMap((dir) => walk(dir, (p) => p.endsWith(".ts") && !p.endsWith(".test.ts")))) {
  const text = read(file)
  for (const match of text.matchAll(/Math\.random\(|Date\.now\(/g)) {
    fail(
      `${file}:${lineOf(text, match.index)}`,
      `${match[0]}) called inside the engine`,
      "Take the value as a parameter with a default, as `random: () => number = Math.random` in newMatch and advise.",
    )
  }
}

// 3. The stylesheet keeps ui-sdk's styles in their own layer, below the app's.
if (!read("src/index.css").trimStart().startsWith("@layer ui-sdk;")) {
  fail("src/index.css", "missing layer declaration", "Keep `@layer ui-sdk;` as the first line of the stylesheet.")
}

// 4. Browser storage keys are namespaced and documented.
const agents = exists("AGENTS.md") ? read("AGENTS.md") : ""
for (const file of walk("src", (p) => /\.tsx?$/.test(p))) {
  const text = read(file)
  for (const match of text.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`]+)["'`]/g)) {
    if (!match[1].startsWith("guandan.")) {
      fail(`${file}:${lineOf(text, match.index)}`, `storage key "${match[1]}"`, "Prefix browser storage keys with `guandan.`.")
    }
  }
  for (const match of text.matchAll(/["'`](guandan\.[a-zA-Z0-9_.-]+)["'`]/g)) {
    if (!agents.includes(`\`${match[1]}\``)) {
      fail(`${file}:${lineOf(text, match.index)}`, `storage key "${match[1]}" is not documented`, "Add the key to the storage list in AGENTS.md.")
    }
  }
}

// 5. Agent instructions live in AGENTS.md; other agent files only point at it.
if (!exists("AGENTS.md")) fail("AGENTS.md", "file is missing", "AGENTS.md is the single source of agent instructions. Restore it.")
if (!exists("CLAUDE.md") || read("CLAUDE.md").trim() !== "@AGENTS.md") {
  fail("CLAUDE.md", "must contain only `@AGENTS.md`", "Put instructions in AGENTS.md and leave CLAUDE.md as the one-line import.")
}

// 6. Every skill has the frontmatter agents use to discover it, and AGENTS.md points at it.
const SKILLS = ".agents/skills"
if (exists(SKILLS)) {
  for (const name of readdirSync(join(root, SKILLS))) {
    const file = `${SKILLS}/${name}/SKILL.md`
    if (!statSync(join(root, SKILLS, name)).isDirectory()) continue
    if (!exists(file)) {
      fail(file, "file is missing", "Each folder in .agents/skills needs a SKILL.md.")
      continue
    }
    const front = /^---\n([\s\S]*?)\n---\n/.exec(read(file))
    const field = (key) => new RegExp(`^${key}:\\s*(.+)$`, "m").exec(front?.[1] ?? "")?.[1].trim()
    if (field("name") !== name) fail(file, "frontmatter `name` must equal the folder name", `Set \`name: ${name}\`.`)
    if (!field("description")) fail(file, "frontmatter `description` is missing", "Describe when an agent should load the skill.")
    if (!agents.includes(file)) fail("AGENTS.md", `does not mention ${file}`, "Link the skill from the Skills section of AGENTS.md.")
  }
}

// 7. Relative links in the docs resolve.
const docs = [
  ...["AGENTS.md", "CONTRIBUTING.md", "CHANGELOG.md", "README.md", "README.en.md", ".github/pull_request_template.md"].filter(exists),
  ...(exists(SKILLS) ? walk(SKILLS, (p) => p.endsWith(".md")) : []),
]
for (const file of docs) {
  const text = read(file)
  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1].split("#")[0]
    if (!target || /^[a-z]+:/.test(target)) continue
    const path = relative(root, resolve(root, dirname(file), target))
    if (!exists(path)) fail(`${file}:${lineOf(text, match.index)}`, `broken link to ${match[1]}`, "Fix the path or remove the link.")
  }
}

// 8. The two READMEs stay a pair.
if (exists("README.md") && exists("README.en.md")) {
  if (!read("README.md").includes("(README.en.md)")) fail("README.md", "no link to the English README", "Keep the language switcher line at the top.")
  if (!read("README.en.md").includes("(README.md)")) fail("README.en.md", "no link to the Chinese README", "Keep the language switcher line at the top.")
}

// 9. Every version has its changelog entry, so a release never ships without notes.
const { version } = JSON.parse(read("package.json"))
if (!exists("CHANGELOG.md") || !read("CHANGELOG.md").includes(`\n## [${version}] - `)) {
  fail(
    "CHANGELOG.md",
    `no section for version ${version}`,
    `Add "## [${version}] - YYYY-MM-DD" above the previous release and list what changed for players.`,
  )
}

if (failures.length > 0) {
  for (const f of failures) console.error(`✗ ${f.file}\n    ${f.rule}\n    Fix: ${f.fix}`)
  console.error(`\n${failures.length} convention ${failures.length === 1 ? "problem" : "problems"}.`)
  process.exit(1)
}
console.log("Conventions OK.")
