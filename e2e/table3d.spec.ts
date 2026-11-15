import { expect, test } from "@playwright/test"
import { dealExactly, expectLayoutToHold, openGame, playToTheEnd, screen } from "./helpers"

// The 3D table is the same game on a different table. These tests check that it holds together on every screen
// size, and that a player can get to it and back.

/** The hand leans back in 3D, so a card's corner is a few pixels inside its bounding box. */
const CARD_CORNER = { x: 16, y: 10 }

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

test("a fresh deal fits the screen on the 3D table", async ({ page }) => {
  await openGame(page, { view: "3d" })
  await expect(page.locator('[data-slot="app"]')).toHaveAttribute("data-view", "3d")
  expect((await screen(page)).cards).toBe(27)
  await expect(page.locator('[data-slot="fan-card"]')).toHaveCount(81)
  await expectLayoutToHold(page, "after the deal")
})

test("a whole hand can be played on the 3D table", async ({ page }) => {
  await openGame(page, { view: "3d" })
  const moves = await playToTheEnd(page, (move) => expectLayoutToHold(page, `at move ${move}`))
  expect(moves).toBeGreaterThan(20)
  await expectLayoutToHold(page, "when the hand ends")

  await page.getByRole("button", { name: "查看结果", exact: true }).click()
  const result = page.getByRole("dialog")
  await expect(result.getByRole("button", { name: "下一局", exact: true })).toBeVisible()
  await expectLayoutToHold(page, "with the result open")
  await result.getByRole("button", { name: "下一局", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expectLayoutToHold(page, "at the start of the second hand")
})

test("the player's last play lies on the felt when the hand ends", async ({ page }) => {
  await openGame(page, { view: "3d" })
  await dealExactly(page, 4)
  await playToTheEnd(page)
  const mine = page.getByRole("region", { name: "你出的牌" })
  await expect(mine.getByLabel("你出的牌：4张9炸弹")).toHaveCount(1)
  await expect(mine.locator("[data-card]")).toHaveCount(4)
  for (const card of await mine.locator("[data-card]").all()) await expect(card).toBeVisible()
  await expectLayoutToHold(page, "with the last play on the felt")
})

test("cards can be picked and gathered into a pile on the 3D table", async ({ page }) => {
  await openGame(page, { view: "3d" })
  const cards = page.locator('[data-slot="hand"] [data-card-id]')
  await cards.nth(0).click({ position: CARD_CORNER })
  await cards.nth(3).click({ position: CARD_CORNER })
  expect((await screen(page)).selected).toBe(2)
  await expectLayoutToHold(page, "with two cards picked")

  await page.getByRole("button", { name: "理牌", exact: true }).click()
  await expect(page.locator('[data-slot="hand-column"][data-custom]')).toHaveCount(1)
  await expectLayoutToHold(page, "with a pile")
})

test("the switch moves between the two tables and the choice is kept", async ({ page }) => {
  await openGame(page)
  const app = page.locator('[data-slot="app"]')
  await expect(app).toHaveAttribute("data-view", "2d")

  // The flat table's top bar has no room for the switch on an upright phone, so settings always has it.
  await page.getByRole("button", { name: "设置", exact: true }).click()
  const settings = page.getByRole("dialog")
  await settings.getByRole("radio", { name: "3D", exact: true }).click()
  await expectLayoutToHold(page, "with settings open over the 3D table")
  const done = settings.getByRole("button", { name: "好了", exact: true })
  await done.scrollIntoViewIfNeeded()
  await done.click()
  await expect(app).toHaveAttribute("data-view", "3d")
  await expectLayoutToHold(page, "after switching to 3D")

  await page.reload()
  await expect(app).toHaveAttribute("data-view", "3d")

  await page.getByRole("radiogroup", { name: "牌桌视角" }).getByRole("radio", { name: "2D", exact: true }).click()
  await expect(app).toHaveAttribute("data-view", "2d")
  await expectLayoutToHold(page, "after switching back to 2D")
})

test("the coach opens as a drawer on the 3D table at every size", async ({ page }) => {
  await openGame(page, { view: "3d" })
  await page.getByRole("button", { name: "教练", exact: true }).click()
  await expect(page.getByRole("complementary", { name: "教练" })).toBeVisible()
  await page.getByRole("button", { name: "收起", exact: true }).click()
  await expect(page.getByRole("complementary", { name: "教练" })).toBeHidden()
  await expectLayoutToHold(page, "after closing the coach")
})
