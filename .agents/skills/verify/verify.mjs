#!/usr/bin/env node
// Drives the production build in Mobile Safari inside the iOS Simulator on this Mac, for the verify skill
// (SKILL.md beside this file says when and how). Run it from the repo root:
//
//   node .agents/skills/verify/verify.mjs launch                   build, serve the build, boot an iPhone
//   node .agents/skills/verify/verify.mjs doctor                   is this instance worth driving?
//   node .agents/skills/verify/verify.mjs open mahjong [options]   open a game in Mobile Safari
//   node .agents/skills/verify/verify.mjs press "打出"             press the button with that name
//   node .agents/skills/verify/verify.mjs proof <name>             save a screenshot and what the page reports
//   node .agents/skills/verify/verify.mjs cleanup                  stop what launch started; the proofs stay
//
// Options of `open`: --fixture <name> starts from e2e/fixtures/<name>.json, --seed <n> makes the deal
// repeatable, --view 2d|3d picks the 掼蛋 table, --fresh clears the page's storage first.
//
// Nothing can run a script in that browser from outside, so the server puts e2e/page-tools.js and a small
// reporter into the page. Once a second the page posts what `guandanQa` sees (the state, the layout
// problems, the coach's words, script errors) and `proof` saves the latest post beside the screenshot.
// `press` goes the other way: the page picks the name up with its next post and clicks that button.
import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const PORT = Number(process.env.VERIFY_PORT ?? 4175)
const ORIGIN = `http://127.0.0.1:${PORT}`
const OUT = resolve("verify-out")
const STATE = join(OUT, ".instance.json")
const LATEST = join(OUT, ".latest.json")
const DIST = resolve("dist")
const GAMES = ["home", "guandan", "holdem", "mahjong"]
const SAVE_KEYS = { guandan: "guandan.match", holdem: "guandan.holdem.table", mahjong: "guandan.mahjong.match" }
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2" }

const run = (file, args, options = {}) => execFileSync(file, args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...options })?.trim() ?? ""
const simctl = (...args) => run("xcrun", ["simctl", ...args])
const instance = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null)
const latestReport = () => (existsSync(LATEST) ? JSON.parse(readFileSync(LATEST, "utf8")) : null)
const fail = (message) => {
  console.error(`verify: ${message}`)
  process.exit(1)
}
const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
const health = async () => {
  try {
    return await (await fetch(`${ORIGIN}/qa-health`)).json()
  } catch {
    return null
  }
}
const commit = () => run("git", ["rev-parse", "--short", "HEAD"])
const builtAt = () => (existsSync(join(DIST, "index.html")) ? statSync(join(DIST, "index.html")).mtimeMs : 0)

