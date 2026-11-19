import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { callDownTo, dealHoldemExactly, expectLayoutToHold, openGame, openHoldem, openHome, playHoldemHand, screen, waitForNextMove } from "./helpers"

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
// other or into the coach panel, and, under 740px wide, where the player's label ran into their cards and the
// buttons' words were cut off.
for (const [width, height] of [
  [900, 800],
  [1240, 800],
  [1280, 550],
  [700, 700],
  [640, 900],
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

test.describe("a nine-seat table", () => {
  test("a fresh deal fits the screen with eight opponents", async ({ page }) => {
    await openHoldem(page, { seats: 9 })
    await expectLayoutToHold(page, "right after a nine-seat deal")
    await expect(page.getByRole("region", { name: /，/ })).toHaveCount(8)
    await expect(page.getByRole("complementary", { name: "教练" })).toBeVisible()
  })

  test("three hands played by the coach's advice keep every label clear of the others", async ({ page }) => {
    await openHoldem(page, { seats: 9 })
    for (let hand = 1; hand <= 3; hand++) {
      await playHoldemHand(page, (when) => expectLayoutToHold(page, `at nine seats, in hand ${hand}, ${when}`))
      await page.getByRole("button", { name: "下一手" }).click()
      await expect(page.locator('[data-slot="he-hand"]')).toContainText(`第 ${hand + 1} 手`)
    }
  })

  // 1280×500 and 800×600 draw the table at --u of about 0.62, where bets ran into labels and the top seats into the banner.
  for (const [width, height] of [
    [900, 800],
    [1240, 800],
    [1280, 550],
    [1280, 500],
    [800, 600],
    [700, 700],
    [640, 900],
  ]) {
    test(`a hand at ${width}×${height} keeps every label clear of the others`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop-chromium", "one browser is enough for a size set by the test itself")
      await page.setViewportSize({ width, height })
      await openHoldem(page, { seats: 9 })
      await playHoldemHand(page, (when) => expectLayoutToHold(page, `at nine seats, ${width}×${height}, ${when}`))
    })
  }

  test("picking 9 人 in 设置 deals eight opponents, and a reload before the hand ends keeps nine", async ({ page }) => {
    await openHoldem(page)
    await page.getByRole("button", { name: "设置", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "电脑玩家水平" })
    await dialog.getByRole("radio", { name: "9 人", exact: true }).click()
    await expect(dialog.getByRole("radio", { name: "9 人", exact: true })).toHaveAttribute("aria-checked", "true")
    await expectLayoutToHold(page, "with 9 人 picked in 设置")
    await dialog.getByRole("button", { name: /^确认：换成 9 人桌/ }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByRole("region", { name: /，/ })).toHaveCount(8)
    await expectLayoutToHold(page, "after switching to nine seats")
    await page.reload()
    await expect(page.locator('[data-slot="he-hand"]')).toContainText("第 1 手")
    await expect(page.getByRole("region", { name: /，/ })).toHaveCount(8)
    await expect(page.getByRole("region", { name: /^辛，/ })).toHaveCount(1)
    await expectLayoutToHold(page, "after a reload at a nine-seat table")
  })

  test("an exact deal gives 辛, the eighth opponent, the cards asked for, shown at the showdown", async ({ page }) => {
    await openHoldem(page, { seats: 9 })
    await dealHoldemExactly(page, { holes: { 0: "KH KD", 8: "AS AC" }, board: "2C 7S 9D 4H 3S" })
    await expect(page.getByRole("list", { name: /^你的手牌：/ })).toHaveAttribute("aria-label", /红桃K/)
    await expect(page.getByRole("list", { name: /^你的手牌：/ })).toHaveAttribute("aria-label", /方块K/)
    for (let step = 0; step < 200 && !(await screen(page)).over; step++) {
      if ((await screen(page)).myTurn) await page.getByRole("button", { name: /^(过牌|跟注)/ }).click()
      else await waitForNextMove(page)
    }
    await expect(page.getByRole("list", { name: "这一手打到哪一步" }).locator("[aria-current]")).toHaveText("摊牌")
    await expect(page.getByRole("list", { name: "公共牌：梅花2、黑桃7、方块9、红桃4、黑桃3" })).toBeVisible()
    const xin = page.getByRole("region", { name: /^辛，/ }).locator('[data-slot="he-shown"]')
    await expect(xin).toContainText("黑桃A")
    await expect(xin).toContainText("梅花A")
    await expectLayoutToHold(page, "at a nine-seat showdown")
  })
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
  // The second hand has been dealt, and it is saved as soon as it is.
  await page.getByRole("button", { name: /牌桌教练/ }).click()
  await expect(page.getByText(/^上次打到第 2 手，你有 [\d,]+ 筹码，进去接着打$/)).toBeVisible()
  await expectLayoutToHold(page, "on the home page with a saved table")
})

test("a hand left halfway comes back as it was, from the home page or a reload: the same cards, board and hand", async ({ page }) => {
  await openHoldem(page)
  await dealHoldemExactly(page, { holes: { 0: "AH KH" }, board: "QD 9S 4H 3C JD" })
  await callDownTo(page, 3)
  const table = async () => ({
    hand: await page.locator('[data-slot="he-hand"]').textContent(),
    mine: await page.getByRole("list", { name: /^你的手牌：/ }).getAttribute("aria-label"),
    board: await page.getByRole("list", { name: /^公共牌：/ }).getAttribute("aria-label"),
    pot: await page.locator('[data-slot="he-pot"]').textContent(),
  })
  const left = await table()
  expect(left).toMatchObject({ mine: "你的手牌：红桃A、红桃K", board: "公共牌：方块Q、黑桃9、红桃4" })
  // Browser storage keeps the hand as a number and the actions, naming no one's cards.
  const saved = (await page.evaluate(() => localStorage.getItem("guandan.holdem.table"))) ?? ""
  expect(saved).toMatch(/"order":"[0-9a-z]+"/)
  expect(saved).not.toMatch(/"(deck|hole|board|cards?|suit|rank)"/)

  await page.getByRole("button", { name: /牌桌教练/ }).click()
  await expect(page.getByText(/^上次打到第 1 手，你有 2,000 筹码，进去接着打$/)).toBeVisible()
  await page.getByRole("button", { name: "进入德州扑克牌桌" }).click()
  await expect(page.getByRole("list", { name: /^公共牌：/ })).toBeVisible()
  expect(await table()).toEqual(left)

  await page.reload()
  await expect(page.getByRole("list", { name: /^公共牌：/ })).toBeVisible()
  expect(await table()).toEqual(left)
  await expect(page.getByRole("button", { name: "弃牌", exact: true })).toBeVisible()
  await expectLayoutToHold(page, "after coming back to a hand left halfway")
})

test("the home page picks nine seats before the table opens: eight opponents, and the choice is kept", async ({ page }) => {
  await openHome(page)
  const picker = page.getByRole("radiogroup", { name: "牌桌人数" })
  await expect(picker.getByRole("radio", { name: "6 人", exact: true })).toHaveAttribute("aria-checked", "true")
  await expectLayoutToHold(page, "on the home page before picking a size")
  await picker.getByRole("radio", { name: "9 人", exact: true }).click()
  await expect(picker.getByRole("radio", { name: "9 人", exact: true })).toHaveAttribute("aria-checked", "true")
  await expectLayoutToHold(page, "on the home page with 9 人 picked")
  const enter = page.getByRole("button", { name: "进入德州扑克牌桌" })
  await enter.scrollIntoViewIfNeeded()
  await enter.click()
  await expect(page.getByRole("region", { name: /，/ })).toHaveCount(8)
  await page.getByRole("button", { name: /牌桌教练/ }).click()
  await expect(page.getByRole("radiogroup", { name: "牌桌人数" }).getByRole("radio", { name: "9 人", exact: true })).toHaveAttribute("aria-checked", "true")
})

test("the home page opens the size picked even when the browser refuses to store it", async ({ page }) => {
  await openHome(page)
  await page.evaluate(() => {
    const refuse = () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    }
    Storage.prototype.setItem = refuse
    Storage.prototype.removeItem = refuse
  })
  await page.getByRole("radiogroup", { name: "牌桌人数" }).getByRole("radio", { name: "9 人", exact: true }).click()
  const enter = page.getByRole("button", { name: "进入德州扑克牌桌" })
  await enter.scrollIntoViewIfNeeded()
  await enter.click()
  await expect(page.getByRole("region", { name: /，/ })).toHaveCount(8)
})

