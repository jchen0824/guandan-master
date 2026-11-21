# 德州扑克 hand

The player has one seat at a table of six or nine, no-limit, with a coach that advises fold, check, call or raise on the player's turn and grades the decision.

## Sub-features

- `he-advice` shows the coach's advice and reasons on the player's turn.
- `he-act` folds, calls or raises to one of the five sizes.
- `he-showdown` shows the board, the hands turned over and who won, then 下一手.
- `he-working` opens 怎么算的 after the flop.
- `he-seats` plays at six or nine seats.

## How to get to it (user POV)

- Press 进入德州扑克牌桌 on the home page, after 6 人 or 9 人.

## Driving it with verify.mjs

Preconditions:

- None beyond the baseline.

- **Advice.** Run `V open holdem --fresh --seed 4`, then `V proof he-advice`. When `state.myTurn` is true the JSON's `coach.advice` is one of `fold`, `check`, `call`, `raise`.
- **Act.** Run `V press "?"`: the action buttons carry their amounts (`跟注 20`, `加注到 50`, `弃牌`). Press one by its full name, then `V proof he-acted`.
- **Showdown.** Keep calling or checking on each turn until `state.over` is true, then `V proof he-showdown`. The PNG shows five board cards and the result; `V press "下一手"` deals again.
- **Nine seats.** From the home page (`V open home --fresh`) run `V press "9 人"`, `V press "进入德州扑克牌桌"`, then `V proof he-nine`.

## Gotchas

- Button names include the amount, which changes every hand. Read them with `V press "?"` first.
- A fold ends the player's part of the hand at once; the computer players finish it on their timers before 下一手 appears.
- Exact cards need `guandanQa.dealHoldem`, which this harness cannot call. Use `dealHoldemExactly` in a Playwright test for that.