/** Runs in the page ahead of the app. It is turned into text, so it uses nothing from this file but its argument. */
function reporter(setup) {
  const query = new URLSearchParams(location.search)
  if (query.has("qa")) {
    sessionStorage.setItem("qa-visit", query.get("qa"))
    if (setup.fresh) localStorage.clear()
    if (setup.game === "home") localStorage.removeItem("guandan.game")
    else localStorage.setItem("guandan.game", setup.game)
    if (setup.view) localStorage.setItem("guandan.view", setup.view)
    if (setup.save) localStorage.setItem(setup.saveKey, setup.save)
    if (setup.seed !== null) window.guandanQa.seed(setup.seed)
    // The setup is for this load only: with the query gone, a reload in Safari resumes like a player's would.
    history.replaceState(null, "", "/")
  }
  const errors = []
  window.addEventListener("error", (event) => errors.push(String(event.message)))
  window.addEventListener("unhandledrejection", (event) => errors.push(String(event.reason)))
  let done = null
  /** Presses the button a player would call by this name: its label or its words. One in an open dialog wins. */
  function pressButton(name) {
    const called = (el) => el.getAttribute("aria-label") ?? el.textContent.replace(/\s+/g, " ").trim()
    const usable = [...document.querySelectorAll('button, [role="button"], a[href]')].filter((el) => !el.disabled && el.getAttribute("aria-disabled") !== "true" && el.getClientRects().length > 0)
    const matches = usable.filter((el) => called(el) === name)
    const target = matches.find((el) => el.closest('[role="dialog"]')) ?? matches[matches.length - 1]
    if (!target) return `no button called ${name}. On screen: ${[...new Set(usable.map(called))].join(" | ")}`
    target.click()
    return "pressed"
  }
  const text = (selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() ?? null
  setInterval(() => {
    const coach = document.querySelector('[data-slot="mj-coach"], [data-slot="he-coach"], [data-slot="coach"]')
    const report = {
      visit: sessionStorage.getItem("qa-visit"),
      at: new Date().toISOString(),
      game: localStorage.getItem("guandan.game") ?? "home",
      viewport: { width: window.innerWidth, height: window.innerHeight, ratio: window.devicePixelRatio },
      userAgent: navigator.userAgent,
      state: window.guandanQa.state(),
      layoutProblems: window.guandanQa.layoutProblems(),
      coach: coach ? { text: coach.textContent.replace(/\s+/g, " ").trim(), pick: coach.getAttribute("data-pick"), stance: coach.getAttribute("data-stance"), advice: coach.getAttribute("data-advice") } : null,
      status: text('[role="status"]'),
      dialog: text('[role="dialog"]'),
      errors,
      pressed: done,
    }
    fetch("/qa-report", { method: "POST", body: JSON.stringify(report) })
      .then((response) => response.json())
      .then((answer) => {
        if (answer.press) done = { id: answer.press.id, result: pressButton(answer.press.name) }
        return null
      })
      .catch(() => undefined)
  }, 500)
}

async function serve() {
  const tools = await readFile(resolve("e2e/page-tools.js"), "utf8")
  const head = commit()
  const queue = []
  let visit = null
  createServer(async (request, response) => {
    const { pathname, searchParams } = new URL(request.url, ORIGIN)
    if (pathname === "/qa-health") {
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ pid: process.pid, commit: head, builtAt: builtAt() }))
      return
    }
    if (request.method === "POST" && pathname === "/qa-report") {
      const parts = []
      for await (const part of request) parts.push(part)
      // A page from an earlier `open` may still be alive for a moment. Only the newest one is listened to.
      if (JSON.parse(Buffer.concat(parts).toString()).visit !== visit) return response.end(JSON.stringify({ press: null }))
      // Written whole and then renamed, so a command reading the file never finds half of it.
      writeFileSync(`${LATEST}.part`, Buffer.concat(parts))
      renameSync(`${LATEST}.part`, LATEST)
      response.end(JSON.stringify({ press: queue.shift() ?? null }))
      return
    }
    if (request.method === "POST" && pathname === "/qa-visit") {
      visit = searchParams.get("id")
      queue.length = 0
      response.end("noted")
      return
    }
    if (request.method === "POST" && pathname === "/qa-press") {
      queue.push({ id: searchParams.get("id"), name: searchParams.get("name") })
      response.end("queued")
      return
    }
    const file = join(DIST, normalize(pathname === "/" ? "/index.html" : pathname))
    try {
      if (!file.startsWith(DIST)) throw new Error("outside dist")
      const body = await readFile(file)
      response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" })
      if (!file.endsWith("index.html")) return response.end(body)
      const game = GAMES.includes(searchParams.get("game")) ? searchParams.get("game") : "home"
      const fixture = /^[a-z0-9-]+$/.test(searchParams.get("fixture") ?? "") ? searchParams.get("fixture") : null
      const setup = {
        game,
        fresh: searchParams.has("fresh"),
        view: ["2d", "3d"].includes(searchParams.get("view")) ? searchParams.get("view") : null,
        seed: searchParams.has("seed") ? Number(searchParams.get("seed")) : null,
        save: fixture ? (await readFile(resolve("e2e/fixtures", `${fixture}.json`), "utf8")).trim() : null,
        saveKey: SAVE_KEYS[game] ?? null,
      }
      response.end(body.toString().replace("<head>", `<head><script>${tools}\n;(${reporter.toString()})(${JSON.stringify(setup)})</script>`))
    } catch {
      response.writeHead(404).end("not found")
    }
  }).listen(PORT, "127.0.0.1")
}

