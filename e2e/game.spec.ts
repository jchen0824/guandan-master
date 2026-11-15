import { expect, test } from "@playwright/test"
import {
  CARD_CORNER,
  SAVE_AFTER_DOUBLE_WIN,
  dealExactly,
  expectLayoutToHold,
  openGame,
  playToTheEnd,
  returnTribute,
  screen,
} from "./helpers"

// Rules are tested in src/engine. These tests ask a different question: on a real browser at this screen size,
// can a player see and reach everything from the deal to the next hand?

let errors: string[] = []

test.beforeEach(({ page }) => {
  errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
})

test.afterEach(() => {
  expect(errors, "errors in the browser console").toEqual([])
})

test("a fresh deal fits the screen", async ({ page }) => {
  await openGame(page)
  expect((await screen(page)).cards).toBe(27)
  await expectLayoutToHold(page, "after the deal")
})

test("a whole hand can be played and the next one started", async ({ page }) => {
  await openGame(page)
  const moves = await playToTheEnd(page, (move) => expectLayoutToHold(page, `at move ${move}`))
  expect(moves).toBeGreaterThan(20)
  await expectLayoutToHold(page, "when the hand ends")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await page.getByRole("button", { name: "查看结果", exact: true }).click()
  const result = page.getByRole("dialog")
  await expect(result.getByRole("button", { name: "下一局", exact: true })).toBeVisible()
  await expectLayoutToHold(page, "with the result open")

  await result.getByRole("button", { name: "再看看牌桌", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "查看结果", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "下一局", exact: true }).click()

  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "查看结果", exact: true })).toHaveCount(0)
  expect((await screen(page)).cards).toBeGreaterThanOrEqual(26)
  await expectLayoutToHold(page, "at the start of the second hand")
})

test("the player's hand-ending play stays on the table", async ({ page }) => {
  // With this deal the player goes out on a bomb, and that play decides the hand.
  await openGame(page)
  await dealExactly(page, 4)
  await playToTheEnd(page)
  const controls = page.getByRole("region", { name: "你的操作" })
  await expect(controls.getByLabel("你出的牌：4张9炸弹")).toBeVisible()
  await expect(controls.getByRole("button", { name: "查看结果", exact: true })).toBeVisible()
  await expectLayoutToHold(page, "with the last play beside the result button")
})

test("a hand that starts with tribute", async ({ page }) => {
  await openGame(page, { save: SAVE_AFTER_DOUBLE_WIN })
  await expectLayoutToHold(page, "with the resume offer open")
  await page.getByRole("button", { name: "继续第 2 局", exact: true }).click()
  await expect(page.getByRole("button", { name: "还贡", exact: true })).toBeVisible()
  await expectLayoutToHold(page, "while choosing a card to return")

  await returnTribute(page)
  await page.getByRole("button", { name: "复盘", exact: true }).click()
  const review = page.getByRole("dialog")
  await expect(review.getByRole("heading", { name: "进贡记录" })).toBeVisible()
  await expect(review.getByText(/向你进贡 .+，你还贡 .+。/)).toBeVisible()
  await expectLayoutToHold(page, "with the review open")
})

test("every dialog fits the screen", async ({ page }) => {
  await openGame(page)
  for (const [open, close] of [
    ["规则", "知道了"],
    ["复盘", "继续打牌"],
    ["设置", "好了"],
  ]) {
    await page.getByRole("button", { name: open, exact: true }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expectLayoutToHold(page, `with ${open} open`)
    const done = dialog.getByRole("button", { name: close, exact: true })
    await done.scrollIntoViewIfNeeded()
    await done.click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  }
})

test("cards can be picked and gathered into a pile", async ({ page }) => {
  await openGame(page)
  const cards = page.locator('[data-slot="hand"] [data-card-id]')
  // Cards overlap, so click the corner that always shows.
  await cards.nth(0).click({ position: CARD_CORNER })
  await cards.nth(3).click({ position: CARD_CORNER })
  expect((await screen(page)).selected).toBe(2)
  await expectLayoutToHold(page, "with two cards picked")

  await page.getByRole("button", { name: "理牌", exact: true }).click()
  await expect(page.locator('[data-slot="hand-column"][data-custom]')).toHaveCount(1)
  await expectLayoutToHold(page, "with a pile")

  await page.getByRole("button", { name: "恢复", exact: true }).click()
  await expect(page.locator('[data-slot="hand-column"][data-custom]')).toHaveCount(0)
})

test("the coach drawer opens and closes on a phone", async ({ page, viewport }) => {
  test.skip(!viewport || viewport.width > 1000, "the coach is docked beside the table on wide screens")
  await openGame(page)
  await page.getByRole("button", { name: "教练", exact: true }).click()
  await expect(page.getByRole("complementary", { name: "教练" })).toBeVisible()
  await expectLayoutToHold(page, "with the coach open")
  await page.getByRole("button", { name: "收起", exact: true }).click()
  await expectLayoutToHold(page, "after closing the coach")
})
