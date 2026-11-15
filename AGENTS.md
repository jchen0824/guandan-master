# AGENTS.md

Instructions for any coding agent (and any person) changing this repository. This is the single source: `CLAUDE.md` only imports it, and other agent files should do the same.

## What this is

掼蛋教练 is a single-player Guandan (掼蛋) trainer for beginners: the human plays seat 0 against three rule-based bots, with a coach that explains positions and comments on each move. It is a static Vite + React + TypeScript site with no server, database or LLM. Live at https://guandan-iota.vercel.app.

## How to make a change

Follow these steps in order. Each one has a check that fails when it is skipped.

1. **Branch from `main`.** Name it `<type>/<short-name>`, for example `fix/bomb-timing`. Direct pushes to `main` are blocked.
2. **Read the skill for the area you touch** (see [Skills](#skills)). Do this before you read or write code.
3. **Make the change, with a test.** A rule or bot change needs a test in `src/engine/engine.test.ts`; a screen change needs one in `src/App.test.tsx`.
4. **Run `npm run check`.** It is the same gate CI runs. Fix every failure; do not weaken a check to get past it.
5. **Commit with a Conventional Commit message**, as [CONTRIBUTING.md](CONTRIBUTING.md) describes.
6. **Open a pull request** and fill in the template. The title must also be a Conventional Commit, because it becomes the commit on `main`.

Do not deploy, merge your own pull request, change branch protection or raise a budget in `scripts/` unless the maintainer asked for exactly that.

## Commands

```bash
npm ci                    # install exactly what the lockfile says
npm run dev               # Vite dev server
npm run check             # everything CI runs: lint, conventions, tests, build, bundle budget
npm run lint              # oxlint, warnings are errors
npm run check:conventions # repo rules a linter cannot express
npm run typecheck         # tsc -b
npm test                  # vitest run (engine and game screen)
npm run build             # tsc -b && vite build
npm run check:bundle      # gzipped size budget, run after a build
npm run bench             # 300 simulated hands per bot matchup; prints win and double-win rates
```

- Typecheck with `npm run typecheck` (`npx tsc -b`). The root `tsconfig.json` only holds references, so `npx tsc --noEmit` checks nothing.
- Single test: `npx vitest run src/engine/engine.test.ts -t "orders bombs by size"`.
- `benchmark.test.ts` is skipped unless `VITE_BENCH` is set; `npm run bench` sets it. Run it before and after changing `src/engine/bot.ts` and put both sets of numbers in the pull request.
- Check a commit message without committing: `npm run check:commits -- "fix(ui): keep the hand on screen"`.
- Deploying is a maintainer step: `vercel deploy --prod --yes` from the repo root. Vercel is not connected to the GitHub repo, so merging does not deploy.

## Skills

A skill is a folder of instructions under `.agents/skills/`. If your agent does not load skills by itself, open the file and read it.

| When you touch | Read first |
| --- | --- |
| Game rules, bots, hints, coach text, the 记牌器, or any Chinese wording about play | [.agents/skills/guandan-play/SKILL.md](.agents/skills/guandan-play/SKILL.md) |
| Anything under `src/ui`, `src/App.tsx` or `src/index.css` | [.agents/skills/guandan-ui/SKILL.md](.agents/skills/guandan-ui/SKILL.md), which sends you to the ui-sdk skill shipped in `node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md` |

`.claude/skills` is a link to `.agents/skills`, so agents that look there find the same files. Add a new skill as `.agents/skills/<name>/SKILL.md` with `name` and `description` frontmatter, and list it in the table above; `npm run check:conventions` enforces both.

## Architecture

Two layers. `src/engine` is pure TypeScript with no React or DOM; `src/ui` and `src/App.tsx` render it. Lint fails if the engine imports from the UI, React or ui-sdk, or touches `window`, `document` or `localStorage`.

### Engine (`src/engine`)

- **`cards.ts`**: a card is `{ id, suit, rank }` with rank 2–14 (A = 14), 16 small joker, 17 big joker. `rankValue` moves the current level's rank to 15 (above A, below jokers). `isWild` is the heart card of the level rank (逢人配).
- **`combos.ts`**: a per-level table of about 400 patterns (type, comparison rank, required ranks). `fill` tries to satisfy a pattern from natural cards, then wild cards; wild cards never stand in for jokers. `classify(cards)` returns every reading of exact cards, `readPlay` picks the reading that beats the table, `legalPlays(hand, level, previous)` enumerates moves. `beats` and `bombPower` hold the bomb ladder: 4 < 5 < straight flush < 6+ < four jokers. Straights, tubes and plates compare by natural top rank, not level value.
- **`game.ts`**: an immutable state machine over `GameState`: `newMatch` → `play` / `pass` → `settle` → `startNextHand` (deals and applies tribute) → `returnTribute`. Phases are `return`, `play`, `handOver`, `matchOver`. `checkPlay` returns the user-facing reason a play is illegal. `toSave` / `parseSave` / `resumeMatch` persist only between hands; no cards are saved.
- **`bot.ts`**: `advise(state, player, skill, random)` returns `{ combo, reason }` and is used for bots, hints and coach feedback alike. `evaluateHand` estimates turns left; the `advanced` level adds card counting (`readTable`, `isTop`) and situational rules (block, feed partner, two-step finish). Levels are `novice`, `basic`, `advanced`; the coach always uses `advanced`.

Seats: 0 is the human, 1 is 下家, 2 is the partner (对家), 3 is 上家. `teamOf(p) = p % 2` and play order is `(p + 1) % 4`.

### UI

- **`ui/useGame.ts`** owns all game state. It wraps `GameState` in a view that also tracks each seat's last play in the current trick, runs bot turns on an 800 ms timer, and exposes the human's actions.
- **`ui/columns.ts`** turns the hand into rank columns plus hand-made piles (理牌). **`ui/situation.ts`** writes the coach's description of the position.
- Components come from `@ui-sdk/react` (Button, Toggle, ToggleGroup, Dialog, SegmentedControl, Field). Styling is plain CSS in `src/index.css`, keyed on `data-slot` and state attributes such as `data-pressed`; card sizes derive from a `--cw` custom property in container-query units.
- Three layouts share one stylesheet: desktop (coach docked), phone landscape (`max-height: 480px`) and upright phone (`max-width: 620px`, where hand columns overlap and the table area scrolls so the hand and controls stay on screen). Phone browsers leave only about 300px of height in landscape, so that layout puts the tools left of the hand and the action buttons right of it.
- Dialogs render inside the top bar, so `[data-slot="dialog-content"]` resets inherited text styles such as `white-space`.
- Browser storage keys: `guandan.match`, `guandan.skills`, `guandan.coach`, `guandan.tracker`. A new key needs the `guandan.` prefix and an entry in this list.

## What CI checks

Every pull request runs two required jobs. Run the left column locally to see the same result.

| Command | Catches | Typical fix |
| --- | --- | --- |
| `npm run lint` | React rules (hooks order and dependencies, state set during render or in an effect, impure render, components defined inside components, index keys, exports that break fast refresh), accessibility, import cycles, `any` and `!`, inline `style`, the `as` prop, ui-sdk root or private imports, UI or browser code inside `src/engine` | Follow the message. Move shared helpers out of component files; import `@ui-sdk/react/<component>`; style from `data-slot` in `src/index.css` |
| `npm run check:conventions` | A hand-written widget `role` that ui-sdk already ships, `Math.random()` called in the engine, an undocumented storage key, a skill without frontmatter, `CLAUDE.md` drifting from `@AGENTS.md`, broken doc links | Each failure prints its own fix |
| `npm test` | Broken rules, bots that peek at hidden hands, reasons not written in Chinese, a game screen that no longer deals, hints or plays | Fix the code, not the test, unless the rule itself changed on purpose |
| `npm run build` | Type errors and anything Vite cannot bundle, including broken CSS | The dev server tolerates some broken CSS. The build does not |
| `npm run check:bundle` | A bundle that outgrew its budget | Remove the heavy dependency or root import |
| `npm run check:commits` (CI only, on the title and every commit) | Messages that are not Conventional Commits | Reword; see [CONTRIBUTING.md](CONTRIBUTING.md) |

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
- Check a UI change at about 375×550, 852×300 and 1280×720. When testing in a browser, open the dev server as `http://qa.localhost:<port>` instead of `localhost`: it is the same server with separate storage, so test saves and settings do not leak into a real session.
- UI tests start with `// @vitest-environment jsdom` on the first line. Engine tests run in plain Node and must stay that way.

## Done means

- `npm run check` passes, and you read its output rather than only its last line.
- The change has a test that fails without it.
- Docs that describe the changed behaviour are updated in the same pull request: this file, the skills, and both READMEs when a feature or command changes.
- The pull request says what you could not verify (for example "not checked on a real phone").
