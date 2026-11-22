import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { MAHJONG_SAVE_EXHAUSTED_WAIT, MAHJONG_SAVE_FOUR_CALLS, MAHJONG_SAVE_MANY_CALLS, MAHJONG_SAVE_NO_SAFE_TILE, MAHJONG_SAVE_THREE_INDICATORS, dealMahjongExactly, expectLayoutToHold, openHome, openMahjong, playMahjongHand, playMahjongMove, screen, waitForNextMove } from "./helpers"

// The rules of mahjong are tested in src/mahjong. These tests ask what the other two games' tests ask:
// on a real browser at this screen size, can a player see and reach everything?

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

test("the home page offers mahjong, and the table opens from it and comes back", async ({ page }) => {
  await openHome(page)
  await expectLayoutToHold(page, "on the home page with three games")
  const enter = page.getByRole("button", { name: "进入日本麻将牌桌" })
  await enter.scrollIntoViewIfNeeded()
  await expect(enter).toBeInViewport({ ratio: 1 })
  await enter.click()
  await expect(page.getByRole("list", { name: /^你的手牌/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("list", { name: /^你的手牌/ })).toBeVisible()
  await page.getByRole("button", { name: "回到首页", exact: true }).click()
  await expect(page.getByRole("heading", { name: "今天练哪一桌？" })).toBeVisible()
})

test("every tile shows its picture, and the table picture loads", async ({ page }) => {
  await openMahjong(page)
  // The hand is on screen before its pictures have arrived, so give them time: a picture that never loads still fails.
  const broken = () => page.evaluate(() => [...document.querySelectorAll("img")].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src))
  await expect.poll(broken, "tile pictures that did not load").toEqual([])
  const pictures = ["/mahjong/parlour.jpg", "/mahjong/wall/front-1.png", "/mahjong/wall/front-2.png", "/mahjong/wall/side-1.png", "/mahjong/wall/side-2.png"]
  const missing = await page.evaluate((paths) => Promise.all(paths.map((path) => fetch(path).then((response) => (response.ok ? null : path)))), pictures)
  expect(missing.filter(Boolean), "pictures of the table and the wall that are not served").toEqual([])
})

test("a whole hand keeps everything on screen and clear of everything else", async ({ page }) => {
  await openMahjong(page)
  await dealMahjongExactly(page, 3)
  await playMahjongHand(page, (when) => expectLayoutToHold(page, when))
  await expect(page.getByRole("status", { name: "这一局的结果" })).toBeVisible()
  await page.getByRole("button", { name: /^(下一局|再开一场)$/ }).click()
  await expect(page.getByRole("status", { name: "这一局的结果" })).toHaveCount(0)
  await expectLayoutToHold(page, "after dealing the next hand")
})

test("a tile lifts on the first tap and is discarded by 打出", async ({ page }) => {
  await openMahjong(page)
  await dealMahjongExactly(page, 3)
  for (let step = 0; step < 40 && !(await screen(page)).myTurn; step++) await waitForNextMove(page)
  while ((await page.locator('[data-slot="mj-actions"]').getByRole("button", { name: "打出", exact: true }).count()) === 0) await playMahjongMove(page)
  const hand = page.locator('[data-slot="mj-hand"] [data-slot="mj-tile"]')
  const tiles = await hand.count()
  const discard = page.getByRole("button", { name: "打出", exact: true })
  await expect(discard).toBeDisabled()
  await hand.first().click()
  await expect(hand.first()).toHaveAttribute("aria-pressed", "true")
  await expectLayoutToHold(page, "with a tile lifted")
  const mine = page.getByRole("region", { name: "你的牌河" }).locator('[data-slot="mj-tile"]')
  const before = await mine.count()
  await discard.click()
  await expect(mine).toHaveCount(before + 1)
  await expect(hand).toHaveCount(tiles - 1)
})

test("the top bar holds up to five 宝牌 indicators and a 立直 stick without pushing 设置 off the screen", async ({ page }) => {
  await openMahjong(page, { save: MAHJONG_SAVE_THREE_INDICATORS })
  const indicators = page.getByRole("group", { name: /^宝牌指示牌：/ }).getByRole("img")
  await expect(indicators).toHaveCount(3)
  await expect(page.locator('[data-slot="mj-round"]')).toContainText("供托")
  await expect(page.getByRole("button", { name: "设置", exact: true })).toBeInViewport({ ratio: 1 })
  await expectLayoutToHold(page, "with three indicators and a stick on the table")
  // Five indicators need four 杠 in one hand, which no saved hand here has. The bar is given two more of the same
  // tiles to stand in for them: what is checked is the room in the bar, not the rules.
  await page.evaluate(() => {
    const bar = document.querySelector('[data-slot="mj-dora"]')
    const tile = bar?.querySelector('[data-slot="mj-tile"]')
    if (bar && tile) bar.append(tile.cloneNode(true), tile.cloneNode(true))
  })
  await expect(indicators).toHaveCount(5)
  await expect(page.getByRole("button", { name: "设置", exact: true })).toBeInViewport({ ratio: 1 })
  await expectLayoutToHold(page, "with five indicators and a stick on the table")
})

test("every answer to a discard can be reached when seven are offered at once", async ({ page }) => {
  await openMahjong(page, { save: MAHJONG_SAVE_MANY_CALLS })
  const answers = page.locator('[data-slot="mj-actions"]').getByRole("button")
  await expect(answers).toHaveCount(5)
  await expectLayoutToHold(page, "with 碰, three 吃 and 过 offered")
  // The most a discard can offer is seven: 荣和 and 杠 as well. No saved hand here has that, so two more buttons
  // stand in for them: what is checked is the room for the buttons, not the rules.
  await page.evaluate(() => {
    const row = document.querySelector('[data-slot="mj-actions"]')
    const button = row?.querySelector("button")
    if (row && button) row.prepend(button.cloneNode(true), button.cloneNode(true))
  })
  await expect(answers).toHaveCount(7)
  for (const answer of await answers.all()) await expect(answer).toBeInViewport({ ratio: 1 })
  await expectLayoutToHold(page, "with seven answers offered")
})

/** Where the felt is in a picture of the table, as shares of the picture: a trapezium, narrower at the far edge. */
interface Felt {
  picture: string
  /** Height over width. */
  ratio: number
  top: number
  bottom: number
  /** How far in from each side the felt starts, at its far edge and at its near edge. */
  insetTop: number
  insetBottom: number
}

// The landscape picture is 1672 by 941: its felt's far edge is 12.5% of the way down, from 21.4% to 78.6% across,
// its near edge 84.8% down, from 4.3% to 95.7% across. The upright one is 1086 by 1448: its felt runs from 20.4% to
// 73.5% of the way down, from 13.6% in at the far edge to 7.1% in at the near one.
const LANDSCAPE: Felt = { picture: "parlour.jpg", ratio: 941 / 1672, top: 0.125, bottom: 0.848, insetTop: 0.214, insetBottom: 0.043 }
const UPRIGHT: Felt = { picture: "parlour-upright.jpg", ratio: 1448 / 1086, top: 0.204, bottom: 0.735, insetTop: 0.136, insetBottom: 0.071 }

/** What on the table is off the felt of its picture, and whether the picture is the one expected. */
function offTheFelt(page: Page, felt: Felt) {
  return page.evaluate((f) => {
    const table = document.querySelector('[data-slot="mj-table"]')
    if (!table) return ["no table"]
    const box = table.getBoundingClientRect()
    const style = getComputedStyle(table, "::before")
    if (!style.backgroundImage.includes(`/mahjong/${f.picture}`)) return [`the table picture is ${style.backgroundImage}, not ${f.picture}`]
    const wide = Number.parseFloat(style.backgroundSize)
    const high = wide * f.ratio
    const left = box.left + box.width / 2 - wide / 2
    const top = box.top + box.height / 2 - high / 2
    const inset = (y: number) => f.insetTop + ((f.insetBottom - f.insetTop) * ((y - top) / high - f.top)) / (f.bottom - f.top)
    const problems: string[] = []
    for (const el of document.querySelectorAll('[data-slot="mj-wall-side"], [data-slot="mj-river"], [data-slot="mj-grid"] [data-slot="mj-melds"]')) {
      const r = el.getBoundingClientRect()
      const name = el.getAttribute("aria-label") ?? el.getAttribute("data-side") ?? ""
      if (r.top < top + f.top * high - 2 || r.bottom > top + f.bottom * high + 2) problems.push(`${name} is above or below the felt`)
      for (const y of [r.top, r.bottom]) {
        if (r.left < left + inset(y) * wide - 2 || r.right > left + (1 - inset(y)) * wide + 2) problems.push(`${name} is off the side of the felt`)
      }
    }
    return [...new Set(problems)]
  }, felt)
}

test("the wall and the 牌河 stay on the felt of the table picture at any shape of window", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "one browser is enough for a rule of the stylesheet")
  // A window near 4:3 once showed the whole picture with the wall standing on its wooden rim.
  for (const size of [{ width: 763, height: 639 }, { width: 1280, height: 720 }, { width: 1000, height: 900 }, { width: 1600, height: 620 }]) {
    await page.setViewportSize(size)
    await openMahjong(page)
    expect(await offTheFelt(page, LANDSCAPE), `what is off the felt at ${size.width}×${size.height}`).toEqual([])
    await expectLayoutToHold(page, `at ${size.width}×${size.height}`)
  }
})

