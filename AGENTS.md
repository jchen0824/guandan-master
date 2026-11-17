# AGENTS.md

Instructions for any coding agent (and any person) changing this repository. This is the single source: `CLAUDE.md` only imports it, and other agent files should do the same.

## What this is

掼蛋教练 is a single-player card-game trainer for beginners. It opens on a home page with two games. In Guandan (掼蛋) the human plays seat 0 against three rule-based bots; in Texas Hold'em (德州扑克) the human plays one seat at a table of six or nine, against five or eight. Both have a coach that explains positions and comments on each move. It is a static Vite + React + TypeScript site with no server, database or LLM. Live at https://guandan-playground.vercel.app.

## How to make a change

Follow these steps in order. Each one has a check that fails when it is skipped.

1. **Branch from `main`.** Name it `<type>/<short-name>`, for example `fix/bomb-timing`. Direct pushes to `main` are blocked.
2. **Read the skill for the area you touch** (see [Skills](#skills)). Do this before you read or write code.
3. **Make the change, with a test.** A rule or bot change needs a test in `src/engine/engine.test.ts`; a screen change needs one in `src/App.test.tsx`, and one in `e2e/game.spec.ts` when it changes what a player can see or reach. For Texas Hold'em the same three are the test beside the file in `src/holdem`, `src/ui/holdem/Holdem.test.tsx` and `e2e/holdem.spec.ts`; the home page has `src/Root.test.tsx`. A bug fix, including one for a review finding, needs both a unit test and a browser test that fail without the fix, so the bug cannot come back unseen; for a Hold'em hand, deal its exact cards with `dealHoldemExactly` in `e2e/helpers.ts`.
4. **Run `npm run check`**, and `npm run test:e2e` after a screen change. Together they are the gate CI runs. Fix every failure; do not weaken a check to get past it.
5. **Commit with a Conventional Commit message**, as [CONTRIBUTING.md](CONTRIBUTING.md) describes.
6. **Open a pull request** and fill in the template. The title must also be a Conventional Commit, because it becomes the commit on `main`.

Do not deploy, cut a release, merge your own pull request, change branch protection or raise a budget in `scripts/` unless the maintainer asked for exactly that.

## Commands

```bash
npm ci                    # install exactly what the lockfile says
npm run dev               # Vite dev server
npm run check             # everything CI runs: lint, conventions, tests, build, bundle budget
npm run lint              # oxlint, warnings are errors
npm run check:conventions # repo rules a linter cannot express
npm run typecheck         # tsc -b
npm test                  # vitest run (engine and game screen)
npm run test:e2e          # Playwright: builds, then plays the game in real browsers at four screen sizes
npm run test:e2e:install  # once per machine: download Chromium and WebKit for the line above
npm run build             # tsc -b && vite build
npm run check:bundle      # gzipped size budget, run after a build
npm run bench             # 300 simulated hands per bot matchup; prints win and double-win rates
npm run test:levels       # Texas Hold'em: each computer player level must beat the one below (about a minute)
```

- Typecheck with `npm run typecheck` (`npx tsc -b`). The root `tsconfig.json` only holds references, so `npx tsc --noEmit` checks nothing.
- Single test: `npx vitest run src/engine/engine.test.ts -t "orders bombs by size"`.
- `benchmark.test.ts` is skipped unless `VITE_BENCH` is set; `npm run bench` sets it. Run it before and after changing `src/engine/bot.ts` and put both sets of numbers in the pull request.
- `src/holdem/levels.test.ts` is skipped unless `VITE_LEVELS` is set; `npm run test:levels` sets it, and CI runs it in the `quality` job, so a change that makes a Hold'em level no stronger than the one below fails the build. It plays the levels against each other on the same cards both ways round, and counts each level's wrong calls and folds in 600 real spots, once at six seats and once at nine. Run it after changing `src/holdem/bot.ts` and put its numbers in the pull request.
- Check a commit message without committing: `npm run check:commits -- "fix(ui): keep the hand on screen"`.
- Releasing is a maintainer step, described in [CONTRIBUTING.md](CONTRIBUTING.md#releases). Do not change `version` in `package.json` unless the task is a release. The version and build date reach the UI through `import.meta.env.VITE_APP_VERSION` and `VITE_BUILD_DATE`, set in `vite.config.ts` and read in `src/ui/buildInfo.ts`.
- Deploying is a maintainer step: `vercel deploy --prod --yes` from the repo root. Vercel is not connected to the GitHub repo, so merging does not deploy.

## Skills

A skill is a folder of instructions under `.agents/skills/`. If your agent does not load skills by itself, open the file and read it.

| When you touch | Read first |
| --- | --- |
| Game rules, bots, hints, coach text, the 记牌器, or any Chinese wording about play | [.agents/skills/guandan-play/SKILL.md](.agents/skills/guandan-play/SKILL.md) |
| Texas Hold'em rules, computer players, coach advice or grading, the Hold'em 规则 dialog, or Chinese wording about Hold'em play (`src/holdem`, `ui/holdem`) | [.agents/skills/holdem-play/SKILL.md](.agents/skills/holdem-play/SKILL.md) |
| Anything under `src/ui`, `src/App.tsx`, `src/Root.tsx`, `src/index.css` or `src/holdem.css` | [.agents/skills/guandan-ui/SKILL.md](.agents/skills/guandan-ui/SKILL.md), then the `ui-sdk` skill it points to |
| Checking a screen change, reproducing a layout bug, or a failing browser test | [.agents/skills/browser-qa/SKILL.md](.agents/skills/browser-qa/SKILL.md) |

The skills above live in this repo, so a fresh clone already has them. The `ui-sdk` skill belongs to the ui-sdk project and is set up per machine:

```bash
npx skills add vercel-labs/ui --skill ui-sdk   # once on a new machine, for agents that load skills
```

Without that install, read the same skill at `node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md` after `npm ci`. Source and docs: [github.com/vercel-labs/ui](https://github.com/vercel-labs/ui), [ui-sdk.dev/docs](https://ui-sdk.dev/docs).

`.claude/skills` is a link to `.agents/skills`, so agents that look there find the same files. Add a new skill as `.agents/skills/<name>/SKILL.md` with `name` and `description` frontmatter, and list it in the table above; `npm run check:conventions` enforces both.

## Architecture

Two layers. `src/engine` and `src/holdem` are pure TypeScript with no React or DOM; `src/ui`, `src/App.tsx` and `src/Root.tsx` render them. `src/Root.tsx` is the whole app: the home page (`ui/Home.tsx`), or the game the player picked, kept under `guandan.game` so a reload returns to the same table. Both tables have a ‹ button at the left of the top bar that returns to the home page; on the 掼蛋 table it is in `[data-slot="top-left"]` with the scores and, on the 3D table, the brand, and 设置 has the same thing as 回到首页. Lint fails if the engine imports from the UI, React or ui-sdk, or touches `window`, `document` or `localStorage`.

### Texas Hold'em engine (`src/holdem`)

The rules for the second game, 德州扑克: six or nine seats, no-limit, blinds 10/20, practice chips. It is pure TypeScript like `src/engine` and takes its randomness as an `rng` parameter. Its screen is described under [UI](#ui), and the rules and strategy it implements are in the [holdem-play skill](.agents/skills/holdem-play/SKILL.md). One file per concern, each with its tests beside it:

- `cards.ts`, `hands.ts`: a 52-card deck and the best five of seven. `evaluate()` returns a `score` that orders any two hands.
- `game.ts`: the table. `act(state, seat, action)` is the only way a hand moves on: it checks the action, deals the next street when a betting round ends, and pays the pots, side pots included, when the hand ends. `legalActions(state)` says what the seat to act may do. A seat with no chips is out (`Seat.out`): `nextHand` deals around it, heads-up blinds included, and throws once `tableOver` says the player is out or the last one left. The table size is `seats.length`; `newTable(rng, size)` picks it (`TABLE_SIZES`, 6 or 9) and nothing else stores it. Positions come from one table indexed by the number of seats still in: `positionName()` for the label and `positionGroup()` (early, middle, late or blinds) for the coach and the computer players.
- `odds.ts`: `equity()` estimates a win rate by dealing the unknown cards many times, so it moves by a few points from call to call. Pass `betting` when facing a bet, or it is far too hopeful. `draws()` counts outs; `potOdds()` prices a call.
- `read.ts`: the coach's working after the flop, as a player would do it without a computer: what the hand is against the board (`readHand`), the outs that would make it a likely winner (`countOuts`), what the betting says, and the 2-and-4 rule (`ruleOfThumb`). A pair, two pair or trips that are only on the board count as nothing.
- `bot.ts`, `coach.ts`: the computer players, and the advice and grading the player sees. Both compare the win rate with the price of a call, worked out pot by pot by `shareOfPot()` so a side pot counts only among the players who can win it. All coach text is Chinese and written for a beginner.
- `botAction(state, seat, rng, skill)` plays at one of three levels (`BOT_SKILLS`): `novice` limps and calls too much and never bluffs, `basic` (the default) estimates its win rate roughly and calls a little too loosely, `advanced` raises its hands, steals from late position, calls only at the right price and bets thin hands for value. `levels.test.ts` keeps them in order (see `npm run test:levels`); `game.test.ts` checks that they play differently and legally.
- `testing.ts`: helpers for the tests (`rig()` deals chosen cards; `refilled()` gives every broke seat a full stack again, so a long simulation such as `levels.test.ts` keeps every seat playing; `seatsOf(state)` lists a table's seats). Not for the app.
- `lastWhere()` in `game.ts` stands in for `findLast`, which older phone browsers lack.

Single test: `npx vitest run src/holdem/game.test.ts -t "side pot"`.

### Engine (`src/engine`)

- **`cards.ts`**: a card is `{ id, suit, rank }` with rank 2–14 (A = 14), 16 small joker, 17 big joker. `rankValue` moves the current level's rank to 15 (above A, below jokers). `isWild` is the heart card of the level rank (逢人配).
- **`combos.ts`**: a per-level table of about 400 patterns (type, comparison rank, required ranks). `fill` tries to satisfy a pattern from natural cards, then wild cards; wild cards never stand in for jokers. `classify(cards)` returns every reading of exact cards, `readPlay` picks the reading that beats the table, `legalPlays(hand, level, previous)` enumerates moves. `beats` and `bombPower` hold the bomb ladder: 4 < 5 < straight flush < 6+ < four jokers. Straights, tubes and plates compare by natural top rank, not level value.
- **`game.ts`**: an immutable state machine over `GameState`: `newMatch` → `play` / `pass` → `settle` → `startNextHand` (deals and applies tribute) → `returnTribute`. Phases are `return`, `play`, `handOver`, `matchOver`. `checkPlay` returns the user-facing reason a play is illegal. `toSave` / `parseSave` / `resumeMatch` persist only between hands; no cards are saved.
- **`bot.ts`**: `advise(state, player, skill, random)` returns `{ combo, reason }` and is used for bots, hints and coach feedback alike. `evaluateHand` estimates turns left; the `advanced` level adds card counting (`readTable`, `isTop`) and situational rules (block, feed partner, two-step finish). Levels are `novice`, `basic`, `advanced`; the coach always uses `advanced`.

Seats: 0 is the human, 1 is 下家, 2 is the partner (对家), 3 is 上家. `teamOf(p) = p % 2` and play order is `(p + 1) % 4`.

### UI

- **`ui/useGame.ts`** owns all game state. It wraps `GameState` in a view that also tracks each seat's last play in the current trick, runs bot turns on an 800 ms timer, and exposes the human's actions.
- **`ui/columns.ts`** turns the hand into rank columns plus hand-made piles (理牌). **`ui/situation.ts`** writes the coach's description of the position. **`ui/unseen.ts`** counts the cards for the 记牌器, **`ui/tribute.ts`** and **`ui/PlayLog.tsx`** write the 复盘 record.
- Components come from `@ui-sdk/react` (Button, Toggle, ToggleGroup, Dialog, SegmentedControl, Field). Styling is plain CSS in `src/index.css`, keyed on `data-slot` and state attributes such as `data-pressed`; card sizes derive from a `--cw` custom property in container-query units.
- Three layouts share one stylesheet: desktop (coach docked), phone landscape (`max-height: 480px`) and upright phone (`max-width: 620px`, where hand columns overlap and the table area scrolls so the hand and controls stay on screen). Phone browsers leave only about 300px of height in landscape, so that layout puts the tools left of the hand and the action buttons right of it.
- Dialogs render inside the top bar, so `[data-slot="dialog-content"]` resets inherited text styles such as `white-space`. For the same reason a rule meant for a top-bar control must use the child selector (`[data-slot="menu"] > …`), or it also restyles the copy inside a dialog.
- **Two tables, one game.** `ui/view.ts` keeps the player's choice of `3d` (the default) or `2d`, and `<main>` carries it as `data-view`. The 2D/3D switch is in the top bar and in 设置. Both views use the same hand, buttons, tools, dialogs and `useGame` state; only the table differs.
- **The 3D table** is `ui/Table3D.tsx` plus the block at the end of `src/index.css` scoped to `[data-view="3d"]`. It is CSS 3D transforms, with no canvas or WebGL: a plane tilted away from the player, a fan of card backs per seat, and each seat's last play lying on the felt. Every length is a multiple of `--u`, one pixel of the design (1280×720 desktop, 852×300 phone landscape, 393×745 phone upright), and positions are plain numbers in custom properties at the top of that block. Card ranks there use Barlow Condensed, bundled from `@fontsource/barlow-condensed`, so no request goes to a font host. A bomb gets a moment of its own: `ui/BombMoment.tsx` draws the banner and the ladder of bombs, and `Table3D.tsx` the flash, rings, sparks and shake. Its browser tests are in `e2e/table3d.spec.ts`.
- **What breaks the 3D table without an error.** Each of these has happened:
  - `overflow`, `opacity` or `filter` on an element between `[data-slot="world"]` and a card flattens the 3D space. So does a group between them without `transform-style: preserve-3d`.
  - Safari also needs each such group to have a 3D transform of its own (`translateZ(0)`), or it draws the labels inside it lying flat.
  - Safari stops sorting the scene by depth when it holds too many layers. A hundred separate card backs made it draw the table's rim over the felt. So the tabletop (`[data-slot="tabletop"]`), each fan (`[data-slot="fan"]`) and each play (`[data-slot="card-row"]`) are one flat surface each, with their parts placed in 2D and painted in source order. Cards of one play that were separate 3D layers a hair apart in depth came out in the wrong order in Safari: the first card covered the ranks of the rest. Add to those surfaces; do not add new 3D layers for things that lie flat.
  - Chrome sorts a flat surface that has no size as if it were under the table, and does not draw what sticks out of the surface's box. A fan and a play have a real box, big enough for everything in them, for that reason.
  - A seat label left in the table layer gets hidden behind a fan, which is why labels are drawn in the second `world` layer.
  - Labels float over the scene, so nothing in the layout stops one landing on another or on the top bar. `layoutProblems()` in `e2e/page-tools.js` reports any two that overlap. On phones the table is pinned to the screen (`position: fixed`, `--oy` measured from the bottom of the screen) so that a taller hand cannot slide it, and its labels, up under the top bar.
- **Looking at the 3D table in WebKit.** A screenshot from Playwright's WebKit paints every 3D scene flat, even a correct one, so it cannot show whether Safari draws the table right. Record a video (`recordVideo` on the browser context) and look at a frame from it. Positions from `getBoundingClientRect` are right in both engines but say nothing about what is painted over what.
- **Mobile Safari in CI.** `.github/workflows/ios-simulator.yml` opens the production build in Mobile Safari inside Apple's iOS Simulator on a macOS runner and checks a picture of the screen. Nothing can drive that browser from outside, so the page drives itself: `e2e/ios/serve.mjs` puts `e2e/ios/driver.js` into the page, which deals a fixed hand, follows the hints until several five-card plays are on the 3D table, stops the game and posts where everything is. `e2e/ios/check-shot.mjs` then looks at the screenshot's pixels at those places: the felt is green, a fan stands in front of the table, the seat labels face the camera, and every played card shows its rank. A second pass opens `/?game=holdem`, calls every bet until a hand ends in a showdown, and checks that the tilted felt is painted, the seat labels are drawn over it, and every card on the board, on a seat and in the player's hand shows its rank. It runs on pull requests that touch `src/` and is not a required check. When it fails, the `ios-simulator` artifact of the run has the screenshot and the report. It checks one state of each game, upright, on one iPhone model; it is a simulator, not a phone.
- **The Texas Hold'em screen** is `ui/holdem/Holdem.tsx`, with its state in `ui/holdem/useHoldem.ts` (the hand, the coach's advice for the player's turn, the graded decisions, and the computer players moving on an 800 ms timer). Its styles, and the home page's, are in `src/holdem.css`. Like a 掼蛋 match, the table is saved under `guandan.holdem.table` at the end of every hand (stacks, button, hand number; no cards, `toTableSave`/`resumeTable` in `game.ts`), so the next visit deals the hand after it, and the home page tile says where the player left off. 设置 has 重新开始, which clears it, and 牌桌人数 (6 人 or 9 人): picking the other size and confirming starts a new table of that size. The size of the last table started is kept under `guandan.holdem.seats` and is used only when there is no table to carry on; a saved table keeps its own size (`ui/holdem/storage.ts` owns both keys). When the table ends (你出局了 or 全桌冠军) the hand's 下一手 becomes 再开一桌, and a saved table that had ended is not resumed. The 教练 switch in its top bar turns the coach off, like the one on the 掼蛋 table, and is kept under `guandan.holdem.coach`. 设置 sets the computer players' level, kept under `guandan.holdem.skill`. After the flop the coach also shows its working (`Advice.explain`); where the coach is a bar, the bar keeps only the 估算 line and the decision (only the decision on a short phone or a phone on its side), and 怎么算的 opens all of it in a dialog. That dialog sits inside the coach's `<aside>` in the page, so a rule that hides or restyles part of the bar uses the child selector (`[data-slot="he-coach"] > …`), or it changes the dialog's copy too. With the coach off, its box keeps one plain line of what is happening at the table and the result of the hand, and the raise button starts at two thirds of the pot instead of the coach's amount. Tests find the advice in the coach panel's `data-advice` (`fold`, `check`, `call` or `raise`).
- **The Hold'em table is not a 3D scene.** The felt is one tilted surface, and every seat, bet, card and panel lies flat over it, so no browser has to sort anything by depth. A seat stands at design pixels `--x`, `--y`, scaled by `--u` across and `--v` down. What belongs to a seat (its bet, the cards it shows at the end, the dealer badge) is a fixed number of pixels from the seat's label, so the two cannot collide when the table shrinks. The numbers for each layout are custom properties in the matching media block.
- **Hold'em has four layouts**: a wide screen (1240px and up) with the hand-rank list and the coach as panels at the sides; anything narrower, where the coach is a bar above the table and the full review of a hand opens from 看复盘; an upright phone (`max-width: 620px`), where the table is as wide as the screen, only its height shrinks, and the player's two cards lie over its near edge; and a phone on its side (`max-height: 480px`), where the coach is a box at the bottom left. A phone on its side narrower than about 800px is not supported: the labels are a fixed width and run into each other. `<main>` carries the table size as `data-seats`, and each layout places the eight opponents of a nine-seat table in rules under `[data-seats="9"]`, so the six-seat rules never change for it.
- **Nothing in that layout stops one label landing on another**, as on the 3D table. `layoutProblems()` in `e2e/page-tools.js` checks every pair of labels on the Hold'em table and every text that could be cut off, and `e2e/holdem.spec.ts` runs it at each decision of three hands. After moving anything on the table, run it at the four test sizes and at one size between them.
- Browser storage keys: `guandan.match`, `guandan.skills`, `guandan.coach`, `guandan.tracker`, `guandan.view`, `guandan.game`, `guandan.holdem.coach`, `guandan.holdem.seats`, `guandan.holdem.skill`, `guandan.holdem.table`. A new key needs the `guandan.` prefix and an entry in this list.

## What CI checks

Every pull request runs three required jobs: `quality`, `e2e` and `conventional-commits`. Run the left column locally to see the same result.

| Command | Catches | Typical fix |
| --- | --- | --- |
| `npm run lint` | React rules (hooks order and dependencies, state set during render or in an effect, impure render, components defined inside components, index keys, exports that break fast refresh), accessibility, import cycles, `any` and `!`, inline `style`, the `as` prop, ui-sdk root or private imports, UI or browser code inside `src/engine` | Follow the message. Move shared helpers out of component files; import `@ui-sdk/react/<component>`; style from `data-slot` in `src/index.css` |
| `npm run check:conventions` | A hand-written widget `role` that ui-sdk already ships, `Math.random()` called in the engine, an undocumented storage key, a skill without frontmatter, `CLAUDE.md` drifting from `@AGENTS.md`, broken doc links | Each failure prints its own fix |
| `npm test` | Broken rules, bots that peek at hidden hands, reasons not written in Chinese, a game screen that no longer deals, hints or plays | Fix the code, not the test, unless the rule itself changed on purpose |
| `npm run test:levels` | A Texas Hold'em computer player level that no longer beats the one below it, at the table or in how often it calls or folds wrongly | Retune `STYLES` or the preflop play in `src/holdem/bot.ts`; do not loosen the thresholds |
| `npm run build` | Type errors and anything Vite cannot bundle, including broken CSS | The dev server tolerates some broken CSS. The build does not |
| `npm run check:bundle` | A bundle that outgrew its budget | Remove the heavy dependency or root import |
| `npm run test:e2e` | Anything a player cannot see or reach in a real browser: a button or card off screen, two things overlapping, a covered button, a squeezed table, a dialog that does not fit, a console error. Runs on desktop, phone upright, phone landscape (852×300) and a short phone, in Chromium and WebKit | Read the sentence in the failure, open the trace, fix the layout. See the browser-qa skill |
| `npm run check:commits` (CI only, on the title and every commit) | Messages that are not Conventional Commits | Reword; see [CONTRIBUTING.md](CONTRIBUTING.md) |

Inline `style` has one allowed use: `place()` from `ui/place.ts`, which sets only custom properties such as `--i` and `--n` so the stylesheet can position a card on the 3D table. Each use carries a suppression that says so. Colours, sizes and everything else still go in `src/index.css`.

Suppressing a lint rule needs a reason on the same line: `// oxlint-disable-next-line <rule> -- <why this case is safe>`. A suppression without a reason, or one that only exists to get CI green, will be rejected in review.

## Conventions and gotchas

- **Chinese is the primary language.** Every user-facing string is Chinese, including messages produced inside the engine (`checkPlay` reasons, `advise` reasons, `describeCombo`). Tests assert on some of this text. Code, comments, commit messages and these docs are English.
- **Bots must not peek.** `advise` may only use the player's own hand, card counts and the play log, because the coach teaches from the same logic. A test re-deals the hidden cards and fails if the advice changes.
- **The engine is deterministic.** Functions that need chance take `random: () => number = Math.random`; tests pass a seeded generator. Never call `Math.random()` inside the engine.
- **No turn timers**, by product decision.
- `erasableSyntaxOnly` and `verbatimModuleSyntax` are on: no enums or parameter properties, and type-only imports need `import type`.
- Use `slice().sort()` rather than `toSorted()` and similar ES2023 array methods: older phone browsers and in-app webviews lack them and nothing polyfills them.
- `legalPlays` re-reads any play that uses a wild card through `classify`, so its reported rank matches what `play` will record. Keep that when adding patterns.
- Agreed rule variants: three failed attempts at A drop a team to level 2; return tribute must be a 10 or lower; after a double tribute the payer of the larger card leads (clockwise on a tie); a resisted tribute (抗贡) means the previous winner leads. The full rules are in the guandan-play skill.
- Check a UI change at about 375×550, 852×300 and 1280×720, on both tables if it touches something they share (the hand, buttons, tools, top bar or dialogs). When testing in a browser, open the dev server as `http://qa.localhost:<port>` instead of `localhost`: it is the same server with separate storage, so test saves and settings do not leak into a real session.
- UI tests start with `// @vitest-environment jsdom` on the first line. Engine tests run in plain Node and must stay that way.
- Browser tests live in `e2e/` and run under Playwright against the production build. `e2e/page-tools.js` holds the layout probe; the browser-qa skill uses the same file for hands-on checks, so change it in one place.
- Dependabot opens weekly pull requests for npm packages and GitHub Actions (`.github/dependabot.yml`). They go through the same CI. A minor or patch update merges on its own once the required checks pass (`.github/workflows/dependabot-auto-merge.yml`); a major one waits for the maintainer. `@types/node` majors are ignored: raise them by hand together with `.nvmrc`.

## Done means

- `npm run check` passes, and you read its output rather than only its last line. For a screen change, `npm run test:e2e` passes too.
- The change has a test that fails without it.
- Docs that describe the changed behaviour are updated in the same pull request: this file, the skills, and both READMEs when a feature or command changes.
- The pull request says what you could not verify (for example "not checked on a real phone").
