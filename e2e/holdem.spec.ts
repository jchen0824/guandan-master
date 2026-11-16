import { expect, test } from "@playwright/test"
import { expectLayoutToHold, openGame, openHoldem, openHome, playHoldemHand, screen, waitForNextMove } from "./helpers"

// The rules of Texas Hold'em are tested in src/holdem. These tests ask what game.spec.ts asks of 掼蛋:
// on a real browser at this screen size, can a player see and reach everything, from the home page on?

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

test("the home page shows both games with nothing covered or cut off", async ({ page }) => {
  await openHome(page)
  await expectLayoutToHold(page, "on the home page")
  const source = page.getByRole("link", { name: "GitHub 源代码" })
  await expect(source).toBeInViewport({ ratio: 1 })
  expect((await source.boundingBox())!.height, "the GitHub link is tall enough to tap").toBeGreaterThanOrEqual(44)
  for (const name of ["进入掼蛋牌桌", "进入德州扑克牌桌"]) {
    const enter = page.getByRole("button", { name })
    await enter.scrollIntoViewIfNeeded()
    await expect(enter).toBeInViewport({ ratio: 1 })
  }
})

test("a first visit picks a game, and the choice survives a reload until the player goes home", async ({ page }) => {
  await openHome(page)
  await page.getByRole("button", { name: "进入德州扑克牌桌" }).click()
  await expect(page.getByRole("list", { name: /^你的手牌/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("list", { name: /^你的手牌/ })).toBeVisible()

  await page.getByRole("button", { name: /牌桌教练/ }).click()
  await page.getByRole("button", { name: "进入掼蛋牌桌" }).click()
  await expect(page.getByRole("region", { name: "你的操作" })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("region", { name: "你的操作" })).toBeVisible()
})

for (const view of ["2d", "3d"] as const) {
  test(`the ${view} 掼蛋 table has a back button at the left of its top bar, and another in 设置`, async ({ page }) => {
    await openGame(page, { view })
    const back = page.getByRole("button", { name: "回到首页", exact: true })
    await expect(back).toBeInViewport({ ratio: 1 })
    const box = (await back.boundingBox())!
    expect(box.x, "the back button is at the left of the top bar").toBeLessThan(40)
    await expectLayoutToHold(page, "with the back button in the top bar")
    await back.click()
    await expect(page.getByRole("heading", { name: "今天练哪一桌？" })).toBeVisible()
    await expectLayoutToHold(page, "back on the home page")

    await page.getByRole("button", { name: "进入掼蛋牌桌" }).click()
    await page.getByRole("button", { name: "设置", exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: "回到首页", exact: true }).click()
    await expect(page.getByRole("heading", { name: "今天练哪一桌？" })).toBeVisible()
  })
}

test("the computer players' level is set in 设置, in a dialog that fits", async ({ page }) => {
  await openHoldem(page)
  await page.getByRole("button", { name: "设置", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "电脑玩家水平" })
  await dialog.getByRole("radio", { name: "新手", exact: true }).click()
  await expect(dialog.getByRole("radio", { name: "新手", exact: true })).toHaveAttribute("aria-checked", "true")
  await expectLayoutToHold(page, "with 设置 open")
  await dialog.getByRole("button", { name: "好了" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expectLayoutToHold(page, "after 设置 closes")
})

test("a fresh Texas Hold'em deal fits the screen", async ({ page }) => {
  await openHoldem(page)
  await expectLayoutToHold(page, "right after the deal")
  await expect(page.getByRole("region", { name: /，/ })).toHaveCount(5)
  await expect(page.getByRole("complementary", { name: "教练" })).toBeVisible()
})

test("three hands played by the coach's advice keep every label clear of the others", async ({ page }) => {
  await openHoldem(page)
  for (let hand = 1; hand <= 3; hand++) {
    await playHoldemHand(page, (when) => expectLayoutToHold(page, `in hand ${hand}, ${when}`))
    await page.getByRole("button", { name: "下一手" }).click()
    // A short phone has no room for the hand counter, so this reads it whether or not it is shown.
    await expect(page.locator('[data-slot="he-hand"]')).toContainText(`第 ${hand + 1} 手`)
    await expect(page.getByRole("button", { name: "下一手" })).toHaveCount(0)
  }
})

test("a hand that reaches a showdown shows the winner and the cards that made the hand", async ({ page }) => {
  await openHoldem(page)
  let shown = 0
  // Checking or calling every time keeps the player in until the river.
  for (let hand = 0; hand < 30 && shown === 0; hand++) {
    for (let step = 0; step < 200 && !(await screen(page)).over; step++) {
      if ((await screen(page)).myTurn) await page.getByRole("button", { name: /^(过牌|跟注)/ }).click()
      else await waitForNextMove(page)
    }
    shown = await page.locator('[data-slot="he-shown"]').count()
    if (shown === 0) await page.getByRole("button", { name: "下一手" }).click()
  }
  expect(shown, "hands turned over at the showdown").toBeGreaterThan(0)
  await expectLayoutToHold(page, "at the showdown")
  await expect(page.locator('[data-mark="used"]')).toHaveCount(5)
  await expect(page.getByRole("list", { name: "这一手打到哪一步" }).locator("[aria-current]")).toHaveText("摊牌")
})

test("the rules and the review of a hand open in dialogs that fit", async ({ page }) => {
  await openHoldem(page)
  await page.getByRole("button", { name: "规则", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "德州扑克怎么打" })).toBeVisible()
  await expectLayoutToHold(page, "with the rules open")
  await page.getByRole("button", { name: "知道了" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await playHoldemHand(page)
  const coach = page.getByRole("complementary", { name: "教练" })
  await expect(coach.getByRole("heading", { name: /这一手你做了 \d+ 个决定/ })).toBeVisible()
  // A wide screen lists the decisions in the coach's panel. A narrow one has a button for them instead.
  const review = page.getByRole("button", { name: "看复盘" })
  if (await review.isVisible()) {
    await review.click()
    await expect(page.getByRole("dialog", { name: "这一手的复盘" })).toBeVisible()
    await expectLayoutToHold(page, "with the review open")
  } else {
    await expect(coach.locator('[data-slot="he-review"]')).toBeVisible()
  }
})

test("with the coach off, a hand still fits and the table news stays in one line", async ({ page }) => {
  await openHoldem(page)
  await page.getByRole("button", { name: "教练", exact: true }).click()
  await expect(page.getByRole("button", { name: "教练", exact: true })).toHaveAttribute("aria-pressed", "false")
  await expect(page.getByRole("complementary", { name: "牌桌动态" })).toBeVisible()
  await expect(page.getByRole("complementary", { name: "教练" })).toHaveCount(0)
  for (let step = 0; step < 200 && !(await screen(page)).over; step++) {
    if ((await screen(page)).myTurn) {
      await expectLayoutToHold(page, `with the coach off, at step ${step}`)
      await page.getByRole("button", { name: /^(过牌|跟注)/ }).click()
    } else await waitForNextMove(page)
  }
  await expectLayoutToHold(page, "with the coach off, when the hand is over")
  await expect(page.getByRole("button", { name: "看复盘" })).toHaveCount(0)
})