test("with a table in progress, the home page warns before a different size replaces it", async ({ page }) => {
  await openHoldem(page)
  await playHoldemHand(page)
  await page.getByRole("button", { name: /牌桌教练/ }).click()
  const picker = page.getByRole("radiogroup", { name: "牌桌人数" })
  await picker.getByRole("radio", { name: "9 人", exact: true }).click()
  await expect(page.getByText(/^上次的 6 人桌打到第 1 手。换成 9 人桌会从第 1 手重新开始，上次的进度不保留$/)).toBeVisible()
  await expectLayoutToHold(page, "on the home page with a switch to nine seats waiting")
  await picker.getByRole("radio", { name: "6 人", exact: true }).click()
  await expect(page.getByRole("button", { name: "进入德州扑克牌桌" })).toBeVisible()
  await picker.getByRole("radio", { name: "9 人", exact: true }).click()
  const open = page.getByRole("button", { name: "开一张 9 人桌" })
  await open.scrollIntoViewIfNeeded()
  await open.click()
  await expect(page.locator('[data-slot="he-hand"]')).toContainText("第 1 手")
  await expect(page.getByRole("region", { name: /，/ })).toHaveCount(8)
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
    // Opening focuses the dialog itself, not 知道了 at its end: some Safari versions scroll a focused button into view,
    // which opened a long working at its last lines with the first ones out of reach.
    await expect(dialog).toBeFocused()
    // An ancestor with a transform, filter, perspective or containment would make the dialog's fixed position measure
    // from that box instead of the screen, which some Safari versions do even in the top layer: the dialog then sat
    // over the coach bar near the top of the page with its first lines above the screen.
    const capturing = await dialog.evaluate((el) => {
      const found: string[] = []
      for (let up = el.parentElement; up; up = up.parentElement) {
        const css = getComputedStyle(up)
        const captures =
          css.transform !== "none" || css.filter !== "none" || css.perspective !== "none" || css.backdropFilter !== "none" ||
          /paint|layout|strict|content/.test(css.contain) || /transform|filter|perspective/.test(css.willChange)
        if (captures) found.push(up.dataset.slot ?? up.tagName)
      }
      return found
    })
    expect(capturing, "ancestors of the working dialog that capture a fixed element").toEqual([])
    await dialog.getByRole("button", { name: "知道了" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  } else {
    await expect(working.getByText("对手", { exact: true })).toBeVisible()
  }
})

/** Raises all-in, from the slider or the size buttons, whichever this screen has. */
async function allIn(page: Page) {
  const slider = page.getByRole("slider")
  if (await slider.isVisible()) {
    await slider.focus()
    await page.keyboard.press("End")
  } else {
    await page.getByRole("group", { name: /多少$/ }).getByRole("button", { name: /^全下/ }).click()
  }
  await page.locator('[data-slot="he-buttons"] [data-variant="raise"]').click()
}

/** Lets the computer players act until the hand is over. */
async function waitForTheEnd(page: Page) {
  for (let step = 0; step < 100 && !(await screen(page)).over; step++) await waitForNextMove(page)
}

const TABLE_KEY = "guandan.holdem.table"

test("a player who is out of chips shows as 出局, and the table plays on without them", async ({ page }) => {
  await openHoldem(page)
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: "", handNumber: 4, button: 0, stacks: [2000, 0, 2000, 0, 2000, 6000] })), TABLE_KEY)
  await page.reload()
  await expect(page.getByRole("region", { name: "甲，出局" })).toContainText("没有筹码了")
  await expect(page.getByRole("region", { name: "丙，出局" })).toContainText("没有筹码了")
  await expectLayoutToHold(page, "with two seats out")
  await playHoldemHand(page, (when) => expectLayoutToHold(page, `with two seats out, ${when}`))
  await expect(page.getByRole("button", { name: "下一手" })).toBeVisible()
})

