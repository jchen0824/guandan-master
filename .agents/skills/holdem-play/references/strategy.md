# What the coach teaches, and how the computer players decide

The coach (`coach.ts`) and the computer players (`bot.ts`) share their measuring tools (`odds.ts`) and the starting-hand ranking, but not their decisions: the coach plays a fixed, honest beginner's strategy, and the computer players play at the level set in 设置. Every number below is in the code; change them here and there together.

## The measuring tools (`odds.ts`)

- **Win rate.** `equity(hole, board, opponents, rng, samples, betting)` deals the unseen cards many times and counts how often `hole` wins, a tie counting as a share. It moves by a few points from one look to the next. Opponents who have bet on a board of three or more cards are dealt hands that already make at least a pair (up to eight re-deals each), because someone who bets usually has something; without that the number is far too hopeful when facing a bet.
- **Win rate pot by pot.** `shareOfPot(state, seat, rng, samples)` is what the coach and the computer players actually use: the expected share of the chips the seat can win if it calls, worked out for each pot among only the players in it. A short stack's all-in therefore does not count side-pot chips it cannot win. With a single pot it equals `equity`.
- **Price of a call.** `potOdds(state, seat)` returns `call`, `potAfterCall` (all the chips the caller can win, their own call included, capped at what they can match) and `need = call / potAfterCall`, the win rate the call needs to break even.
- **Draws.** `draws(hole, board)` on the flop and turn only, and only for a hand that is not already a straight or better: a flush draw (8 or more cards make a flush), an open-ended straight draw (two ranks complete it) or a gutshot (one rank), and the number of outs. Its `text` is what the coach says: 听同花 / 两头听顺子 / 听卡顺 / 听同花，也听顺子，还有 N 张牌能帮你.
- **Bettors.** `bettorsAgainst(state, seat)` counts the players still in who bet or raised on this street.

## Starting hands (`startingTier` in `bot.ts`)

| Tier | Coach calls it | Hands |
| --- | --- | --- |
| 3 | 顶尖的起手牌 | TT+; AK; AQ suited |
| 2 | 一手好牌 | 77–99; AQ; AJ and AT suited; KQ and KJ suited |
| 1 | 能玩的牌 | 22–66; any other suited ace; AJ, AT; two cards both ten or higher; suited connectors and one-gappers from 65s up |
| 0 | 比较弱的牌 | everything else |

## What the coach advises (`advise`)

Shown only on the player's turn, with the coach on. The panel shows what just happened, the win rate a call needs, the player's own win rate (`shareOfPot`, 400 deals), the reason, and a reminder when players behind have still to act.

**Before the flop** (`beforeTheFlop`), by tier and position. Late means the button or 关位; the blinds are 小盲 and 大盲.

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

Each seat also has a fixed looseness (`LOOSENESS`): 乙 and 戊 play a little looser, 丁 a little tighter, so the five do not all play alike. The level from 设置 (`BotSkill`, kept under `guandan.holdem.skill`) applies to all five.

| | 新手 `novice` | 普通 `basic` (default) | 进阶 `advanced` |
| --- | --- | --- | --- |
| Before the flop | limps or calls with most hands, raises only its best; calls raises wide | raises good hands, limps some playable ones, folds most hands to a raise | raises the hands it plays, steals from late position, re-raises tier 2 sometimes and tier 3 always |
| Win rate from | 80 deals | 60 deals (rougher) | 300 deals |
| Calls when its win rate is | up to 10 points below the price | up to 3 points below | at least 1 point above |
| Bets when nobody has, with | 75% or more | 70% or more, sometimes 50% | 55% or more (thin value), sometimes 50% |
| Bluffs against one or two players | never | sometimes (10%) | sometimes (10%) |
| Raises a bet with | 90% | 80% | 75% |

`npm run test:levels` keeps the order honest (numbers from November 2026): 普通 wins about 24 and 进阶 about 31 big blinds per 100 hands from 新手, played on the same cards both ways round; and in 600 real spots facing a bet, the wrong calls or folds were 新手 53, 普通 21, 进阶 2 of 508 clear ones. 进阶's edge over 普通 at the table is real but small (about 5 big blinds per 100 hands) and too noisy to assert, which is why the test also counts mistakes. When this measuring was first done, 进阶 bluffed three times as often and lost chips to 普通: more aggression is not more skill.

## What the coach does not do

- It does not put opponents on ranges beyond "a bettor has at least a pair", and it does not remember how a particular computer player plays.
- It does not plan a hand across streets, size bets by stack depth, or think about the next hand.
- Its win rates are estimates from random deals; two looks at the same spot can differ by a point or two, and the advice can flip when the numbers are that close. The grading is lenient in that band for that reason.

These are the next things a stronger coach or 进阶 player would learn. Add them to `advise` or `botAction`, describe them here, and let `npm run test:levels` show they help.
