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

test("a raise of any size can be chosen, the minimum and all-in included", async ({ page }) => {
  await openHoldem(page)
  // The raise button, not the 全下 size button, which has the same words.
  const raise = page.locator('[data-slot="he-buttons"] [data-variant="raise"]')
  await expect(raise).toBeVisible()
  const slider = page.getByRole("slider")
  // A phone on its side has only the slider; an upright phone only the size buttons; a wide screen both.
  if (await slider.isVisible()) {
    // The slider says the amount it is set to; the raise button must say the same at both ends.
    await slider.focus()
    for (const key of ["End", "Home"]) {
      await page.keyboard.press(key)
      const amount = (await slider.getAttribute("aria-valuetext")) ?? ""
      await expect(raise).toHaveText(new RegExp(`${amount}$`))
    }
  } else {
    const sizes = page.getByRole("group", { name: /多少$/ })
    for (const name of ["全下", "最小"]) {
      const size = sizes.getByRole("button", { name: new RegExp(`^${name}`) })
      await size.click()
      await expect(raise).toHaveText(new RegExp(`${(await size.locator("b").innerText()).replace(/,/g, ",")}$`))
    }
  }
  await expectLayoutToHold(page, "with a raise size picked")
})

// The four test sizes have no tablet and no short desktop window. These are where seat labels ran into each
// other or into the coach panel.
for (const [width, height] of [
  [900, 800],
  [1240, 800],
  [1280, 550],
]) {
  test(`a hand at ${width}×${height} keeps every label clear of the others`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-chromium", "one browser is enough for a size set by the test itself")
    await page.setViewportSize({ width, height })
    await openHoldem(page)
    await playHoldemHand(page, (when) => expectLayoutToHold(page, `at ${width}×${height}, ${when}`))
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

test("a hand played is kept: a reload carries on from the next hand, and the home page says so", async ({ page }) => {
  await openHoldem(page)
  await playHoldemHand(page)
  await page.reload()
  await expect(page.locator('[data-slot="he-hand"]')).toContainText("第 2 手")
  await page.getByRole("button", { name: /牌桌教练/ }).click()
  await expect(page.getByText(/^上次打到第 1 手，你有 [\d,]+ 筹码，进去接着打$/)).toBeVisible()
  await expectLayoutToHold(page, "on the home page with a saved table")
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

test("the coach's working after the flop fits, and a narrow screen opens all of it in a dialog", async ({ page }) => {
  await openHoldem(page)
  const working = page.getByRole("complementary", { name: "教练" }).locator('[data-slot="he-explain"]')
  // Checking or calling every time reaches the flop with the player still in.
  for (let step = 0; step < 300 && (await working.count()) === 0; step++) {
    const now = await screen(page)
    if (now.over) await page.getByRole("button", { name: "下一手" }).click()
    else if (now.myTurn) await page.getByRole("button", { name: /^(过牌|跟注)/ }).click()
    else await waitForNextMove(page)
  }
  await expect(working).toHaveCount(1)
  await expectLayoutToHold(page, "with the coach's working showing")
  // A wide screen shows every line in the panel. Where the coach is a bar, it keeps at most the 估算 line,
  // and a button opens the rest.
  const open = page.getByRole("button", { name: "怎么算的" })
  if (await open.isVisible()) {
    await open.click()
    const dialog = page.getByRole("dialog", { name: "教练是怎么算的" })
    await expect(dialog.getByText("你的牌", { exact: true })).toBeVisible()
    await expectLayoutToHold(page, "with the working open")
    await dialog.getByRole("button", { name: "知道了" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  } else {
    await expect(working.getByText("对手", { exact: true })).toBeVisible()
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
