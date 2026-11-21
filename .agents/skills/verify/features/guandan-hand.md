# 掼蛋 hand

The player is seat 0 with 27 cards against three computer players, on a 3D table (the default) or a flat one, with a coach that describes the position and comments on each play.

## Sub-features

- `gd-3d` paints the 3D table in Safari: felt, fans of card backs, plays lying on the felt, labels facing the camera.
- `gd-2d` switches to the flat table and back.
- `gd-hint` selects a play with 提示 and plays it with 出牌, or passes with 不出.
- `gd-coach` opens the coach on a phone and shows its comment after a play.
- `gd-dialogs` opens 规则, 复盘 and 设置, each fitting the screen.

## How to get to it (user POV)

- Press 进入掼蛋牌桌 on the home page.
- Use the 2D / 3D switch in the top bar.

## Driving it with verify.mjs

Preconditions:

- None beyond the baseline.

- **3D table.** Run `V open guandan --fresh --seed 4 --view 3d`, then `V proof gd-3d`. Look at the PNG: Safari has drawn this table wrong before with every other check green. The felt is green, each opponent has a fan, no label lies flat.
- **Hint and play.** When `state.myTurn` is true run `V press "提示"`, then `V proof gd-hint`: `state.selected` is above 0. Run `V press "出牌"` (or `V press "不出"` when nothing was selected), wait a few seconds, then `V proof gd-played`. The play lies on the felt in the PNG.
- **2D table.** Run `V press "2D"`, then `V proof gd-2d`. The same hand is on the flat table.
- **Dialogs.** Run `V press "规则"`, `V proof gd-rules`, then press its close button (`V press "?"` names it). Do the same for 复盘 and 设置.

## Gotchas

- A seed at page load makes the deal repeatable, not chosen. For an exact deal use 设置, 重新开始整场比赛 as the [browser-qa skill](../../browser-qa/SKILL.md) describes.
- The CI check `ios-safari` photographs this table too (`e2e/ios/`). This recipe is the same look, by hand, before pushing.