test("an upright phone keeps the wall and the 牌河 on the felt of its own table picture", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "one browser is enough for a rule of the stylesheet")
  for (const size of [{ width: 393, height: 745 }, { width: 402, height: 874 }, { width: 360, height: 740 }, { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 375, height: 550 }]) {
    await page.setViewportSize(size)
    await openMahjong(page, { save: MAHJONG_SAVE_MANY_CALLS })
    expect(await offTheFelt(page, UPRIGHT), `what is off the felt at ${size.width}×${size.height}`).toEqual([])
    await expectLayoutToHold(page, `at ${size.width}×${size.height}`)
  }
})

test("the coach says what to discard, its working fits the screen, and it can be turned off", async ({ page }) => {
  await openMahjong(page)
  await dealMahjongExactly(page, 3)
  for (let step = 0; step < 40 && (await page.locator('[data-slot="mj-actions"]').getByRole("button", { name: "打出", exact: true }).count()) === 0; step++) {
    if ((await screen(page)).myTurn) await playMahjongMove(page)
    else await waitForNextMove(page)
  }
  const coach = page.getByRole("complementary", { name: "教练" })
  await expect(coach).toHaveAttribute("data-pick", /.+/)
  await expect(coach).toBeInViewport({ ratio: 1 })
  await expectLayoutToHold(page, "with the coach's advice showing")
  await coach.getByRole("button", { name: "怎么算的", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expectLayoutToHold(page, "with the coach's working open")
  // The dialog is a light panel inside the coach's dark one. Its words must take the dialog's colours, not the panel's cream.
  const inks = await page.getByRole("dialog").evaluate((dialog) => {
    const ink = (selector: string) => getComputedStyle(dialog.querySelector(selector) ?? dialog).color
    return { dialog: getComputedStyle(dialog).color, title: ink("h2"), move: ink('[data-slot="mj-options"] b'), note: ink('[data-slot="mj-options"] li > span:last-child'), description: ink('[data-slot="dialog-description"]') }
  })
  expect(inks.title, "the dialog's title is the colour of the dialog's text").toBe(inks.dialog)
  expect(inks.move, "each option's move is the colour of the dialog's text").toBe(inks.dialog)
  expect(inks.note, "each option's numbers are the colour of the dialog's description").toBe(inks.description)
  await page.getByRole("dialog").getByRole("button", { name: "知道了", exact: true }).click()
  await page.getByRole("button", { name: "教练", exact: true }).click()
  await expect(coach).toHaveCount(0)
  await expectLayoutToHold(page, "with the coach off")
})

test("the coach does not call its discard safe when no tile in hand is", async ({ page }) => {
  await openMahjong(page, { save: MAHJONG_SAVE_NO_SAFE_TILE })
  const coach = page.getByRole("complementary", { name: "教练" })
  await expect(coach).toHaveAttribute("data-stance", "defend")
  const say = coach.locator('[data-slot="mj-say"]')
  await expect(say).toContainText("找不到更安全的牌，这张也有危险")
  await expect(say).not.toContainText("相对安全")
  await expectLayoutToHold(page, "with the coach defending with a dangerous tile")
})

test("the coach leaves out a 进张 whose four tiles are all on the table", async ({ page }) => {
  await openMahjong(page, { save: MAHJONG_SAVE_EXHAUSTED_WAIT })
  const coach = page.getByRole("complementary", { name: "教练" })
  // Twelve kinds would bring this hand nearer, but every tile of one of them has been discarded.
  await expect(coach.locator('[data-slot="mj-say"]')).toContainText("进张 11 种 33 张")
  // A phone's bar has no room for the list of options, so the count is read where every size shows it.
  await coach.getByRole("button", { name: "怎么算的", exact: true }).click()
  await expect(page.getByRole("dialog").getByRole("listitem").first()).toContainText("进张 11 种 33 张")
})

test("every section of the rules opens on the screen, with its example tiles drawn", async ({ page }) => {
  await openMahjong(page)
  await page.getByRole("button", { name: "规则", exact: true }).click()
  const rules = page.getByRole("dialog")
  const headings = rules.locator('[data-slot="accordion-trigger"]')
  await expect(headings).toHaveCount(11)
  // The first section also names the two winning shapes that are not four sets and a pair.
  await expect(rules).toContainText("七对子")
  await expect(rules).toContainText("国士无双")
  for (const heading of await headings.all()) {
    const name = (await heading.textContent()) ?? ""
    if ((await heading.getAttribute("aria-expanded")) !== "true") await heading.click()
    await expect(heading).toHaveAttribute("aria-expanded", "true")
    await expectLayoutToHold(page, `with the rules open at ${name}`)
    // A section's pictures start loading when it opens, so give them time: one that never loads still fails.
    const broken = () => rules.evaluate((dialog) => [...dialog.querySelectorAll("img")].filter((img) => img.checkVisibility() && (!img.complete || img.naturalWidth === 0)).length)
    await expect.poll(broken, { message: `tile pictures that did not load in ${name}` }).toBe(0)
  }
})

test("an upright phone lays the 牌河 out square, with the side seats' discards turned to face them, so its tiles are big enough to read", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "one browser is enough for a rule of the stylesheet")
  // Rows of six standing upright on all four sides made the 牌河 three times as wide as it was deep, and its tiles
  // 12px across on a 393px phone.
  await page.setViewportSize({ width: 393, height: 745 })
  await openMahjong(page, { save: MAHJONG_SAVE_MANY_CALLS })
  const shape = await page.evaluate(() => {
    const size = (selector: string) => {
      const r = document.querySelector(selector)?.getBoundingClientRect()
      return r ? { wide: r.width, high: r.height } : { wide: 0, high: 0 }
    }
    const side = (seat: number) => getComputedStyle(document.querySelector(`[data-slot="mj-river"][data-seat="${seat}"]`) ?? document.body).rotate
    return { grid: size('[data-slot="mj-grid"]'), tile: size('[data-slot="mj-river"][data-seat="0"] [data-slot="mj-tile"]').wide, left: side(3), right: side(1) }
  })
  expect(shape.tile, "a tile in the 牌河 is at least 15px across").toBeGreaterThanOrEqual(15)
  expect(Math.abs(shape.grid.wide - shape.grid.high), `the 牌河 is ${Math.round(shape.grid.wide)}×${Math.round(shape.grid.high)}`).toBeLessThan(shape.grid.wide * 0.1)
  expect([shape.left, shape.right], "上家's 牌河 turns a quarter clockwise, 下家's a quarter the other way").toEqual(["90deg", "-90deg"])
  await expectLayoutToHold(page, "with the square 牌河")
})

