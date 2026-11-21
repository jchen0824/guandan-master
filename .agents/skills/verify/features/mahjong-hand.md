# 日本麻将 hand

The player holds thirteen tiles against three computer players: draws, discards, may answer another seat's discard, and sees the result of the hand with the 役 and each seat's points.

## Sub-features

- `mj-discard` lifts a tile on the first press and discards it with 打出.
- `mj-answer` offers 荣和, 碰, 杠, 吃 and 过 after another seat's discard.
- `mj-result` shows the result panel and deals the next hand with 下一局.
- `mj-resume` comes back to the same tiles after leaving in the middle of a hand.
- `mj-settings` changes 比赛长度 and the computer players' level, and starts over with 重新开始.

## How to get to it (user POV)

- Press 进入日本麻将牌桌 on the home page.
- Reopen the site: the last game opens where it was left.

## Driving it with verify.mjs

Preconditions:

- None beyond the baseline.

- **Deal.** Run `V open mahjong --fresh --seed 3`, then `V proof mj-deal`. `state.cards` is 13, or 14 with `state.myTurn` true when the player is the dealer.
- **Discard.** When `state.myTurn` is true, run `V press "?"` to read the tile names, `V press "<a tile>"`, `V press "打出"`, then `V proof mj-discard`. The tile is in the player's 牌河 in the PNG.
- **Answer.** When a proof shows 过 among the buttons (`V press "?"`), run `V press "过"`. The status line moves on.
- **Result.** Repeat discard and 过 until `state.over` is true, then `V proof mj-result`. With seed 3 and discarding the drawn tile each turn, 上家 declares 立直 and wins on the player's discard within about ten turns. The PNG shows the panel with the winning tiles, the 役 and four point boxes. `V press "下一局"` deals again.
- **Resume.** In the middle of a hand run `V proof mj-before`, then `V open mahjong` without `--fresh`, then `V proof mj-after`. The hand in the two PNGs is the same.
- **Settings.** Run `V press "设置"`, then `V proof mj-settings`. The dialog fits; `V press "好了"` closes it.

## Gotchas

- Two tiles of one kind have the same name; `press` takes the last, which is the drawn one when it is of that kind.
- After 立直 the table discards for the player, so there may be no tile to press.
- The wall is not drawn on a phone on its side; this map is upright only unless you rotate with the iOS Simulator tool.
