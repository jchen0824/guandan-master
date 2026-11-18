# What the coach teaches, and how the computer players decide

The coach (`coach.ts`) and the computer players (`bot.ts`) share their measuring tools (`odds.ts`) and the starting-hand ranking, but not their decisions: the coach plays a fixed, honest beginner's strategy, and the computer players play at the level set in 设置. Every number below is in the code; change them here and there together.

## The measuring tools (`odds.ts`)

- **Win rate.** `equity(hole, board, opponents, rng, samples, betting)` deals the unseen cards many times and counts how often `hole` wins, a tie counting as a share. It moves by a few points from one look to the next. Opponents who have bet on a board of three or more cards are dealt hands that already make at least a pair (up to eight re-deals each), because someone who bets usually has something; without that the number is far too hopeful when facing a bet.
- **Win rate pot by pot.** `shareOfPot(state, seat, rng, samples)` is what the coach and the computer players actually use: the expected share of the chips the seat can win if it calls, worked out for each pot among only the players in it. A short stack's all-in therefore does not count side-pot chips it cannot win. With a single pot it equals `equity`.
- **Price of a call.** `potOdds(state, seat)` returns `call`, `potAfterCall` (all the chips the caller can win, their own call included, capped at what they can match) and `need = call / potAfterCall`, the win rate the call needs to break even.
- **Draws.** `draws(hole, board)` on the flop and turn only, and only for a hand that is not already a straight or better: a flush draw (8 or more cards make a flush), an open-ended straight draw (two ranks complete it) or a gutshot (one rank), and the number of outs. Its `text` is what the coach says: 听同花 / 两头听顺子 / 听卡顺 / 听同花，也听顺子，还有 N 张牌能帮你.
- **Bettors.** `bettorsAgainst(state, seat)` counts the players still in who bet or raised on this street.

## The working a player can do (`read.ts`)

A win rate from 400 deals is not something a person can repeat at the table, so after the flop the coach also shows how a player would estimate it. `advise` returns these lines as `explain`, in this order:

- **你的牌** (`readHand`): what the player holds against the board, in the words a player would use: 只有 A 高 (named by the top card of the best five; when that card is the board's, the player's cards are named as kickers: 你的 10 当踢脚), 顶对 K with a 踢脚 that is 不错 (Q or better) or 偏小 (or, when the other hole card is not in the best five, 另一张 X 用不上 and the board's kickers), 中对 / 底对 (a pair below the top board card; 底对 when it pairs the lowest), 超对 (a pocket pair above every board card), 一对 X：口袋对子 below a board card, 两对, 三条 / 暗三条, or a straight or better (很强). A pair, two pair or trips that are only on the board count as nothing: everyone has them. So does any hand on a full board that the player's cards do not beat (`evaluate` may pick a hole card of the same rank as a board card, so this compares scores). With four of a kind on the board the fifth card decides: the best one possible (an A, or a K under four aces) is 没人能赢你 and the coach says it can at worst split; any other is read as high card. Each read has a strength: nothing, weak pair, top pair, overpair, two pair, trips, strong.
- **能帮你的牌** (`countOuts`): the unseen cards that would make a hand that usually wins against one opponent. From nothing that is top pair or better; from a weak pair, top pair or overpair it is two pair or better; from two pair, trips or better; from trips, a straight or better. Cards are grouped by what they make. Each group says which card has to come, by one rank, one suit or up to three ranks, then how many of them are unseen: 来一张红桃就成同花（还剩 9 张）；来一张 10 或 5 就成顺子（还剩 8 张）. Never "4 张 4": a player read that as four 4s on the board. A card that only improves the board is not an out. Only on the flop and turn.
- **对手**: who bet on this street (下注的人通常至少有一对) and, from the player's strength, whether they are probably behind (a hand all on the board is the bettor's too: they win only with cards that beat it; a made hand also loses to the flushes and straights the board offers); or, when nobody bet, how many are left (人越多，越可能有人牌比你好 from three).
- **估算**: from top pair up there are no outs to count. At 50% or more it is 你多半已经领先, with 但要小心 and any flush or straight one card in an opponent's hand would make (`boardDangers`: 对手有一张黑桃就是同花，有一张 10 就是顺子). Below that it is 未必领先 (35% or more) or 多半已经落后, with every flush or straight the board offers, or else the bet or the number of players, as the reason. The unbeatable board-quads hand is 没人能赢你. Otherwise the 2-and-4 rule (二四法则, `ruleOfThumb`): outs times 4 with the turn and river to come, times 2 with only the river. With no outs, and always on the river (牌已经发完), it says instead what the hand beats as it is: a board-only hand at best splits, a weak pair beats smaller pairs and bluffs, and high card wins only against a bluff (when someone bet) or when nobody else made a hand. Each ends with the simulated rate (电脑模拟约 X%).
- **二四法则**, whenever the estimate uses the rule: why times 4 or times 2, with this hand's numbers (你看不到的牌有 47 张，每发一张，某一张牌出现的机会约 2%……所以 3 × 4 ≈ 12%). The 规则 dialog has the same idea under 自己估胜率, with 有效牌 and 跟注要有的胜率.
- **为什么不同**, only when there are outs and the rule and the simulation differ by more than 8 points: higher, because the simulation also counts the times the opponents have less or are bluffing; lower, because some outs do not win (and, with more than 8 outs on the flop, times 4 counts too many).

Where the coach is a bar (narrower than 1240px, or a phone on its side), the bar shows only the 估算 line (not on a short phone or a phone on its side) and the reason; 怎么算的 opens the panel's full content in a dialog.