test("on an upright phone an opponent's four calls fit in their corner of the 牌河", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "one browser is enough for a rule of the stylesheet")
  for (const size of [{ width: 393, height: 745 }, { width: 360, height: 740 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(size)
    await openMahjong(page, { save: MAHJONG_SAVE_FOUR_CALLS })
    const calls = page.locator('[data-slot="mj-grid"] [data-slot="mj-melds"]').filter({ has: page.locator('[data-slot="mj-meld"]:nth-child(4)') })
    await expect(calls).toHaveCount(1)
    const fits = await calls.evaluate((corner) => {
      const box = corner.getBoundingClientRect()
      const cell = corner.parentElement?.getBoundingClientRect()
      const grid = getComputedStyle(corner.parentElement ?? corner)
      const [, , side] = grid.gridTemplateColumns.split(" ").map(Number.parseFloat)
      return { tall: Math.round(box.height), wide: Math.round(box.width), corner: Math.round(side), inGrid: cell ? box.top >= cell.top - 1 && box.bottom <= cell.bottom + 1 : false }
    })
    expect(fits.tall, `four calls are ${fits.tall}px tall in a corner ${fits.corner}px square at ${size.width}×${size.height}`).toBeLessThanOrEqual(fits.corner + 1)
    expect(fits.wide, `four calls are ${fits.wide}px wide at ${size.width}×${size.height}`).toBeLessThanOrEqual(fits.corner + 1)
    expect(await offTheFelt(page, UPRIGHT), `what is off the felt at ${size.width}×${size.height}`).toEqual([])
    await expectLayoutToHold(page, `with four calls in a corner at ${size.width}×${size.height}`)
  }
})

