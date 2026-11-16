import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"

interface GameScreen {
  over: boolean
  myTurn: boolean
  mustReturn: boolean
  cards: number
  selected: number
  dialog: boolean
}

declare global {
  interface Window {
    guandanQa: {
      seed: (value: number) => void
      state: () => GameScreen
      signature: () => string
      layoutProblems: () => string[]
    }
  }
}

const PAGE_TOOLS = readFileSync(fileURLToPath(new URL("./page-tools.js", import.meta.url)), "utf8")
/** A little longer than the pause the game leaves between bot moves. */
const BOT_MOVE = 900
/** Cards overlap in the hand, so clicks aim at the corner that always shows. */
export const CARD_CORNER = { x: 8, y: 8 }

/** A finished first hand that the player's side won by a double, so the next hand starts with a double tribute. */
export const SAVE_AFTER_DOUBLE_WIN = JSON.stringify({
  version: 1,
  savedAt: "2026-01-01T00:00:00.000Z",
  handNumber: 1,
  levels: [5, 2],
  aFails: [0, 0],
  result: { order: [0, 2, 1, 3], winnerTeam: 0, gain: 3, levelsBefore: [2, 2], levelsAfter: [5, 2], notes: [], matchWinner: null },
})

/** Runs in the page before the app starts. It needs the page tools, so both go into the page as one script. */
function prepare({ seed, save, view }: { seed: number; save?: string; view: string }) {
  window.guandanQa.seed(seed)
  if (view !== "new player" && !sessionStorage.getItem("qa-view-used")) {
    localStorage.setItem("guandan.view", view)
    sessionStorage.setItem("qa-view-used", "1")
  }
  if (save && !sessionStorage.getItem("qa-save-used")) {
    localStorage.setItem("guandan.match", save)
    sessionStorage.setItem("qa-save-used", "1")
  }
}

/** Opens the game with a fixed deal and a clock the test controls, so a whole hand takes seconds. */
/** `view` is the table to open on. It is the flat one unless a test says otherwise; "new player" leaves the choice unmade. */
export async function openGame(page: Page, options: { seed?: number; save?: string; view?: "2d" | "3d" | "new player" } = {}) {
  await page.clock.install()
  // One script, not two: Playwright does not promise the order in which separate init scripts run.
  const settings = JSON.stringify({ seed: options.seed ?? 5, save: options.save, view: options.view ?? "2d" })
  await page.addInitScript({ content: `${PAGE_TOOLS}\n;(${prepare.toString()})(${settings});` })
  await page.goto("/")
  await expect(page.getByRole("region", { name: "你的操作" })).toBeVisible()
}

/**
 * Starts a new match with an exact deal. Seeding at page load is repeatable but not exact, because libraries
 * draw random numbers while they load; seeding right before 重新开始整场比赛 gives the same cards as a unit test.
 */
export async function dealExactly(page: Page, seed: number) {
  await page.getByRole("button", { name: "设置", exact: true }).click()
  await page.getByRole("button", { name: "重新开始整场比赛", exact: true }).click()
  await page.evaluate((value) => window.guandanQa.seed(value), seed)
  await page.getByRole("button", { name: /^确认/ }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

export const screen = (page: Page) => page.evaluate(() => window.guandanQa.state())

/**
 * Fails with the list of layout problems, each a plain sentence.
 * It retries for a moment so a drawer or dialog that is still sliding in is not reported as off screen.
 */
export async function expectLayoutToHold(page: Page, when: string) {
  await expect
    .poll(() => page.evaluate(() => window.guandanQa.layoutProblems()), { message: `layout problems ${when}`, timeout: 3000 })
    .toEqual([])
}

/** Lets time pass until something on the table changes, as it does when a bot plays. */
export async function waitForNextMove(page: Page) {
  const before = await page.evaluate(() => window.guandanQa.signature())
  await page.clock.fastForward(BOT_MOVE)
  for (let attempt = 0; attempt < 40; attempt++) {
    if ((await page.evaluate(() => window.guandanQa.signature())) !== before) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/** Plays the turn the way the coach suggests: the hinted cards, or a pass when the hint is to pass. */
export async function followHint(page: Page) {
  const before = await page.evaluate(() => window.guandanQa.signature())
  await page.getByRole("button", { name: "提示", exact: true }).click()
  const { selected } = await screen(page)
  await page.getByRole("button", { name: selected > 0 ? "出牌" : "不出", exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.guandanQa.signature())).not.toBe(before)
}

/** Gives back the lowest card that the rules accept. */
export async function returnTribute(page: Page) {
  const cards = page.locator('[data-slot="hand"] [data-card-id]')
  for (let index = (await cards.count()) - 1; index >= 0; index--) {
    await cards.nth(index).click({ position: CARD_CORNER })
    await page.getByRole("button", { name: "还贡", exact: true }).click()
    if (!(await screen(page)).mustReturn) return
    await cards.nth(index).click({ position: CARD_CORNER })
  }
  throw new Error("no card in the hand could be returned as tribute")
}

/** Plays until the hand is decided. `check` runs every few moves so layout is tested mid-hand, not only at rest. */
export async function playToTheEnd(page: Page, check?: (move: number) => Promise<void>) {
  for (let move = 0; move < 500; move++) {
    const now = await screen(page)
    if (now.over) return move
    if (check && move % 12 === 0) await check(move)
    if (now.mustReturn) await returnTribute(page)
    else if (now.myTurn) await followHint(page)
    else await waitForNextMove(page)
  }
  throw new Error("the hand did not finish within 500 moves")
}
