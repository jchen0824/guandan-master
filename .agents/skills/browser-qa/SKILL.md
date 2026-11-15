---
name: browser-qa
description: Use to check 掼蛋教练 in a real browser - after any change under src/ui, src/App.tsx or src/index.css, before opening a pull request for it, when asked to QA or reproduce a layout bug on a phone or desktop, or when a browser test fails. Covers the automated Playwright run, a hands-on pass with a browser tool, the three screen sizes, and shortcuts for reaching hard game states (a fixed deal, a tribute hand, the end of a hand).
---

# Checking the game in a browser

Unit tests run in a simulated DOM that has no layout. They cannot see a button pushed off screen, two things overlapping, or a table squeezed to nothing, and those are the bugs players actually report here. This skill is how you look.

There are two passes. Do the first always, the second when you changed how something looks or moves.

## Pass 1: the automated run

```bash
npm run test:e2e:install   # once per machine: downloads Chromium and WebKit
npm run test:e2e           # builds, serves the build, runs every test on four screens
```

The four screens are the three layouts in `src/index.css` plus a short phone:

| Project | Size | Why |
| --- | --- | --- |
| `desktop-chromium` | 1280×720 | coach docked beside the table |
| `phone-upright-webkit` | 393×745 | iPhone Safari, upright |
| `phone-landscape-webkit` | 852×300 | iPhone Safari on its side: the browser bars leave only about 300px |
| `small-phone-chromium` | 375×550 | a short Android phone, where space runs out first |

Useful variations:

```bash
npx playwright test --project=phone-landscape-webkit   # one screen
npx playwright test -g "whole hand"                    # one test
npx playwright test --headed --project=desktop-chromium # watch it play
npx playwright show-trace test-results/<folder>/trace.zip   # step through a failure
```

A failure lists what is wrong in sentences, for example `the 出牌 button is partly off screen (369,466 88×44 in 393×745)`. The numbers are left, top, width×height. Fix the layout. Do not loosen the check: if a rule in `e2e/page-tools.js` is wrong for a real reason, change it in the same pull request and say why.

When you add something a player can see or press, add it to a test in `e2e/game.spec.ts`. Keep rules out of there; they belong in `src/engine/engine.test.ts`.

## Pass 2: look at it yourself

Automated checks only cover what someone thought to assert. Use whatever browser tool you have (a built-in browser, Playwright MCP, Chrome DevTools).

1. Start the dev server with `npm run dev` and open it as **`http://qa.localhost:<port>`**, not `localhost`. Same server, separate storage, so you never overwrite a real saved match. Never drive a tab the maintainer is playing in.
2. Load the page tools: read `e2e/page-tools.js` and evaluate its whole text in the page. It defines `window.guandanQa`.
3. At each of the three sizes (about 375×550, 852×300, 1280×720), reach the states below and run `guandanQa.layoutProblems()`. An empty list means nothing is off screen, covered or overlapping.
4. Look at a screenshot too. The probe cannot judge whether something is ugly, cramped or confusing.
5. Check the browser console for errors.
6. When you finish, clear the test storage (`localStorage.clear()` on the qa address) and reset any emulated screen size.

### States worth reaching, and the quick way there

| State | How |
| --- | --- |
| Your turn, cards selected | Click 提示. Selected cards lift, so this is when buttons and cards are closest |
| A pile (理牌) | Select two or three cards, click 理牌. Then select the pile and use ← → |
| A tall column | Select six or more cards and 理牌 them into one pile. Tall piles are what squeeze the table in landscape |
| Every dialog | 规则, 复盘, 设置, and the result dialog. Each must fit and its close button must be reachable |
| Coach drawer on a phone | Click 教练 at a width of 1000px or less |
| End of a hand | Loop: when 提示 is showing, click it, then 出牌 if cards were selected, otherwise 不出. Bots move every 0.8s, so a hand takes about a minute and a half. `guandanQa.state().over` turns true |
| A hand with tribute | In the console: `localStorage.setItem("guandan.match", <save>)` with the `SAVE_AFTER_DOUBLE_WIN` text from `e2e/helpers.ts`, reload, click 继续第 2 局. You win the previous hand by a double, so you receive tribute and must return a card |
| An exact deal | Open 设置, click 重新开始整场比赛, run `guandanQa.seed(4)`, then click the 确认 button. Seed 4 with hint-following play ends on your own bomb of 9s |
| The 3D table | Use the 2D/3D switch in the top bar (in 设置 on an upright phone), or run `localStorage.setItem("guandan.view", "3d")` and reload. Check every state above on both tables when the change touches something they share |

`guandanQa.state()` tells you where you are: `{ over, myTurn, mustReturn, cards, selected, dialog }`.

## What to report

Say what you ran and what you saw, not that it "looks fine":

- the result of `npm run test:e2e` (passed and failed counts);
- which sizes you looked at by hand, and which states;
- anything the probe flagged, quoted;
- what you could not check. A real phone is the usual one: WebKit on a desktop or CI machine is close to iPhone Safari, not identical.