test("a small blind shorter than 10 puts only what it has into the pot", async ({ page }) => {
  await openHoldem(page)
  // The button moves from the player to 甲, so 乙, with 5 chips, posts the small blind.
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: "", handNumber: 8, button: 0, stacks: [2000, 2000, 5, 2000, 2000, 2000] })), TABLE_KEY)
  await page.reload()
  await expect(page.locator('[data-slot="he-pot"]')).toHaveText(/底池\s*25$/)
  await expect(page.getByRole("region", { name: /^乙/ })).toContainText("全下")
  await playHoldemHand(page)
  await expectLayoutToHold(page, "after a hand with a short small blind")
})

test("a big blind too short to match the small blind leaves nothing to decide, and the board is dealt out", async ({ page }) => {
  await openHoldem(page)
  // Heads-up: the player has the button and posts 10; 甲 has only 5 for the big blind.
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: "", handNumber: 12, button: 5, stacks: [11995, 5, 0, 0, 0, 0] })), TABLE_KEY)
  await page.reload()
  await expect(page.getByRole("button", { name: /^(下一手|再开一桌)$/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "弃牌" })).toHaveCount(0)
  await expect(page.getByRole("list", { name: /^公共牌：/ }).getByRole("listitem")).toHaveCount(5)
  await expectLayoutToHold(page, "after a hand dealt out with no decision")
})

