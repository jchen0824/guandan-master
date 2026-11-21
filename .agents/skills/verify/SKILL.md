---
name: verify
description: Use to prove a change to 掼蛋教练 works in real Mobile Safari, in the iOS Simulator on this Mac - after any change a player can see in 掼蛋, 德州扑克, 日本麻将 or the home page, before saying a screen change is done, and when asked to verify, check on iPhone or reproduce something on a phone. Launches the production build, opens a game at a chosen deal or saved hand, presses buttons by their names, and saves a screenshot with the page's own report of its layout problems, coach text and script errors.
---

# Verifying 掼蛋教练 in Mobile Safari

The surface is a static web app that a player opens on a phone. Playwright's WebKit (the [browser-qa skill](../browser-qa/SKILL.md)) is close to Safari and is not Safari; it has painted screens right that an iPhone painted wrong. This skill drives the real one: Mobile Safari in Apple's iOS Simulator, on the production build. It needs a Mac with Xcode. Run both: `npm run test:e2e` for the four screen sizes, this for the real browser.

One helper does everything: [verify.mjs](verify.mjs). Run it from the repo root. The examples use this shorthand:

```bash
V() { node .agents/skills/verify/verify.mjs "$@"; }
```

Nothing can run a script in Mobile Safari from outside. So the helper's server puts `e2e/page-tools.js` and a small reporter into the page. Twice a second the page posts what `guandanQa` sees, and takes the name of the next button to press.

## Launch

```bash
V launch
```

It builds (`npm run build`), serves `dist` on `http://127.0.0.1:4175`, and boots an iPhone simulator if none is booted. It is ready when it prints `ready: http://127.0.0.1:4175 at <commit>, <device>`. There is no data to seed: the page's storage starts empty, and `open --fresh` empties it again.

- `VERIFY_DEVICE="iPhone 17e" V launch` uses that simulator. Use it when another session is using the booted one: two sessions that open links in the same Safari take the page from each other. `xcrun simctl list devices available` lists the names.
- `VERIFY_PORT=4176 V launch` uses another port. Set the same variable for every later command.
- One instance per checkout: its state is in `verify-out/.instance.json`. Two checkouts can run side by side with different ports and devices.
- The helper serves whatever is in `dist`. After you change `src`, run `npm run build` and `open` again; no restart is needed.

## Doctor

```bash
V doctor
```

Read-only. It exits 1 and says why when the server is not the one this checkout started, when it was started at another commit, when a source file is newer than the build, when the simulator is not booted, or when the page has stopped reporting (Safari went to the background or left the page). Run it first whenever a command times out.

## Drive

```bash
V open mahjong --fresh --seed 3                          # a repeatable deal
V open mahjong --fresh --fixture mahjong-no-safe-tile    # a saved hand from e2e/fixtures/
V open guandan --fresh --seed 4 --view 3d                # 掼蛋 on the 3D table (2d for the flat one)
V open holdem --fresh --seed 4
V open home --fresh
V press "怎么算的"                                        # press the button a player would call by that name
V press "?"                                              # no such button: the error lists every button on screen
```

- `open` waits until Safari has loaded the page. `--fresh` clears the page's storage first; leave it out to come back to the page as a returning player. The setup is for that one load: a reload in Safari resumes from storage, like a player's.
- `--fixture <name>` puts `e2e/fixtures/<name>.json` under the game's save key before the app starts. The fixtures today are mahjong hands. To make one, save `toSave(state)` from a test, as `e2e/fixtures/` shows.
- `--seed` makes the deal repeatable. Mahjong and 掼蛋 deal the same hand every time from a seed; Hold'em from a seed is repeatable but not a chosen hand.
- `press` matches a button's `aria-label`, or its text, exactly. A mahjong tile is its name (`东`, `五索`), a playing card is `红桃A`. When a dialog is open, a button inside it wins. `press` fails with the list of buttons on screen when none matches, so a wrong name is never a silent no-op.
- `press` clicks the element. It proves the button is there, enabled and wired; it does not prove a finger can reach it. `layoutProblems` in the proof covers covered and off-screen buttons. For a real touch, a drag, a rotation to landscape or the on-screen keyboard, use the iOS Simulator tool (`tap`, `swipe`, `rotate` on the same device) if your session has it and the user has allowed that device.
- The computer players move on timers (0.3 s to 0.8 s). After a `press` that ends your turn, the next `proof` waits for a new report, not for your next turn; check `state.myTurn` in what it prints and take another proof if needed.

The feature map in [features/README.md](features/README.md) has the recipe for each screen.

## Evidence

```bash
V proof mahjong-coach-defend
```

It writes `verify-out/<name>.png`, a screenshot of the simulator's whole screen, and `verify-out/<name>.json`, the page's report from the same moment: commit, device, viewport, user agent, `state` (`guandanQa.state()`), `layoutProblems`, the coach's text with its `pick`, `stance` or `advice`, the text of any open dialog, and every script error since the page loaded. It prints the important lines.

A proof is good when:

- it follows the player's path: `open`, then `press` what a player presses. Do not set state through `localStorage` beyond what `open` does;
- there is a proof before the action and one after, so the change is on record, not only the last screen;
- `layout problems: none` and `script errors: none`, or each one is explained;
- you opened the PNG and looked. The report cannot see a wrong colour or unreadable text. The first run of this skill found pale text on a white dialog that every automated check had passed;
- for something stored (a save, a setting), a second `open` without `--fresh` shows it came back.

Say in the report which device and iOS version it was, and that it is a simulator, upright, not a phone in a hand.

## Cleanup

```bash
V cleanup
```

It stops the server this checkout started, by its recorded process id, and shuts the simulator down only if `launch` booted it. `verify-out/*.png` and `verify-out/*.json` stay; `verify-out` is ignored by git, so attach the pictures to the pull request or the report if they should outlive the checkout. Run it after a failed attempt too.

## Keeping this current

When a screen gains a feature, add it to the map in `features/`. When a button is renamed, fix the recipe that presses it: `press "?"` shows the names in use.