## Starting hands (`startingTier` in `bot.ts`)

| Tier | Coach calls it | Hands |
| --- | --- | --- |
| 3 | 顶尖的起手牌 | TT+; AK; AQ suited |
| 2 | 一手好牌 | 77–99; AQ; AJ and AT suited; KQ and KJ suited |
| 1 | 能玩的牌 | 22–66; any other suited ace; AJ, AT; two cards both ten or higher; suited connectors and one-gappers from 65s up |
| 0 | 比较弱的牌 | everything else |

## What the coach advises (`advise`)

Shown only on the player's turn, with the coach on. The panel shows what just happened, the win rate a call needs, the player's own win rate (`shareOfPot`, 400 deals), after the flop the working above, the reason, and a reminder when players behind have still to act.

**Before the flop** (`beforeTheFlop`), by tier and the seat's group (`positionGroup`). Late means the button or 关位; the blinds are 小盲 and 大盲. At nine seats the three 枪口 seats are early and 劫位 is middle, so the coach advises them as it does 枪口 and 中位 at six: with nobody in yet, it folds a tier 1 hand from any of them. Heads-up the button is still played as late, but the coach says it acts first before the flop and last after it, since it is also the small blind.

- Nobody has raised: tier 2–3 raises to three big blinds plus whatever the limpers put in; tier 1 raises to three big blinds from late position, checks in the big blind, calls in the small blind, and otherwise folds; tier 0 checks when it can and folds otherwise.
- Someone has raised (the price is the call in big blinds): tier 3 re-raises to three times the bet; tier 2 calls up to 5 big blinds; tier 1 calls up to 3 big blinds from late position or the blinds; anything else folds, or checks when it can.

**After the flop** (`afterTheFlop`), by win rate against the price:

- Nothing to call: bet two thirds of the pot with a win rate of 60% or more, otherwise check.
- Facing a bet: raise with 75% or more (to 2.5 times the bet plus 0.3 of the pot). Call when the win rate beats the price by 3 points or more (比需要的高), or by less (刚好够，跟注稍微划算). Fold when it is below the price, except:
- **Implied odds.** A draw may call up to 6 points short of the price, because hitting it can win more later (中了还能再赢一笔). Only when both the player and someone still in will have chips left after the call; against an all-in there is no later betting, and the price alone decides.

The size the coach advises is also where the raise button starts, so following the advice takes one press. With the coach off it starts at two thirds of the pot.

## How a decision is graded (`gradeChoice`)

At the end of each hand every decision is shown with a grade: 好, 可以 or 欠妥.

- 好: the player did what the coach advised.
- 欠妥: folded when checking was free; folded a hand the coach would raise, or one more than 10 points ahead of the price; called or raised a hand the coach would fold by more than 8 points (raising a fold is always 欠妥).
- 可以: everything else — a safe fold of a call that paid a little, a call that was slightly short, a call or check where a raise was better, a raise where a call was enough.

The note under a grade is the coach's reason for its own advice, so it must make sense next to either choice.

## The computer players (`botAction`)

Each seat also has a fixed looseness (`LOOSENESS`), so the computer players do not all play alike: 乙, 戊 and 辛 play a little looser, 丁 and 庚 a little tighter. Six-handed, only 甲 to 戊 sit. The level from 设置 (`BotSkill`, kept under `guandan.holdem.skill`) applies to all of them.

| | 新手 `novice` | 普通 `basic` (default) | 进阶 `advanced` |
| --- | --- | --- | --- |
| Before the flop | limps or calls with most hands, raises only its best; calls raises wide | raises good hands, limps some playable ones, folds most hands to a raise | raises the hands it plays, steals from late position, re-raises tier 2 sometimes and tier 3 always |
| Win rate from | 80 deals | 60 deals (rougher) | 300 deals |
| Calls when its win rate is | up to 10 points below the price | up to 3 points below | at least 1 point above |
| Bets when nobody has, with | 75% or more | 70% or more, sometimes 50% | 55% or more (thin value), sometimes 50% |
| Bluffs against one or two players | never | sometimes (10%) | sometimes (10%) |
| Raises a bet with | 90% | 80% | 75% |

`npm run test:levels` keeps the order honest at both table sizes (numbers from November 2026). At six seats 普通 wins about 24 and 进阶 about 31 big blinds per 100 hands from 新手, played on the same cards both ways round; and in 600 real spots facing a bet, the wrong calls or folds were 新手 53, 普通 21, 进阶 2 of 508 clear ones. At nine seats the edges are larger, about 41 and 50, and the wrong calls or folds were 新手 59, 普通 13, 进阶 0 of 529. The thresholds are the same at both sizes. 进阶's edge over 普通 at the table is real but small (about 5 big blinds per 100 hands) and too noisy to assert, which is why the test also counts mistakes. When this measuring was first done, 进阶 bluffed three times as often and lost chips to 普通: more aggression is not more skill.

## What the coach does not do

- It does not put opponents on ranges beyond "a bettor has at least a pair", and it does not remember how a particular computer player plays.
- It does not plan a hand across streets, size bets by stack depth, or think about the next hand.
- Its win rates are estimates from random deals; two looks at the same spot can differ by a point or two, and the advice can flip when the numbers are that close. The grading is lenient in that band for that reason.

These are the next things a stronger coach or 进阶 player would learn. Add them to `advise` or `botAction`, describe them here, and let `npm run test:levels` show they help.
