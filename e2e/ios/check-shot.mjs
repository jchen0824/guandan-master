// Compares a screenshot of the iOS Simulator with the report the page posted (see driver.js).
// The report says where things are; the screenshot says what Safari painted there. Positions cannot show
// that one surface was painted over another, and that is the fault Safari has had three times on the 3D
// table: the rim over the felt, labels lying flat, and the first card of a play over the rest.
// Usage: node e2e/ios/check-shot.mjs <screenshot.png> <report.json>
import { appendFileSync, readFileSync } from "node:fs"
import { PNG } from "pngjs"

const [shotFile, reportFile] = process.argv.slice(2)
const shot = PNG.sync.read(readFileSync(shotFile))
const report = JSON.parse(readFileSync(reportFile, "utf8"))
const results = []
const check = (name, ok, detail) => results.push({ name, ok, detail })
const pixel = (x, y) => {
  const at = (Math.round(y) * shot.width + Math.round(x)) * 4
  return [shot.data[at], shot.data[at + 1], shot.data[at + 2]]
}

// Colours are loose on purpose: the simulator saves in a wider colour space than the stylesheet is written in.
const isMark = ([r, g, b]) => r > 200 && g < 110 && b > 200
const isFelt = ([r, g, b]) => g > r + 20 && g > b && g > 50
const isCardBack = ([r, g]) => r > g * 2 + 20
const isDark = ([r, g, b]) => Math.max(r, g, b) < 90
// A rank is black or red ink on a near-white card face. Black means dark and grey: the felt and the wood of
// the table are dark too, but green and brown, and must not count, or a play painted behind the felt would pass.
const isFace = ([r, g, b]) => Math.min(r, g, b) > 190
const isInk = ([r, g, b]) => (Math.max(r, g, b) < 120 && Math.max(r, g, b) - Math.min(r, g, b) < 40) || (r > 140 && g < 110 && b < 110 && r > g * 1.6)

function finish() {
  const lines = results.map((r) => `${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
  console.log(lines.join("\n"))
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### iOS Simulator, Mobile Safari\n\n${lines.map((l) => `- ${l}`).join("\n")}\n`)
  process.exit(results.every((r) => r.ok) ? 0 : 1)
}

if (report.error) {
  check("the page played to the state to photograph", false, report.error)
  finish()
}
check("the game is on the 3D table", report.view === "3d", `view is ${report.view}`)
check("several five-card plays are on the table", report.reached === true, `${report.plays.length} plays after ${report.moves} moves`)
check("the layout probe finds nothing wrong", report.layoutProblems.length === 0, report.layoutProblems.join("; "))

// Find the page inside the screenshot from the two marks the driver drew in its corners.
let left = Infinity
let top = Infinity
let right = -1
let bottom = -1
for (let y = 0; y < shot.height; y++) {
  for (let x = 0; x < shot.width; x++) {
    if (!isMark(pixel(x, y))) continue
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
  }
}
const scaleX = (right + 1 - left) / report.viewport.width
const scaleY = (bottom + 1 - top) / report.viewport.height
const found = right > left && Math.abs(scaleX - scaleY) / scaleX < 0.03
check("the page's corner marks are in the screenshot", found, `page at ${left},${top} to ${right},${bottom} in ${shot.width}×${shot.height}, scale ${scaleX.toFixed(2)} × ${scaleY.toFixed(2)}`)
if (!found) finish()

/** The share of pixels in the middle of a page-coordinate box that pass `test`. `keep` is how much of the box to look at. */
function share([x, y, width, height], test, keep = 1) {
  const x0 = left + (x + (width * (1 - keep)) / 2) * scaleX
  const y0 = top + (y + (height * (1 - keep)) / 2) * scaleY
  const columns = Math.max(1, Math.floor(width * keep * scaleX))
  const rows = Math.max(1, Math.floor(height * keep * scaleY))
  let hit = 0
  let seen = 0
  for (let row = 0; row < rows; row += 2) {
    for (let column = 0; column < columns; column += 2) {
      const px = x0 + column
      const py = y0 + row
      if (px < 0 || py < 0 || px >= shot.width || py >= shot.height) continue
      seen++
      if (test(pixel(px, py))) hit++
    }
  }
  return seen === 0 ? 0 : hit / seen
}
const percent = (value) => `${Math.round(value * 100)}%`

const felt = share(report.felt, isFelt)
check("the felt is green, not covered by the table's rim", felt > 0.25, `${percent(felt)} of the felt's area is green`)

const fan = share(report.fanCard, isCardBack, 0.4)
check("the left fan stands in front of the table", fan > 0.3, `${percent(fan)} card-back red where its middle card is`)

for (const label of report.labels) {
  const dark = share(label.box, isDark, 0.6)
  check(`the label “${label.name}” faces the camera`, dark > 0.3, `${percent(dark)} of its middle is its dark background`)
}

for (const play of report.plays) {
  // Ink alone is not enough: it must be on a card face, so the box needs both.
  const hidden = play.cards.filter((card) => share(card.rank, isInk) < 0.06 || share(card.rank, isFace) < 0.2).map((card) => card.name)
  check(`every rank shows in ${play.label}`, hidden.length === 0, hidden.length ? `no rank on a card face where these cards should show one: ${hidden.join(", ")}` : `${play.cards.length} cards`)
}
finish()
