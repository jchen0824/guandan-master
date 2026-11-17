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

/** Exact cards for a Texas Hold'em hand: hole cards by seat (0 is the player) such as "AH TD", and the board. */
export interface HoldemDeal {
  button?: number
  seats?: 6 | 9
  holes: Record<number, string>
  board: string
  seed?: number
}

declare global {
  interface Window {
    guandanQa: {
      seed: (value: number) => void
      dealHoldem: (deal: HoldemDeal) => void
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
function prepare({ seed, save, view, game, seats }: { seed: number; save?: string; view: string; game: string; seats?: number }) {
  window.guandanQa.seed(seed)
  if (game !== "home" && !sessionStorage.getItem("qa-game-used")) {
    localStorage.setItem("guandan.game", game)
    sessionStorage.setItem("qa-game-used", "1")
  }
  if (view !== "new player" && !sessionStorage.getItem("qa-view-used")) {
    localStorage.setItem("guandan.view", view)
    sessionStorage.setItem("qa-view-used", "1")
  }
  if (save && !sessionStorage.getItem("qa-save-used")) {
    localStorage.setItem("guandan.match", save)
    sessionStorage.setItem("qa-save-used", "1")
  }
  if (seats && !sessionStorage.getItem("qa-seats-used")) {
    localStorage.setItem("guandan.holdem.seats", String(seats))
    sessionStorage.setItem("qa-seats-used", "1")
  }
}

/** Opens the game with a fixed deal and a clock the test controls, so a whole hand takes seconds. */
/** `view` is the table to open on. It is the flat one unless a test says otherwise; "new player" leaves the choice unmade. */
export async function openGame(page: Page, options: { seed?: number; save?: string; view?: "2d" | "3d" | "new player" } = {}) {
  await open(page, { ...options, game: "guandan" })
  await expect(page.getByRole("region", { name: "你的操作" })).toBeVisible()
}

/** Opens the app as a first visit does: on the home page, with no game chosen. */
export async function openHome(page: Page, options: { seed?: number; save?: string } = {}) {
  await open(page, { ...options, game: "home" })
  await expect(page.getByRole("heading", { name: "今天练哪一桌？" })).toBeVisible()
}

/** Opens the Texas Hold'em table with a fixed deal and a clock the test controls. */
export async function openHoldem(page: Page, options: { seed?: number; seats?: 6 | 9 } = {}) {
  await open(page, { ...options, game: "holdem" })
  await expect(page.getByRole("list", { name: /^你的手牌/ })).toBeVisible()
}

async function open(page: Page, options: { seed?: number; save?: string; view?: string; seats?: number; game: "guandan" | "holdem" | "home" }) {
  await page.clock.install()
  // One script, not two: Playwright does not promise the order in which separate init scripts run.
  const settings = JSON.stringify({ seed: options.seed ?? 5, save: options.save, view: options.view ?? "2d", game: options.game, seats: options.seats })
  await page.addInitScript({ content: `${PAGE_TOOLS}\n;(${prepare.toString()})(${settings});` })
  await page.goto("/")
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

/** Texas Hold'em: starts the table over from 设置, with exactly these cards. */
export async function dealHoldemExactly(page: Page, deal: HoldemDeal) {
  await page.getByRole("button", { name: "设置", exact: true }).click()
  await page.getByRole("button", { name: "重新开始", exact: true }).click()
  await page.evaluate((value) => window.guandanQa.dealHoldem(value), deal)
  await page.getByRole("button", { name: /^确认/ }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

/** Texas Hold'em: checks or calls until it is the player's turn with this many cards on the board. */
export async function callDownTo(page: Page, boardCards: number) {
  const board = page.locator('[data-slot="he-board"] [data-slot="playing-card"]')
  for (let step = 0; step < 200; step++) {
    const now = await screen(page)
    if (now.over) throw new Error(`the hand ended before the player's turn with ${boardCards} cards on the board`)
    if (now.myTurn && (await board.count()) === boardCards) return
    if (now.myTurn) {
      const before = await page.evaluate(() => window.guandanQa.signature())
      await page.getByRole("button", { name: /^(过牌|跟注)/ }).click()
      await expect.poll(() => page.evaluate(() => window.guandanQa.signature())).not.toBe(before)
    } else await waitForNextMove(page)
  }
  throw new Error(`no turn for the player with ${boardCards} cards on the board within 200 steps`)
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

/** Texas Hold'em: does what the coach's advice says, and waits for the table to move on. */
export async function followAdvice(page: Page) {
  const before = await page.evaluate(() => window.guandanQa.signature())
  // The coach's advice is in the panel's data-advice. A raise button starts at the coach's amount.
  const advice = await page.getByRole("complementary", { name: "教练" }).getAttribute("data-advice")
  if (advice === "raise") await page.locator('[data-slot="he-buttons"] [data-variant="raise"]').click()
  else await page.getByRole("button", { name: advice === "fold" ? /^弃牌$/ : /^(过牌|跟注)/ }).click()
  await expect.poll(() => page.evaluate(() => window.guandanQa.signature())).not.toBe(before)
}

/** Texas Hold'em: plays by the coach's advice until the hand is over. `check` runs at every decision and at the end. */
export async function playHoldemHand(page: Page, check?: (when: string) => Promise<void>) {
  for (let step = 0; step < 200; step++) {
    const now = await screen(page)
    if (now.over) {
      if (check) await check("when the hand is over")
      return
    }
    if (now.myTurn) {
      if (check) await check(`at decision ${step}`)
      await followAdvice(page)
    } else await waitForNextMove(page)
  }
  throw new Error("the hand did not finish within 200 steps")
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