const phones = (filter) =>
  Object.values(JSON.parse(simctl("list", "devices", filter, "-j")).devices)
    .flat()
    .filter((device) => device.name.startsWith("iPhone"))

/**
 * The iPhone to drive, booted. VERIFY_DEVICE names one (a name or a UDID): use it when another session has the
 * booted one. Otherwise the phone that is already booted, or the one the CI check would pick.
 */
function phone() {
  const wanted = process.env.VERIFY_DEVICE
  const running = phones("booted")
  const found = wanted ? phones("available").find((device) => device.name === wanted || device.udid === wanted) : running[0]
  if (wanted && !found) fail(`no available iPhone simulator is called ${wanted}`)
  const udid = found?.udid ?? run("node", ["e2e/ios/pick-device.mjs"], { input: simctl("list", "devices", "available", "-j") })
  const booted = !running.some((device) => device.udid === udid)
  if (booted) {
    simctl("boot", udid)
    simctl("bootstatus", udid, "-b")
  }
  const device = phones("booted").find((candidate) => candidate.udid === udid)
  return { udid, name: device?.name ?? udid, booted }
}

async function launch() {
  if (await health()) fail(`something already answers on ${ORIGIN}. Run cleanup first, or set VERIFY_PORT to a free port.`)
  mkdirSync(OUT, { recursive: true })
  console.log("building…")
  run("npm", ["run", "--silent", "build"])
  const server = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve"], { detached: true, stdio: "ignore" })
  server.unref()
  const device = phone()
  writeFileSync(STATE, JSON.stringify({ pid: server.pid, port: PORT, udid: device.udid, device: device.name, booted: device.booted, commit: commit() }))
  for (let attempt = 0; attempt < 50 && !(await health()); attempt++) await new Promise((done) => setTimeout(done, 200))
  if (!(await health())) fail("the server did not start")
  console.log(`ready: ${ORIGIN} at ${commit()}, ${device.name} (${device.udid})${device.booted ? ", booted by this run" : ", already booted"}`)
}

async function doctor() {
  const known = instance()
  if (!known) fail("no instance. Run launch.")
  const served = await health()
  const problems = []
  if (!alive(known.pid) || !served) problems.push("the server is not running")
  else if (served.pid !== known.pid) problems.push(`port ${PORT} is answered by another process (pid ${served.pid})`)
  if (served && served.commit !== commit()) problems.push(`the server was started at ${served.commit} and the checkout is at ${commit()}`)
  const stale = existsSync(join(DIST, "index.html")) ? run("find", ["src", "public", "index.html", "-newer", join(DIST, "index.html"), "-type", "f"]) : "no build"
  if (stale) problems.push(`the build is older than ${stale.split("\n")[0]}. Run npm run build, then open again`)
  if (!phones("booted").some((device) => device.udid === known.udid)) problems.push(`the simulator ${known.device} is not booted`)
  const latest = latestReport()
  const age = latest ? Math.round((Date.now() - Date.parse(latest.at)) / 1000) : null
  console.log(`server ${ORIGIN} pid ${known.pid} commit ${served?.commit ?? "?"}`)
  console.log(`simulator ${known.device} ${known.udid}`)
  console.log(latest ? `page last reported ${age}s ago: ${latest.game}, ${latest.viewport.width}×${latest.viewport.height}` : "the page has not reported yet; run open")
  if (age !== null && age > 5) problems.push("the page stopped reporting: Safari is in the background or on another page")
  for (const problem of problems) console.log(`! ${problem}`)
  process.exit(problems.length ? 1 : 0)
}

