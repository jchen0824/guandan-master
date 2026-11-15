# Rules, as this repo implements them

Regional rule sets differ. This file describes what the code does; where the code made a choice between variants, it says so. Source files are under `src/engine`.

## Cards and ranking

- 108 cards: two standard decks plus two small jokers (小王) and two big jokers (大王). Each player gets 27.
- Rank order for singles, pairs, triples, full houses and bombs, low to high: 2 3 4 5 6 7 8 9 10 J Q K A, then the **level card**, then 小王, then 大王.
- The level card (级牌) is the rank of the level being played. At level 7, a 7 beats an A. `rankValue(rank, level)` returns 15 for it (`cards.ts`).
- Suits never rank against each other. Suit only matters for a straight flush and for the wild card.
- The wild card (逢人配, `isWild`) is the **heart** level card. There are two. It can stand for any card except a joker. Played alone it is just a level card.

## Shapes (牌型)

| Type in code | Chinese | Cards | Notes |
| --- | --- | --- | --- |
| `single` | 单张 | 1 | |
| `pair` | 对子 | 2 | Two jokers of the same colour are a pair; one small plus one big is not |
| `triple` | 三张 | 3 | Played alone, with no kicker |
| `fullHouse` | 三带二 | 5 | Triple plus a pair. Ranked by the triple. The pair may be jokers |
| `straight` | 顺子 | exactly 5 | A may be low (A-2-3-4-5) or high (10-J-Q-K-A). No wrap-around, no jokers |
| `tube` | 三连对 | 6 | Three consecutive pairs. A may be low or high |
| `plate` | 钢板 | 6 | Two consecutive triples. A may be low or high |
| `bomb` | 炸弹 | 4 to 10 | Four or more of one rank (wild cards can extend it) |
| `straightFlush` | 同花顺 | 5 | A straight in one suit. It is a bomb |
| `jokerBomb` | 四大天王 | 4 | All four jokers |

There is no "triple with one", no four-with-two, no straight longer or shorter than five, and no airplane-with-wings. If a contributor adds one from another game, that is a bug.

Straights, tubes and plates compare by their **natural top card**, and the level card sits in its natural place inside them: at level 7, 5-6-7-8-9 is an ordinary straight topped by 9. A-2-3-4-5 is the lowest straight (top 5).

## Beating a play

- A non-bomb beats only the **same type** with a **higher rank**. Same rank does not beat.
- Any bomb beats any non-bomb.
- Bombs against bombs (`bombPower`, `beats` in `combos.ts`), weakest to strongest:

  **4 cards < 5 cards < straight flush < 6 cards < 7 < 8 < 9 < 10 < four jokers**

  Between two bombs of the same class, the higher rank wins (level card high, as for singles). Between two straight flushes the higher top card wins.
- When the same cards can be read two ways (for example with a wild card), `readPlay` picks the reading that beats the table, or the strongest reading when leading. A five-card straight in one suit is always read as a straight flush.

## A trick

- The leader plays any legal shape. Play goes clockwise: `(p + 1) % 4`.
- Each player beats it or passes (不出, 过牌). Passing does not lock you out: you may play later in the same trick.
- When every other player still in the hand has passed, the trick ends and the last player to play leads.
- **接风**: if that player has just played their last cards, their **partner** leads instead.
- The leader must play; `pass` throws when there is nothing on the table.

## Ending a hand

Finishing order is 头游 (1st), 二游, 三游, 末游 (4th). The hand stops as soon as the result is known: when both partners of one team have finished first and second, or when three players have finished.

The **winning team** is the team of the 头游. It gains levels by where the winner's partner finishes (`settle` in `game.ts`):

| Partner finishes | Called | Levels gained |
| --- | --- | --- |
| 2nd | 双下 (double win) | 3 |
| 3rd | | 2 |
| 4th | | 1 |

Levels stop at A; there is no overshoot. The next hand is played at the winning team's new level, and that team is the declarer.

## Winning the match (过A)

A team wins the match only when all three hold: it is the declarer, its level is A, and it wins the hand with its partner **not** last (gain of 2 or 3).

A team playing its own A that wins with its partner last, or loses the hand, has failed once. **House rule:** after three failures the team drops back to level 2 and its failure count resets.

## Tribute (进贡 and 还贡)

Applied by `startNextHand` at the start of every hand after the first.

- **Who pays.** If the winners finished 1st and 2nd (双下), both losers pay: **double tribute**. Otherwise only the 末游 pays, to the 头游, even when they are partners.
- **What is paid.** The payer's highest card, not counting the wild heart level card (`tributeCard`). The engine picks it; the player has no choice.
- **Double tribute.** The larger of the two cards goes to the 头游, the other to the 二游. If they are equal, the payer sitting next clockwise from the 头游 pays the 头游.
- **Resisting (抗贡).** If the paying side holds both big jokers between them (one payer with two, or one each in a double tribute), nobody pays and the previous 头游 leads.
- **Return (还贡).** Each receiver gives one card back to the player who paid them. **House rule:** it must be a 10 or lower, unless the receiver holds nothing that low (`canReturn`). The level card counts by its face rank here, so a heart 2 at level 2 is returnable, but bots never return the wild card.
- **Who leads.** After a single tribute, the payer leads. After a double tribute, the payer of the larger card leads (the same clockwise rule on a tie).

The first hand of a match is played at level 2 with a random leader and no tribute.

## Not in this game

No turn timers (a product decision: beginners need time to think). No requirement to announce remaining cards, because every seat's card count is always on screen. No online play, no betting, no scoring beyond levels.

## Saving

`toSave` produces a save only between hands (`phase === "handOver"`): levels, failure counts and the last result, which is enough to deal the next hand and work out tribute. No cards are ever saved, so a refresh mid-hand restarts that hand.