test("folding against a covered short blind deals the board out at once", async ({ page }) => {
  await openHoldem(page)
  // Three left, the player on the button: 甲 posts 10, 乙 is all-in for 5. Once the player folds, 甲 already
  // covers 乙, so there is no decision left for 甲 and the hand ends without waiting for a move.
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: "", handNumber: 12, button: 5, stacks: [2000, 2000, 5, 0, 0, 0] })), TABLE_KEY)
  await page.reload()
  await page.getByRole("button", { name: "弃牌", exact: true }).click()
  expect((await screen(page)).over).toBe(true)
  await expect(page.getByRole("list", { name: /^公共牌：/ }).getByRole("listitem")).toHaveCount(5)
  await expectLayoutToHold(page, "after a covered short blind is dealt out")
})

test("heads-up, the coach tells the button it acts first before the flop", async ({ page }) => {
  await openHoldem(page)
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: "", handNumber: 20, button: 5, stacks: [2000, 2000, 0, 0, 0, 0] })), TABLE_KEY)
  await page.reload()
  // The coach names the seat with a weak or middling hand; fold the others until such a hand comes on the button.
  const coach = page.getByRole("complementary", { name: "教练" })
  let said = ""
  for (let step = 0; step < 200 && !said; step++) {
    const now = await screen(page)
    const preflop = (await page.locator('[data-slot="he-board"] [data-slot="playing-card"]').count()) === 0
    const text = (await coach.textContent()) ?? ""
    if (now.myTurn && preflop && text.includes("你在庄位")) said = text
    else if (now.over) await page.getByRole("button", { name: "下一手" }).click()
    else if (now.myTurn) await page.getByRole("button", { name: "弃牌", exact: true }).click()
    else await waitForNextMove(page)
  }
  expect(said).toContain("两个人时庄位也是小盲：翻牌前你先行动，翻牌后你最后行动")
  expect(said).not.toContain("能先看别人怎么做")
  await expectLayoutToHold(page, "with the heads-up advice showing")
})

test("a player who loses every chip is out, and 再开一桌 starts a new table", async ({ page }) => {
  await openHoldem(page)
  // All-in with seven-two; 甲 calls with aces, and the board gives the player nothing.
  await dealHoldemExactly(page, { holes: { 0: "7C 2D", 1: "AH AS" }, board: "KD 9S 4H 3C JD" })
  await callDownTo(page, 0)
  await allIn(page)
  await waitForTheEnd(page)
  await expect(page.locator('[data-slot="he-banner"] b')).toHaveText("你出局了")
  await expect(page.getByRole("button", { name: "下一手" })).toHaveCount(0)
  await expectLayoutToHold(page, "when the player is out")
  await page.getByRole("button", { name: "再开一桌" }).click()
  await expect(page.locator('[data-slot="he-hand"]')).toContainText("第 1 手")
  await expect(page.locator('[data-slot="he-seat"][data-out]')).toHaveCount(0)
})

