# 日本麻将 coach

On the player's turn the coach says which tile to discard and why, marks that tile in the hand, and opens its working on request. Against a 立直 it switches from 攻 to 守 and marks how safe each tile is.

## Sub-features

- `mjc-advice` shows the discard, the 向听 and the 进张 count on the player's turn.
- `mjc-working` opens 怎么算的 with every option and the glossary, readable on its light panel.
- `mjc-defend` says 守 and names a safe tile, or says that no safe tile was found.
- `mjc-live-count` leaves out a 进张 whose four tiles are all in sight.
- `mjc-off` hides the coach and the marker on the tile.

## How to get to it (user POV)

- Open 日本麻将 from the home page; the coach is on for a new player.
- Press 教练 in the top bar to turn it off or on.
- Press 怎么算的 in the coach's box.

## Driving it with verify.mjs

Preconditions:

- The fixtures `e2e/fixtures/mahjong-exhausted-wait.json` and `e2e/fixtures/mahjong-no-safe-tile.json` exist.

- **Advice with a live count.** Run `V open mahjong --fresh --fixture mahjong-exhausted-wait`, then `V proof mjc-advice`. The coach line reads `打东，打完两向听，进张 11 种 33 张。` (twelve kinds would help, one is used up), and the JSON has `"pick": "东"`, `"stance": "attack"`.
- **Working.** Run `V press "怎么算的"`, then `V proof mjc-working`. `state.dialog` is true. In the PNG the title 教练是怎么算的 and every row (`打东 两向听 · 进张 11 种 33 张`) are dark text on the light panel.
- **Close and discard.** Run `V press "知道了"`, `V press "东"`, `V press "打出"`, then `V proof mjc-after-discard`. `state.cards` went from 14 to 13 and the coach reads `等别人出牌。`.
- **Defend with no safe tile.** Run `V open mahjong --fresh --fixture mahjong-no-safe-tile`, then `V proof mjc-defend`. The JSON has `"stance": "defend"`; the coach says `下家立直了。` and `找不到更安全的牌，这张也有危险`, and never `相对安全`. In the PNG every tile in hand has a red bar.
- **Off.** Run `V press "教练"`, then `V proof mjc-off`. The JSON has `"coach": null`. Press 教练 again to turn it back on: the setting is stored.

## Gotchas

- On a phone the coach is a bar: the list of three options is hidden and only 怎么算的 shows them. Read counts from the sentence or the dialog.
- A defend with a 现物 needs a hand that holds one; no fixture has that yet. `src/mahjong/coach.test.ts` covers it.
- The fixtures are saved hands, replayed by the engine. If the engine's dealing changes, they throw on load and the table starts a new match: `state.cards` is then 13 or 14 with different tiles. Make them again from a test.
