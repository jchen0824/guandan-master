---
name: guandan-play
description: Use before changing game rules, bots, hints, coach text, the 记牌器, or any Chinese wording about play in 掼蛋教练 (src/engine, ui/situation.ts, ui/Coach.tsx, ui/Tracker.tsx). Holds the Guandan (掼蛋) rules exactly as this repo implements them and the play skills a good player uses - 手数, 牌权, 顶牌, 算牌/记牌, 让牌, 送牌, 接风, bomb timing, 逢人配 - each mapped to the code that implements it.
---

# How 掼蛋 is played, and how this repo plays it

This trainer teaches beginners. A bot that plays badly, or a coach that explains a move wrongly, teaches people the wrong thing, so a change to the engine has to be correct as *card play* and not only as code. Read this before you touch rules, bots or coach text.

## The game in one paragraph

Four players, two teams, partners sit opposite. Two decks with jokers: 108 cards, 27 each. Players take turns clockwise; you either beat the play on the table with a higher play of the same shape (or a bomb) or pass. When everyone else passes, the last player to play leads anything. The first player to empty their hand is 头游; the hand's result depends on where the winner's **partner** finishes. Each team has a level from 2 to A; the winning team moves up 1–3 levels and the first team to win a hand at level A, with the partner not last, wins the match.

Two things make it different from other climbing games, and most mistakes come from forgetting them:

1. **The level card (级牌)**. The rank a hand is played at ranks above A and below the jokers, for singles, pairs, triples and bombs. It keeps its natural place inside straights, tubes and plates.
2. **The wild card (逢人配)**. The two *heart* level cards can stand for any card except a joker.

## Read next, by task

| You are changing | Read |
| --- | --- |
| What is legal: shapes, comparison, bombs, tribute, levels, winning | [references/rules.md](references/rules.md) |
| How a bot decides, what a hint recommends, what the coach says | [references/strategy.md](references/strategy.md) |
| Any Chinese text, or you met a term you do not know | [references/glossary.md](references/glossary.md) |

## Things you must not break

- **Seats.** 0 is the human, 1 is 下家 (plays after you, opponent), 2 is 对家 (partner), 3 is 上家 (plays before you, opponent). `teamOf(p) = p % 2`.
- **No peeking.** `advise` sees one hand, the number of cards in the others, and the play log. Real players have exactly this, and the coach teaches from the same function. A test re-deals the hidden cards and fails if advice changes.
- **One brain.** Bots, the 提示 button and the coach's comments all call `advise`. A new rule goes there once, with a `reason` in Chinese that a beginner can follow. Never special-case the hint or the coach.
- **A reason for every move.** `advise` returns `{ combo, reason }`. The reason is shown to the player, so it must be true: describe the rule that actually fired, not a nicer-sounding one.
- **House rules are deliberate.** Three failed attempts at A drop a team to 2; return tribute must be 10 or lower; no turn timer. Do not "fix" these to match another rule set.
- **Three skill levels stay distinct.** `novice` makes careless mistakes on purpose, `basic` plays its own hand sensibly, `advanced` counts cards and cooperates. Improving `advanced` must not leak into the other two, or the difficulty setting stops meaning anything.

## Checklist for a bot or rule change

1. Write the position as a test in `src/engine/engine.test.ts` using the `cards("S5 H5 sj")` helper, and assert both the move and that the `reason` mentions the right idea.
2. Run `npm run bench` before and after. Stronger levels must still beat weaker ones by a clear margin (advanced beats basic about 80% of hands, basic beats novice about 60%), and the double-win rate between equal bots should not rise.
3. If you added or changed a play concept, update [references/strategy.md](references/strategy.md): what it is, when it applies, where the code is.
4. If you changed what is legal, update [references/rules.md](references/rules.md) and the 规则 dialog in `src/ui/Dialogs.tsx` together.
5. Run `npm run check`.
