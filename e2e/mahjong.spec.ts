import { expect, test } from "@playwright/test"
import { dealMahjongExactly, expectLayoutToHold, openHome, openMahjong, playMahjongHand, playMahjongMove, screen, waitForNextMove } from "./helpers"

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