async function open(args) {
  const known = instance() ?? fail("no instance. Run launch.")
  const game = GAMES.includes(args[0]) ? args[0] : fail(`open needs one of: ${GAMES.join(", ")}`)
  const visit = String(Date.now())
  const query = new URLSearchParams({ qa: visit, game })
  for (let at = 1; at < args.length; at++) {
    if (args[at] === "--fresh") query.set("fresh", "1")
    else if (["--fixture", "--seed", "--view"].includes(args[at])) query.set(args[at].slice(2), args[++at] ?? "")
    else fail(`unknown option ${args[at]}`)
  }
  const fixture = query.get("fixture")
  if (fixture && !existsSync(resolve("e2e/fixtures", `${fixture}.json`))) fail(`no fixture e2e/fixtures/${fixture}.json`)
  rmSync(LATEST, { force: true })
  await fetch(`${ORIGIN}/qa-visit?id=${visit}`, { method: "POST" })
  simctl("openurl", known.udid, `${ORIGIN}/?${query}`)
  // Safari takes a moment to load the page, and longer the first time after a boot. Wait for its first report.
  for (let attempt = 0; attempt < 240 && !latestReport(); attempt++) await new Promise((done) => setTimeout(done, 250))
  if (!latestReport()) fail("Mobile Safari did not load the page within 60 seconds. Look at the simulator: a first-run sheet may be in the way.")
  console.log(`opened ${game} in Mobile Safari on ${known.device}`)
}

async function proof(name) {
  const known = instance() ?? fail("no instance. Run launch.")
  if (!/^[a-z0-9-]+$/.test(name ?? "")) fail("proof needs a name of lower-case letters, digits and hyphens")
  // The page reports twice a second, so wait for a report made after this command began.
  const began = Date.now()
  let report = null
  for (let attempt = 0; attempt < 40 && !report; attempt++) {
    await new Promise((done) => setTimeout(done, 250))
    const latest = latestReport()
    if (latest && Date.parse(latest.at) >= began) report = latest
  }
  if (!report) fail("the page did not report within 10 seconds. Run doctor.")
  simctl("io", known.udid, "screenshot", join(OUT, `${name}.png`))
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify({ commit: known.commit, device: known.device, ...report }, null, 2)}\n`)
  console.log(`verify-out/${name}.png and verify-out/${name}.json`)
  console.log(`${report.game} ${report.viewport.width}×${report.viewport.height} state ${JSON.stringify(report.state)}`)
  if (report.coach) console.log(`coach: ${report.coach.text}`)
  console.log(report.layoutProblems.length ? `layout problems:\n- ${report.layoutProblems.join("\n- ")}` : "layout problems: none")
  console.log(report.errors.length ? `script errors:\n- ${report.errors.join("\n- ")}` : "script errors: none")
}

/** Presses a button in the page by the name a player reads on it, and waits until the page says it did. */
async function press(name) {
  if (!instance()) fail("no instance. Run launch.")
  if (!name) fail('press needs the name on the button, for example: press "打出"')
  const id = String(Date.now())
  await fetch(`${ORIGIN}/qa-press?${new URLSearchParams({ id, name })}`, { method: "POST" })
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((done) => setTimeout(done, 250))
    const latest = latestReport()
    if (latest?.pressed?.id !== id) continue
    if (latest.pressed.result !== "pressed") fail(latest.pressed.result)
    return console.log(`pressed ${name}`)
  }
  fail("the page did not answer within 10 seconds. Run doctor.")
}

function cleanup() {
  const known = instance()
  if (!known) return console.log("nothing to clean up")
  if (alive(known.pid)) process.kill(known.pid)
  if (known.booted) simctl("shutdown", known.udid)
  rmSync(STATE, { force: true })
  rmSync(LATEST, { force: true })
  console.log(`stopped the server${known.booted ? " and the simulator this run booted" : "; the simulator was already booted, so it is left running"}. Proofs stay in verify-out/.`)
}

const [command, ...args] = process.argv.slice(2)
if (command === "serve") await serve()
else if (command === "launch") await launch()
else if (command === "doctor") await doctor()
else if (command === "open") await open(args)
else if (command === "press") await press(args[0])
else if (command === "proof") await proof(args[0])
else if (command === "cleanup") cleanup()
else fail("usage: verify.mjs launch | doctor | open <game> [--fixture <name>] [--seed <n>] [--view 2d|3d] [--fresh] | press <button> | proof <name> | cleanup")
