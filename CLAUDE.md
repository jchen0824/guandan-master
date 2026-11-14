# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

掼蛋教练 is a single-player Guandan (掼蛋) trainer for beginners: the human plays seat 0 against three rule-based bots, with a coach that explains positions and comments on each move. It is a static Vite + React + TypeScript site with no server, database or LLM. Live at https://guandan-iota.vercel.app.

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm test         # vitest run (engine tests)
npm run bench    # 300 simulated hands per bot matchup; prints win and double-win rates
```

- Typecheck alone with `npx tsc -b`. The root `tsconfig.json` only holds references, so `npx tsc --noEmit` checks nothing.
- Single test: `npx vitest run src/engine/engine.test.ts -t "orders bombs by size"`.
- `benchmark.test.ts` is skipped unless `VITE_BENCH` is set; `npm run bench` sets it. Re-run it after changing `bot.ts` and compare against the previous numbers.
- Deploy: `vercel deploy --prod --yes` from the repo root. Vercel is not connected to the GitHub repo, so pushing does not deploy.

## Architecture

Two layers. `src/engine` is pure TypeScript with no React or DOM; `src/ui` and `src/App.tsx` render it.

### Engine (`src/engine`)

- **`cards.ts`** — a card is `{ id, suit, rank }` with rank 2–14 (A = 14), 16 small joker, 17 big joker. `rankValue` moves the current level's rank to 15 (above A, below jokers). `isWild` is the heart card of the level rank (逢人配).
- **`combos.ts`** — a per-level table of about 400 patterns (type, comparison rank, required ranks). `fill` tries to satisfy a pattern from natural cards, then wild cards; wild cards never stand in for jokers. `classify(cards)` returns every reading of exact cards, `readPlay` picks the reading that beats the table, `legalPlays(hand, level, previous)` enumerates moves. `beats` and `bombPower` hold the bomb ladder: 4 < 5 < straight flush < 6+ < four jokers. Straights, tubes and plates compare by natural top rank, not level value.
- **`game.ts`** — an immutable state machine over `GameState`: `newMatch` → `play` / `pass` → `settle` → `startNextHand` (deals and applies tribute) → `returnTribute`. Phases are `return`, `play`, `handOver`, `matchOver`. `checkPlay` returns the user-facing reason a play is illegal. `toSave` / `parseSave` / `resumeMatch` persist only between hands; no cards are saved.
- **`bot.ts`** — `advise(state, player, skill, random)` returns `{ combo, reason }` and is used for bots, hints and coach feedback alike. `evaluateHand` estimates turns left; the `advanced` level adds card counting (`readTable`, `isTop`) and situational rules (block, feed partner, two-step finish). Levels are `novice`, `basic`, `advanced`; the coach always uses `advanced`.

Seats: 0 is the human, 1 is 下家, 2 is the partner, 3 is 上家. `teamOf(p) = p % 2` and play order is `(p + 1) % 4`.

### UI

- **`ui/useGame.ts`** owns all game state. It wraps `GameState` in a view that also tracks each seat's last play in the current trick, runs bot turns on an 800 ms timer, and exposes the human's actions.
- **`ui/columns.ts`** turns the hand into rank columns plus hand-made piles (理牌).
- Components come from `@ui-sdk/react` (Button, Toggle, ToggleGroup, Dialog, SegmentedControl, Field). Read `node_modules/@ui-sdk/react/docs/llms.txt` and the component page before using one. Styling is plain CSS in `src/index.css`, keyed on `data-slot` and state attributes such as `data-pressed`; card sizes derive from a `--cw` custom property in container-query units.
- Three layouts share one stylesheet: desktop (coach docked), short landscape (`max-height: 480px`) and upright phone (`max-width: 620px`, where hand columns overlap and the table area scrolls so the hand and controls stay on screen). Check a UI change at about 375×550, 844×390 and 1280×720.
- Dialogs render inside the top bar, so `[data-slot="dialog-content"]` resets inherited text styles such as `white-space`.
- Browser storage keys: `guandan.match`, `guandan.skills`, `guandan.coach`, `guandan.tracker`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <summary>`.

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `chore`.
- Scopes used here: `engine`, `bot`, `ui`; omit the scope for repo-wide changes.
- Summary in the imperative, lower case, no trailing full stop, 72 characters at most. Put the why in the body.
- Mark a breaking change with `!` after the type or scope.

Examples: `feat(ui): add phone portrait layout`, `fix(bot): hold bombs until an opponent is nearly out`, `docs: describe the save format`.

## Conventions and gotchas

- **Chinese is the primary language.** Every user-facing string is Chinese, including messages produced inside the engine (`checkPlay` reasons, `advise` reasons, `describeCombo`). Tests assert on some of this text.
- **Bots must not peek.** `advise` may only use the player's own hand, card counts and the play log, because the coach teaches from the same logic.
- **No turn timers**, by product decision.
- `erasableSyntaxOnly` and `verbatimModuleSyntax` are on: no enums or parameter properties, and type-only imports need `import type`.
- `legalPlays` re-reads any play that uses a wild card through `classify`, so its reported rank matches what `play` will record. Keep that when adding patterns.
- Agreed rule variants: three failed attempts at A drop a team to level 2; return tribute must be a 10 or lower; after a double tribute the payer of the larger card leads (clockwise on a tie); a resisted tribute (抗贡) means the previous winner leads.
- When testing in a browser, open the dev server as `http://qa.localhost:<port>` instead of `localhost`: it is the same server with separate storage, so test saves and settings do not leak into a real session.
