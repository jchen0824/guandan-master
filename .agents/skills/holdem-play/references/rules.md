# Texas Hold'em rules, as `src/holdem` implements them

No-limit Texas Hold'em for six or nine seats. Where this repo makes a choice that other rule sets make differently, it says so. All of it is in `game.ts` (the table) and `hands.ts` (hand ranking) unless noted.

## The table

- Six or nine seats (`TABLE_SIZES`). Seat 0 is the player (`HERO`). The computer players are 甲 乙 丙 丁 戊 at six, and 甲 乙 丙 丁 戊 己 庚 辛 at nine (`SEAT_NAMES`).
- The size is the length of `seats` and is stored nowhere else. `newTable(rng, size)` picks it; every other function reads it from the table it is given. The player picks the size in 设置 (牌桌人数), which starts a new table after a confirm. A table never changes size while it is played.
- Everyone starts with 2,000 practice chips (`STARTING_STACK`). Small blind 10, big blind 20 (`SMALL_BLIND`, `BIG_BLIND`). No antes, no rake.
- **Out of chips, out of the table.** As in a real game, a seat that has no chips when a hand is dealt is out (`Seat.out`, also `folded`): no cards, no blinds, no turn, and its label says 出局. Nobody is given chips again. A stack shorter than its blind posts what it has and is all-in; the bet to match is still a full big blind.
- **The end of a table** (`tableOver`, `stacksOver`): when the player has no chips left (你出局了), or nobody else has any (全桌冠军). The table then offers 再开一桌 instead of 下一手, and `nextHand` throws. `knockedOut` lists the seats that lost their last chips in a hand; the result line names them (甲输光了筹码，出局).
- The button moves clockwise to the next seat still in each hand. The first button is random (`newTable`).
- **Between visits.** At the end of every hand the stacks, the button and the hand number are saved (`toTableSave`), and the next visit deals the hand after it (`resumeTable`); a seat saved with no chips stays out. No cards are saved, so a hand left halfway is dealt afresh from the stacks it started with, as with a 掼蛋 match. A table that had ended is not resumed: the next visit starts a new one. 重新开始 in 设置 puts everyone back to 2,000 at hand 1. The save is the same at both sizes, and its size is the number of stacks, so a six-seat save written before nine-seat tables existed still loads. With nothing to carry on, the next table has the size the player last started (`guandan.holdem.seats`), or six on a first visit.

## Dealing and positions

- The small blind is the next seat still in left of the button, the big blind the one after. Both post before the cards. **Heads-up** (two left) the button posts the small blind, acts first before the flop and last after it.
- Two cards each, one at a time, starting from the small blind, to the seats still in.
- Positions are counted clockwise from the button among the seats still in (`positionName`, `positionGroup`). One table in `game.ts` gives each seat its name for every number of players still in, so a nine-seat table with three out is named like a six-seat one:

  | In | Clockwise from the button |
  | --- | --- |
  | 9 | 庄位 小盲 大盲 枪口 枪口+1 枪口+2 中位 劫位 关位 |
  | 8 | 庄位 小盲 大盲 枪口 枪口+1 中位 劫位 关位 |
  | 7 | 庄位 小盲 大盲 枪口 中位 劫位 关位 |
  | 6 | 庄位 小盲 大盲 枪口 中位 关位 |
  | 5 | 庄位 小盲 大盲 枪口 关位 |
  | 4 | 庄位 小盲 大盲 枪口 |
  | 3 | 庄位 小盲 大盲 |
  | 2 | 庄位 大盲 (the button also posts the small blind) |

  枪口 is first to act before the flop and 关位 is the seat before the button. A seat that is out is 出局. The coach and the computer players read the group, not the name: 庄位 and 关位 are late, 小盲 and 大盲 are blinds, the 枪口 seats are early, and 中位 and 劫位 are middle. 劫位 is middle because it is the same seat, two before the button, that six-handed is called 中位.

## Betting

- **Order.** Before the flop, the first to act is left of the big blind, and the big blind acts last: it may check if nobody raised (its "option"). After the flop, the first to act is the first seat still able to bet left of the button.
- **Streets.** 翻牌前 (no board cards), 翻牌 (three), 转牌 (the fourth), 河牌 (the fifth). Cards are dealt straight from the deck; there is no burn card.
- **Actions** (`Action`): fold; check, only when there is nothing to call; call, which is all-in when the stack is short; raise `to` an amount, which is called a bet when nobody has bet on the street.
- **Sizes.** The smallest bet is one big blind. A raise must be at least as big as the last full bet or raise on the street: to at least `currentBet + lastRaise` (`minRaiseTo`). The most is all-in (`maxRaiseTo` = chips in front plus stack). A player whose chips are short of a minimum raise may still go all-in for less.
- **Short all-ins and re-raising.** An all-in smaller than a full raise does not change the size of the next minimum raise. A player who has already acted on the street may raise again only once the bet has grown by a full raise since they last acted, whether in one raise or in several short all-ins added together (`actedAt` in the state). Until then they may only call or fold. Players who have not yet acted may always raise.
- Nobody may raise when every other player still in is all-in.
- A round ends when every player who can still act has acted since the last bet or raise. A bet or raise reopens the action to everyone else who can still act.
- `act` refuses anything else with a Chinese reason the player sees: 这一手已经结束。 / 还没轮到这位玩家。 / 前面有人下注，不能过牌。 / 没有需要跟的注，可以过牌。 / 现在不能加注。 / 加注要在 X 到 Y 之间。

## The end of a hand

- **Everyone else folds.** The last player in takes the whole pot at once, their own uncalled bet included. No cards are shown.
- **Nobody left to bet.** When at most one player still has chips to bet (the rest are all-in or folded), the remaining board cards are dealt with no more betting, then the showdown. The same goes when the only player who can still bet has already put in as much as everyone else, which a short blind makes possible: heads-up when the big blind is all-in for less than the small blind, or once the others fold to them. The game checks this after the blinds and after every action (`nothingToDecide`), so nobody is asked to call chips that nobody can match.
- **Showdown.** After the river betting, every player still in shows their cards; nobody mucks. Each player's hand is the best five of their two cards and the five on the board, and a player may use any number of their own cards, including none.

## Pots

- At the showdown the chips are split into a main pot and side pots (`buildPots`): one pot for each amount a player still in has put in, holding everyone's chips up to that amount, folded players' included. A player can win only the pots they put chips into. Chips a bigger stack put in that nobody matched end up in a pot that only that stack is in, so they come back to it.
- Each pot goes to the best hand among the players in it. Equal hands split it. Chips that do not divide go one at a time to the winners nearest the button's left (clockwise from the small blind).
- `result` records each pot with its winners, every hand shown, and each seat's winnings. The table's result line names everyone who won chips (`ui/holdem/summary.ts`).

## Hand ranking

Strongest first (`CATEGORIES`): 同花顺 straight flush, 四条 four of a kind, 葫芦 full house, 同花 flush, 顺子 straight, 三条 three of a kind, 两对 two pair, 一对 one pair, 高牌 high card.

- `evaluate(cards)` returns the best five of any number of cards and a `score`; a higher score wins and equal scores tie. The score compares the category, then the cards that make it, then the kickers, as standard rules do.
- The ace is high, and also low in A-2-3-4-5, the lowest straight. That straight ranks below 6-high.
- Suits never break a tie.

## What the 规则 dialog tells the player

`Rules` in `src/ui/holdem/Holdem.tsx` is the player's version of this page in a few lines, one of them on positions at six and nine seats. Change it whenever a rule here changes.
