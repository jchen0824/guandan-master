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

test("the fans are painted standing in front of the table", async ({ page, browserName }) => {
  // The layout probe reads positions, and positions cannot tell whether a browser paints one surface over
  // another. Chrome has painted the tabletop over the fans. So this test looks at the pixels where the middle
  // card of a fan should be. It is the left fan because the far one is behind the top bar on a short phone.
  test.skip(browserName === "webkit", "Playwright's WebKit paints every 3D scene flat in a screenshot; record a video to look at it")
  await openGame(page, { view: "3d" })
  const card = page.locator('[data-slot="seat3d"][data-side="left"] [data-slot="fan-card"]').nth(13)
  const box = (await card.boundingBox())!
  const clip = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.3, width: box.width * 0.4, height: box.height * 0.4 }
  const shot = (await page.screenshot({ clip })).toString("base64")
  const red = await page.evaluate(async (png) => {
    const image = new Image()
    image.src = `data:image/png;base64,${png}`
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext("2d")!
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, image.width, image.height)
    let count = 0
    // Card-back red, and not the brown of the table edge, which is under this spot when the fan is missing.
    for (let at = 0; at < data.length; at += 4) if (data[at] > data[at + 1] * 2 + 20) count++
    return count / (data.length / 4)
  }, shot)
  expect(red, "share of card-back red where the left fan's middle card should be").toBeGreaterThan(0.3)
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
  // That play is a bomb, so it gets the bomb's moment: the effect on the felt and the banner over the table.
  await expect(mine.locator('[data-bomb] [data-slot="spark"]')).toHaveCount(16)
  await expect(page.locator('[data-slot="bomb-banner"] b')).toHaveText("炸弹")
  await expectLayoutToHold(page, "with the last play on the felt")
})

test("every covered card in the hand still shows its suit", async ({ page }) => {
  // Cards of one rank stack in a column, and on a narrow screen the columns overlap sideways too. A player
  // choosing cards for a straight flush has to tell the suits apart without lifting each card.
  await openGame(page, { view: "3d" })
  await dealExactly(page, 1)
  const marks = await page.evaluate(() => {
    const covered = [...document.querySelectorAll<HTMLElement>('[data-slot="hand-column"] [data-card-id]:not(:last-child)')]
    return covered.map((card) => {
      const mark = card.querySelector('[data-slot="face-suit"], [data-joker-name]')
      if (!mark) return `${card.ariaLabel} has no suit mark`
      const box = mark.getBoundingClientRect()
      // The middle of the mark and the two edges another card could hide: the right and the bottom.
      const points = [
        [box.left + box.width / 2, box.top + box.height / 2],
        [box.right - 1, box.top + box.height / 2],
        [box.left + box.width / 2, box.bottom - 1],
      ]
      const hidden = points.some(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-card-id]") !== card)
      return hidden ? `${card.ariaLabel}: the suit mark is hidden` : ""
    })
  })
  expect(marks.length).toBeGreaterThan(8)
  expect(marks.filter(Boolean)).toEqual([])
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

test("a new player starts on the 3D table", async ({ page }) => {
  await openGame(page, { view: "new player" })
  await expect(page.locator('[data-slot="app"]')).toHaveAttribute("data-view", "3d")
  await expectLayoutToHold(page, "on a first visit")
})

test("the switch moves between the two tables and the choice is kept", async ({ page }) => {
  await openGame(page)
  const app = page.locator('[data-slot="app"]')
  await expect(app).toHaveAttribute("data-view", "2d")

  // Settings has the switch too.
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

  const bar = page.locator('[data-slot="menu"] > [data-view-switch]')
  await bar.getByRole("radio", { name: "2D", exact: true }).click()
  await expect(app).toHaveAttribute("data-view", "2d")
  await expectLayoutToHold(page, "after switching back to 2D")

  // The way back is in the flat table's top bar on every screen, a phone included, and costs it no extra row.
  const scores = (await page.locator('[data-slot="scores"]').boundingBox())!
  const back = bar.getByRole("radio", { name: "3D", exact: true })
  const where = (await back.boundingBox())!
  expect(Math.abs(where.y + where.height / 2 - (scores.y + scores.height / 2)), "the switch is on the same row as the scores").toBeLessThan(12)
  await back.click()
  await expect(app).toHaveAttribute("data-view", "3d")
})

test("the coach opens as a drawer on the 3D table at every size", async ({ page }) => {
  await openGame(page, { view: "3d" })
  await page.getByRole("button", { name: "教练", exact: true }).click()
  await expect(page.getByRole("complementary", { name: "教练" })).toBeVisible()
  await page.getByRole("button", { name: "收起", exact: true }).click()
  await expect(page.getByRole("complementary", { name: "教练" })).toBeHidden()
  await expectLayoutToHold(page, "after closing the coach")
})