test("a player left with every chip wins the table", async ({ page }) => {
  await openHoldem(page)
  // Heads-up against one big blind, calling every time: 甲 is all-in in every hand and soon out.
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: "", handNumber: 30, button: 0, stacks: [11980, 20, 0, 0, 0, 0] })), TABLE_KEY)
  await page.reload()
  const again = page.getByRole("button", { name: "再开一桌" })
  for (let step = 0; step < 400 && !(await again.isVisible()); step++) {
    const now = await screen(page)
    if (now.over) await page.getByRole("button", { name: "下一手" }).click()
    else if (now.myTurn) await page.getByRole("button", { name: /^(过牌|跟注)/ }).click()
    else await waitForNextMove(page)
  }
  await expect(page.locator('[data-slot="he-banner"] b')).toHaveText("全桌冠军")
  await expectLayoutToHold(page, "when the player has won the table")
})

test("the 2-and-4 rule is explained with the hand's own numbers, and in 规则", async ({ page }) => {
  await openHoldem(page)
  // A player asked what "3 张有效牌 × 4" meant on this flop: the three other aces make top pair.
  await dealHoldemExactly(page, { holes: { 0: "AH 9H", 1: "JC TC" }, board: "KC QS 3H 7D 2S" })
  await callDownTo(page, 3)
  const working = page.getByRole("complementary", { name: "教练" }).locator('[data-slot="he-explain"]')
  await expect(working).toContainText("来一张 A 就成顶对（还剩 3 张）")
  await expect(working).toContainText("你看不到的牌有 47 张，每发一张，某一张牌出现的机会约 2%。还要发转牌和河牌两张，每张有效牌约 2% + 2% = 4%，所以 3 × 4 ≈ 12%。")
  // Where the coach is a bar, the explanation is in the dialog; on a wide screen it is in the panel.
  const open = page.getByRole("button", { name: "怎么算的" })
  if (await open.isVisible()) {
    await open.click()
    const dialog = page.getByRole("dialog", { name: "教练是怎么算的" })
    await expect(dialog.getByText("二四法则", { exact: true })).toBeVisible()
    await expectLayoutToHold(page, "with the 2-and-4 rule in the working")
    await dialog.getByRole("button", { name: "知道了" }).click()
  } else {
    await expect(working.getByText("二四法则", { exact: true })).toBeVisible()
  }
  await page.getByRole("button", { name: "规则", exact: true }).click()
  const rules = page.getByRole("dialog", { name: "德州扑克怎么打" })
  await expect(rules.getByRole("heading", { name: "自己估胜率" })).toBeVisible()
  await expect(rules.getByText(/二四法则/)).toBeVisible()
  await expect(rules.getByText(/跟注的钱 ÷ 跟注后你能赢的全部筹码/)).toBeVisible()
  await expect(rules.getByText(/底池里的全部筹码/)).toHaveCount(0)
  await expectLayoutToHold(page, "with the rules open")
})

