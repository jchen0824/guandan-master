import { expect, test } from "@playwright/test"
import { MAHJONG_SAVE_MANY_CALLS, MAHJONG_SAVE_THREE_INDICATORS, dealMahjongExactly, expectLayoutToHold, openHome, openMahjong, playMahjongHand, playMahjongMove, screen, waitForNextMove } from "./helpers"

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
  const broken = await page.evaluate(() => [...document.querySelectorAll("img")].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src))
  expect(broken, "tile pictures that did not load").toEqual([])
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

test("the wall and the 牌河 stay on the felt of the table picture at any shape of window", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "one browser is enough for a rule of the stylesheet")
  // A window near 4:3 once showed the whole picture with the wall standing on its wooden rim.
  for (const size of [{ width: 763, height: 639 }, { width: 1280, height: 720 }, { width: 1000, height: 900 }, { width: 1600, height: 620 }]) {
    await page.setViewportSize(size)
    await openMahjong(page)
    const off = await page.evaluate(() => {
      const table = document.querySelector('[data-slot="mj-table"]')
      if (!table) return ["no table"]
      const box = table.getBoundingClientRect()
      // The picture is 1672 by 941 and drawn centred. Its felt is a trapezium: the far edge is 12.5% of the way
      // down, from 21.4% to 78.6% across; the near edge is 84.8% down, from 4.3% to 95.7% across.
      const wide = Number.parseFloat(getComputedStyle(table, "::before").backgroundSize)
      const high = (wide * 941) / 1672
      const left = box.left + box.width / 2 - wide / 2
      const top = box.top + box.height / 2 - high / 2
      const inset = (y: number) => 0.214 - 0.171 * ((y - top) / high - 0.125) / 0.723
      const problems: string[] = []
      for (const el of document.querySelectorAll('[data-slot="mj-wall-side"], [data-slot="mj-river"]')) {
        const r = el.getBoundingClientRect()
        const name = el.getAttribute("aria-label") ?? el.getAttribute("data-side") ?? ""
        if (r.top < top + 0.125 * high - 2 || r.bottom > top + 0.848 * high + 2) problems.push(`${name} is above or below the felt`)
        for (const y of [r.top, r.bottom]) {
          if (r.left < left + inset(y) * wide - 2 || r.right > left + (1 - inset(y)) * wide + 2) problems.push(`${name} is off the side of the felt`)
        }
      }
      return [...new Set(problems)]
    })
    expect(off, `what is off the felt at ${size.width}×${size.height}`).toEqual([])
    await expectLayoutToHold(page, `at ${size.width}×${size.height}`)
  }
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