test("a seat in 立直 shows a red 立直 tag at every screen size", async ({ page }) => {
  // 下家 and 上家 have declared 立直 in this saved hand. Phones used to hide the word and leave a thin ring.
  await openMahjong(page, { save: MAHJONG_SAVE_MANY_CALLS })
  const tags = page.locator('[data-slot="mj-seat"][data-riichi] [data-slot="mj-riichi"]')
  await expect(tags).toHaveCount(2)
  for (const tag of await tags.all()) {
    await expect(tag).toBeVisible()
    await expect(tag).toHaveText("立直")
  }
  await expectLayoutToHold(page, "with two 立直 tags in the centre panel")
})

test("the rules and the settings fit on the screen", async ({ page }) => {
  await openMahjong(page)
  for (const name of ["规则", "设置"]) {
    await page.getByRole("button", { name, exact: true }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expectLayoutToHold(page, `with ${name} open`)
    await page.getByRole("dialog").getByRole("button", { name: /^(知道了|好了)$/ }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  }
})

test("leaving in the middle of a hand and coming back shows the same tiles", async ({ page }) => {
  await openMahjong(page)
  await dealMahjongExactly(page, 3)
  for (let moves = 0; moves < 3; ) {
    if ((await screen(page)).myTurn) {
      await playMahjongMove(page)
      moves += 1
    } else await waitForNextMove(page)
  }
  for (let step = 0; step < 40 && !(await screen(page)).myTurn; step++) await waitForNextMove(page)
  const hand = page.getByRole("list", { name: /^你的手牌/ })
  const before = await hand.getAttribute("aria-label")
  await page.reload()
  await expect(hand).toHaveAttribute("aria-label", before ?? "")
})