// Hands that the coach's working once got wrong, each dealt exactly and called down by the player. The working is
// read from the page as it is, whether a row is shown in the bar or only in the 怎么算的 dialog.
test.describe("the coach's working on hands it once got wrong", () => {
  // The words do not depend on the browser or the screen size, so one project is enough.
  test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "checked on desktop Chromium only")
  const working = (page: Page) => page.getByRole("complementary", { name: "教练" }).locator('[data-slot="he-explain"]')

  test("a straight that is all on the board is not the player's, and its cards are not outs", async ({ page }) => {
    await openHoldem(page)
    await dealHoldemExactly(page, { holes: { 0: "5H 2D", 1: "AH AC" }, board: "5S 6D 7C 8H 9S" })
    await expect(page.getByRole("list", { name: "你的手牌：红桃5、方块2" })).toBeVisible()
    await callDownTo(page, 4)
    await expect(working(page)).toContainText("来一张 2 就成两对（还剩 3 张）；来一张 5 就成三条（还剩 2 张）")
    await expect(working(page)).not.toContainText("顺子")
    await callDownTo(page, 5)
    await expect(working(page)).toContainText("顺子 到 9：这手牌全在公共牌上，大家都有")
    await expect(working(page)).toContainText("这手牌大家都有，最多和别人平分")
  })

  test("on the river a pair counts no outs and is not told it wins only against a bluff", async ({ page }) => {
    await openHoldem(page)
    await dealHoldemExactly(page, { holes: { 0: "9H 9D", 1: "KH KC" }, board: "AS 8C 3D 2S 4H" })
    await callDownTo(page, 5)
    await expect(working(page)).toContainText("牌已经发完，比的是现在谁大：你的对子能赢更小的对子，也能赢诈唬")
    await expect(working(page)).not.toContainText("能帮你的牌")
    await expect(working(page)).not.toContainText("诈唬时你才赢")
  })

  test("with four of a kind on the board, the best fifth card cannot lose", async ({ page }) => {
    await openHoldem(page)
    await dealHoldemExactly(page, { holes: { 0: "AH 2D", 1: "QH QC" }, board: "KS KC KD KH 3S" })
    await callDownTo(page, 5)
    await expect(working(page)).toContainText("四条 K 在公共牌上，你的 A 是最大的第五张，没人能赢你")
    await expect(working(page)).toContainText("没人能赢你，最多和别人平分")
  })

  test("a straight all on the board is not called behind the player who bets it", async ({ page }) => {
    await openHoldem(page)
    // 甲 holds a bigger straight and bets the river; the player's best five are the board's straight.
    await dealHoldemExactly(page, { holes: { 0: "2D 3H", 1: "TC JD" }, board: "5S 6D 7C 8H 9S" })
    await callDownTo(page, 5)
    await expect(working(page)).toContainText("顺子 到 9：这手牌全在公共牌上，大家都有")
    await expect(working(page)).toContainText("这手牌你和他都有，他的牌要比公共牌大才能赢你")
    await expect(working(page)).not.toContainText("多半落后")
  })

  test("a kicker that is not in the best five is not called the player's kicker", async ({ page }) => {
    await openHoldem(page)
    await dealHoldemExactly(page, { holes: { 0: "KS 2D", 1: "AH AC" }, board: "KH QC JS 9D 8C" })
    await callDownTo(page, 5)
    await expect(working(page)).toContainText("顶对 K，另一张 2 用不上：踢脚是公共牌上的 Q、J、9")
    await expect(working(page)).not.toContainText("踢脚 2")
    // Against the river bet this deal brings, the simulation puts the hand behind, so the coach must not say ahead.
    await expect(working(page)).toContainText("对手有一张 10 就是顺子")
    await expect(working(page)).not.toContainText("你多半已经领先")
  })

  test("top pair on a board of four spades is not called ahead, and the board says why", async ({ page }) => {
    await openHoldem(page)
    await dealHoldemExactly(page, { holes: { 0: "AH 2D", 1: "9S 8D" }, board: "AS KS QS JS 3D" })
    await callDownTo(page, 5)
    await expect(working(page)).toContainText("对手有一张黑桃就是同花，有一张 10 就是顺子")
    await expect(working(page)).toContainText("顶对常常领先，但会输给两对、三条、同花、顺子")
    await expect(working(page)).not.toContainText("你多半已经领先")
  })

  test("a high-card hand is named by its top card, not the player's highest card", async ({ page }) => {
    await openHoldem(page)
    await dealHoldemExactly(page, { holes: { 0: "TH 2D", 1: "JH JC" }, board: "AS KC QD 7H 4S" })
    await callDownTo(page, 5)
    await expect(working(page)).toContainText("只有 A 高，还没成牌：A 在公共牌上，你的 10 当踢脚")
    await expect(working(page)).not.toContainText("只有 10 高")
  })

  test("a river where only the board plays is the board's hand, not the player's low card", async ({ page }) => {
    await openHoldem(page)
    await dealHoldemExactly(page, { holes: { 0: "3H 2D", 1: "KH KC" }, board: "AS QD JH 9S 7C" })
    await callDownTo(page, 5)
    await expect(working(page)).toContainText("这手牌全在公共牌上，大家都有")
    await expect(working(page)).toContainText("这手牌大家都有，最多和别人平分")
    await expect(working(page)).not.toContainText("只有 3 高")
  })
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
