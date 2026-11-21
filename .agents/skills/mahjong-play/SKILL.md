---
name: mahjong-play
description: Use before changing the riichi mahjong (日本麻将) rules, computer players, coach advice, the 规则 dialog, or any Chinese wording about mahjong play in 掼蛋教练 (src/mahjong, ui/mahjong). Holds the rules exactly as this repo implements them - tiles, 役, 符 and 番, 立直, 振听, calls, draws, the end of a match - what the coach teaches - 向听, 进张, 现物 and 筋, when to attack or defend - how the three computer player levels differ, and the Chinese terms.
---

# How riichi mahjong is played, and how this repo plays it

This trainer teaches beginners. A computer player that plays badly on purpose is fine; a coach that explains a move wrongly teaches people the wrong thing. So a change to `src/mahjong` has to be correct as mahjong and not only as code. Read this before you touch the rules, the computer players or anything the coach says.

## The game in one paragraph

Four seats: the player (你, seat 0) and three computer players (下家, 对家, 上家). 136 tiles, no red fives, 25,000 points each. A hand is won with four sets and a pair (or 七对子, or 国士无双) and at least one 役. Players draw and discard in turn; a discard can be claimed for a win (荣和) or a call (吃 from 上家 only, 碰, 杠). The match is one round (东风战) or two (半庄战), and also ends when a seat falls below 0.

## Rules this repo plays by

- **役.** Every standard 役 up to 役满 is in `yaku.ts`; `valueOf()` tries every way to read the hand and keeps the dearest. 断幺九 is allowed in an open hand. 13 番 or more counts as one 役满. Not included: 流局满贯, 人和, 包牌, double 役满 for one hand shape.
- **符 and points.** 七对子 is 25 符; 平和 is 20 by 自摸 and 30 by 荣和; an open hand with nothing to add is 30. 满贯 from 5 番, or 4 番 40 符, or 3 番 70 符. 本场 is 300 a hand.
- **立直.** Closed hand, 听牌, 1,000 points, four tiles left in the wall. The stick is paid only once the discard is let go. After it the table discards for the player; a 暗杠 is allowed only with the drawn tile and only if the waits stay the same.
- **听牌 means a wait that exists.** A hand that could only win on a fifth copy of a tile it holds is not 听牌 (`winningKinds` in `game.ts`), for 立直 and for the 不听罚符.
- **振听.** A wait in your own 牌河; a winning tile let go by, until your next draw (a call in between does not lift it); a winning tile let go by after 立直, for the rest of the hand. 自摸 is always allowed.
- **Calls.** 荣和 beats 碰 and 杠, which beat 吃. Two or three seats may win on one tile; 本场 and the sticks go to the first after the discarder. 食替 is barred, and a call that would leave only barred tiles is not offered.
- **Draws.** 荒牌流局 with 3,000 shared; the dealer stays when 听牌. Abortive: 九种九牌, 四风连打, 四家立直, 四杠散了 (checked before any call on the discard). An abortive draw always repeats the hand.
- **河底捞鱼 counts on the discard after a 杠 that used up the wall**; only 海底摸月 is lost to a replacement draw.
- **The match ends** after the last hand unless the dealer stays, when a seat is below 0, or when the dealer stays in the last hand and is in the lead.

## What the coach teaches

`coach.ts` returns one piece of advice for the seat to act, with a `reason` in Chinese that the player reads.

- **向听 and 进张.** For every tile the player could discard: how far the hand is from 听牌 afterwards, and which tiles would bring it nearer, counting only tiles not yet in sight (`efficiency.ts`); a kind whose four tiles are all in sight is not listed or counted. The pick is the lowest 向听, then the most 进张, then the tile least useful later (an honour before a 一 or 九 before a middle tile).
- **立直.** Advised when the hand is closed and 听牌 and at least one winning tile is not in sight.
- **Safety against a 立直.** `safe` (现物): in that seat's 牌河, or discarded by anyone since it declared. `suji` (筋): a number tile whose neighbours three away are safe on every side it has. `honor` (熟字牌): an honour seen twice or more. `danger`: anything else. With several seats in 立直 a tile is as dangerous as its worst case.
- **攻 or 守.** With a 立直 on the table the coach attacks when its hand is 听牌, or one away and its best discard is not `danger`; otherwise it defends with the safest tile, breaking ties by what keeps the hand nearest. When that tile is itself `danger`, the reason says no safer tile was found; it never calls such a tile safe.
- **Answers.** It takes a win; it calls 碰 on 役牌 (白 发 中, the round wind, the seat wind); it lets everything else go and says why: a call gives up 立直, and an open hand then needs a 役 of its own. This is a rule for beginners. The coach does not check whether the hand could still win open (断幺九, a 役牌 already called), so its words must not say that it could not.
- **The coach tells the truth.** The `reason` must name the rule that decided the advice, with numbers that match the options shown beside it.

## The computer players

`botAction(state, seat, rng, skill)` in `bot.ts`. All three take a win when offered.

- `novice` (新手): looks only at 向听, not at 进张; calls 碰 on anything, so it often has no 役; declares 立直 whenever it can; never defends.
- `basic` (普通, the default): the fastest hand; 碰 on 役牌 only; 立直 when a winning tile is left; never defends.
- `advanced` (进阶): does what the coach advises, defence included.

`npm run test:levels` plays each pair for 800 hands on the same deals with the seats swapped and fails unless the stronger level wins at least 20,000 points. Do not lower that number to make a change pass.

## Things you must not break

- **One way to move.** `act(state, seat, action)` is the only thing that changes a hand, and `legalActions(state, seat)` says what is allowed. The screen, the computer players and the tests all go through them.
- **No peeking.** The coach and the computer players read their own hand, the 牌河, the calls and the 宝牌 indicators (`visibleCounts`). A test deals the hidden tiles again and fails if an `advanced` player's move changes.
- **Deterministic.** Chance comes in as `rng`; `Math.random()` is banned in `src/mahjong`.
- **Chinese for everything the player reads.** Terms: 万 筒 索; 东 南 西 北 白 发 中; 牌山, 牌河, 宝牌指示牌; 吃 碰 杠 过; 立直, 自摸, 荣和, 放铳; 听牌, 向听, 进张, 振听; 役, 番, 符; 庄家, 本场, 供托; 现物, 筋, 熟字牌. Seats are 你, 下家, 对家, 上家.

## Checklist for a rule, coach or computer player change

1. Write the position as a test beside the code with the helpers in `testing.ts`: `rig(state, { hands: { 0: "123m456p…" }, draws: "5s" })` deals chosen tiles, `matchWithDealer(0)` fixes the dealer, `kinds("5s")` reads a tile name. Assert the action and that the Chinese `reason` names the right idea.
2. For a change to `bot.ts`, `coach.ts` or `efficiency.ts`, run `npm run test:levels` and put its numbers in the pull request.
3. If you changed what is legal, update this file and the 规则 dialog (`Rules` in `src/ui/mahjong/Mahjong.tsx`) together.
4. Run `npm run check`, and `npm run test:e2e` if the screen shows something new.
