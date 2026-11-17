---
name: holdem-play
description: Use before changing the Texas Hold'em (德州扑克) rules, computer players, coach advice or grading, the 规则 dialog, or any Chinese wording about Hold'em play in 掼蛋教练 (src/holdem, ui/holdem). Holds the rules exactly as this repo implements them - blinds, betting order, minimum raises, short all-ins, side pots, showdown - and the strategy the coach teaches - starting hands, position, pot odds, win rate, outs, bet sizing - each mapped to the code, plus how the three computer player levels differ.
---

# How Texas Hold'em is played, and how this repo plays it

This trainer teaches beginners. A computer player that plays badly on purpose is fine; a coach that explains a move wrongly teaches people the wrong thing. So a change to `src/holdem` has to be correct as *poker* and not only as code. Read this before you touch the rules, the computer players or anything the coach says.

## The game in one paragraph

Six seats: the player and five computer players (甲 乙 丙 丁 戊), no-limit, blinds 10/20, practice chips. Each player gets two cards of their own; five shared cards come face up in three steps (the flop, the turn, the river), with a round of betting before the flop and after each step. In a round you may fold, check when nobody has bet, call, or bet or raise. A hand ends when everyone else has folded, or at the showdown after the river, where the best five of each player's seven cards wins. Chips a player could not match go into side pots, which only the players who matched them can win.

Two things beginners get wrong, and the coach is built around them:

1. **The price of a call.** A call is worth it when your chance of winning is larger than the part of the final pot your call pays for: calling 20 to make a pot of 100 needs a 20% chance (`potOdds().need = call / potAfterCall`). The coach always shows both numbers.
2. **Position.** Acting after the others is an advantage, so the same two cards are worth playing from the button and not from the first seat to act.

## Read next, by task

| You are changing | Read |
| --- | --- |
| What is legal: blinds, betting order, raises, all-ins, pots, showdown, hand ranking | [references/rules.md](references/rules.md) |
| What the coach advises or says, how a decision is graded, how a computer player decides | [references/strategy.md](references/strategy.md) |
| Any Chinese text, or you met a term you do not know | [references/glossary.md](references/glossary.md) |

## Things you must not break

- **Seats.** 0 is the player (`HERO`), 1–5 are 甲 to 戊 (`SEAT_NAMES`). Positions are counted from the button: 庄位, 小盲, 大盲, 枪口, 中位, 关位 (`positionName`).
- **One way to move.** `act(state, seat, action)` is the only thing that changes a hand, and `legalActions(state)` says what is allowed. The screen, the computer players and the tests all go through them. Never let the UI work out what is legal on its own.
- **No peeking.** The coach and the computer players see their own two cards, the board and the betting. A win rate deals the unknown cards at random from what that player cannot see (`odds.ts`), never from the other players' real cards.
- **Deterministic.** Every function that needs chance takes an `rng`; tests pass `seeded(n)`. `Math.random()` is banned in `src/holdem` (`npm run check:conventions`).
- **The coach tells the truth.** Its `reason` is shown to the player, so it must describe the rule that actually decided the advice, with numbers that match. When the win rate only just covers the price, it says so (刚好够); it never says "not enough" about a call that pays.
- **The levels stay in order.** 新手 < 普通 < 进阶 in strength. `npm run test:levels` (in CI) fails when a level stops beating the one below, at the table or in how often it calls or folds wrongly. Do not loosen its thresholds to make a change pass.
- **House choices are deliberate.** Practice chips only. A player with no chips is out, as in a real game, and the table ends when the player is out or the last one left; 再开一桌 starts a new one. No turn timer. Every hand still in at the showdown is turned over; nobody mucks.

## Checklist for a rule, coach or computer player change

1. Write the position as a test beside the code in `src/holdem` with the helpers in `testing.ts`: `rig(state, { [seat]: "AH KH" }, "QS JS TS 2C 3D")` deals chosen cards, `stacked(state, { [seat]: 300 })` sets stacks, `seeded(n)` fixes chance. Assert the action and that the Chinese `reason` names the right idea.
2. For a change to `bot.ts`, run `npm run test:levels` before and after and put both sets of numbers in the pull request.
3. If you changed what is legal, update [references/rules.md](references/rules.md) and the 规则 dialog (`Rules` in `src/ui/holdem/Holdem.tsx`) together.
4. If you changed what the coach teaches or how a level plays, update [references/strategy.md](references/strategy.md).
5. Run `npm run check`, and `npm run test:e2e` if the screen shows something new.
