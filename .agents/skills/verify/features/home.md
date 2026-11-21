# Home page

The first screen: one tile for each of 掼蛋, 德州扑克 and 日本麻将, each saying where the player left off.

## Sub-features

- `home-tiles` shows the three tiles and enters a game from each.
- `home-seats` picks 6 人 or 9 人 for the next Hold'em table.
- `home-back` returns from a table with the ‹ button, and the tile then says where the player left off.

## How to get to it (user POV)

- Open the site for the first time.
- Press ‹ (回到首页) at the left of any table's top bar.

## Driving it with verify.mjs

Preconditions:

- None beyond the baseline.

- **Tiles.** Run `V open home --fresh`, then `V proof home`. `V press "?"` lists 进入掼蛋牌桌, 6 人, 9 人, 进入德州扑克牌桌 and 进入日本麻将牌桌.
- **Enter.** Run `V press "进入日本麻将牌桌"`, then `V proof home-entered`. The JSON has `"game": "mahjong"`.
- **Back.** Run `V press "回到首页"`, then `V proof home-back`. The JSON has `"game": "home"` and the mahjong tile in the PNG says where the match stands.
- **Seats.** Run `V press "9 人"`, `V press "进入德州扑克牌桌"`, then `V proof home-nine`. The PNG shows a nine-seat table.

## Gotchas

- The back button is named 回到首页 on 掼蛋 and 日本麻将 and `‹ 牌桌教练` on 德州扑克. `V press "?"` shows which.
