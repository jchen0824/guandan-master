import { existsSync } from "node:fs"
import { expect, test } from "@playwright/test"
import { callDownTo, dealExactly, dealHoldemExactly, openGame, openHoldem, openHome, screen, waitForNextMove } from "./helpers"
import type { Page } from "@playwright/test"

// A few fixed screens compared with saved pictures, for what layoutProblems() cannot see: something moved or drawn
// badly that overlaps nothing. Only the CI runner makes and compares pictures (playwright.config.ts), so locally these
// tests run their steps and skip the comparison. To take new pictures after a change on purpose, see the browser-qa skill.

/**
 * Compares the page with the saved picture `name`. With updateSnapshots "none" Playwright writes an `-actual.png` for a
 * changed picture but not for a missing one, so a missing one is written here, to the same place, for
 * scripts/accept-screenshots.mjs to find. The comparison is soft so every picture of a test is taken in one run.
 */
async function expectPicture(page: Page, name: string) {
  if (process.env.CI && !existsSync(test.info().snapshotPath(name))) {
    const path = test.info().outputPath(name.replace(/\.png$/, "-actual.png"))
    await page.screenshot({ path, animations: "disabled", caret: "hide", scale: "css" })
  }
  await expect.soft(page).toHaveScreenshot(name)
}

/** Ends a hand by calling every bet, so the table shows its showdown. */
async function callToTheShowdown(page: Page) {
  for (let step = 0; step < 200 && !(await screen(page)).over; step++) {
    if ((await screen(page)).myTurn) await page.getByRole("button", { name: /^(过牌|跟注)/ }).click()
    else await waitForNextMove(page)
  }
  await expect(page.getByRole("list", { name: "这一手打到哪一步" }).locator("[aria-current]")).toHaveText("摊牌")
}

/**
 * Plays the 掼蛋 table on to the player's turn. The test clock keeps running, so a computer player who leads plays
 * 800 ms after the deal; on the player's turn nothing moves until the player does, so the picture is the same every run.
 */
async function untilMyTurn(page: Page) {
  for (let step = 0; step < 20 && !(await screen(page)).myTurn; step++) await waitForNextMove(page)
  expect((await screen(page)).myTurn).toBe(true)
}

test("home page", async ({ page }) => {
  await openHome(page)
  await expectPicture(page, "home.png")
})

test("掼蛋, flat table, at the player's first turn of an exact deal", async ({ page }) => {
  await openGame(page, { view: "2d" })
  await dealExactly(page, 4)
  await untilMyTurn(page)
  await expectPicture(page, "guandan-2d-deal.png")
})

test("掼蛋, 3D table, at the player's first turn of an exact deal", async ({ page, browserName }) => {
  // Playwright's WebKit paints every 3D scene flat, so a picture from it would bless a wrong drawing.
  test.skip(browserName !== "chromium", "WebKit paints 3D scenes flat in Playwright")
  await openGame(page, { view: "3d" })
  await dealExactly(page, 4)
  await untilMyTurn(page)
  await expectPicture(page, "guandan-3d-deal.png")
})

for (const seats of [6, 9] as const) {
  test(`德州扑克, ${seats} seats, first decision and showdown`, async ({ page }) => {
    await openHoldem(page, { seats })
    await dealHoldemExactly(page, { holes: { 0: "KH KD", [seats - 1]: "AS AC" }, board: "2C 7S 9D 4H 3S" })
    await callDownTo(page, 0)
    await expectPicture(page, `holdem-${seats}-decision.png`)
    await callToTheShowdown(page)
    await expectPicture(page, `holdem-${seats}-showdown.png`)
  })
}
