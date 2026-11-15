# Play skills, and where the bots use them

Each section gives the idea in plain terms, when it applies, and the code that implements it in `src/engine/bot.ts`. "Not implemented" is stated where true: those are open improvements, not bugs. Line references drift, so search for the quoted identifier.

Seats, from the player's point of view: **下家** plays right after you (opponent), **对家** is your partner, **上家** plays right before you (opponent).

## The goal: partner placement, not only your own

Finishing first is worth 1 level if your partner comes last and 3 if your partner comes second. So the team's job is to get **one player out first and then the other out before both opponents**. Every skill below serves that. A move that speeds up your own hand but hands the lead to an opponent who is nearly out is usually wrong.

## 手数: count the turns your hand needs

**Idea.** A hand is measured by how many leads it takes to empty it, not by how big its cards are. 27 cards arranged into 7 shapes is a better hand than the same cards arranged into 11. Cards that win the lead back (bombs, the top card of a shape) effectively cost no turn.

**In code.** `evaluateHand(hand, level, unseen?)` returns a rough turn count, lower is better. It:

- subtracts for each wild card (−1.5), a joker bomb (−3) and each bomb (−0.5, more for longer ones);
- pulls out a straight only when at least three of its five ranks are otherwise lonely singles, so it does not break pairs and triples to make one;
- counts each remaining rank group as one turn, pairing triples with pairs as full houses;
- discounts a group that nothing unseen can beat (−0.7, needs card counting), level cards and jokers (−0.5) and aces (−0.2);
- adds a little (+0.2) for a single below 10, because small singles are the hardest cards to get rid of.

Almost every decision is "which legal play leaves the remaining hand with the lowest `evaluateHand`". That is the `rate` function inside `advise`. If you change the evaluator, every level of bot changes: run the benchmark.

## 组牌 and 拆牌: do not break good shapes

**Idea.** Decide how the hand splits into shapes before playing, and avoid breaking (拆) a strong shape to win a cheap trick. Beating a pair of 5s by breaking three kings is usually a loss.

**In code.** Not a separate step: breaking a shape raises `evaluateHand` of what is left, so the play scores badly. When following, the bot plays only if the result is within a `margin` of doing nothing (`choice.score <= stay + margin`); otherwise it passes with "压这手牌要拆散好牌型，先过，等机会". The margin grows when the situation is urgent (see below), which is exactly when breaking shapes becomes right.

## 牌权 and 回手牌: who has the lead, and how to get it back

**Idea.** The lead (牌权) lets you play the shape that suits you. A 回手牌 is a card or shape that is sure to win the lead back. Play your weak shapes while you still hold a way back in.

**In code.** `isTop(combo, reading, level)` is true when no ordinary play from the unseen cards can beat the combo. It powers the **two-step finish**: with 12 cards or fewer, if a top play leaves a remainder that is a single legal shape, play it now ("这手牌没人压得住（除非炸弹），下一手就能出完"). A single-shape hand is always played at once ("这手牌出完就走了").

## 算牌 and 记牌: count what has gone

**Idea.** Track what has been played to know what can still beat you. Beginners should count, in this order: the four jokers, the level cards (especially the two wild hearts), the aces, then which ranks have had bombs or are exhausted. With that you know whether your king is the top single, and whether an opponent can still hold a bomb in a rank.

**In code.** `readTable(state, player)` builds `unseen`: for every rank, how many copies are neither in this hand nor already played (key `-1` counts unseen wild cards). `higherExists` and `isTop` answer "can anything still beat this?". Only the `advanced` level counts cards. The human sees the same numbers in the 记牌器 (`src/ui/Tracker.tsx`, `unseen(game)`), so the bot never knows more than the player can.

**Not implemented.** Inference from behaviour: "下家 passed on a small pair, so they are short of pairs", or working out a specific opponent's holding. The bot counts cards but does not read players.

## 首引: what to lead

**Idea.** Lead the shape that leaves you best placed: usually small, awkward cards first (low singles, low pairs), long shapes that are hard to beat, and whatever your partner has shown they like. Do not lead a shape an opponent can go out on.

**In code.** The `!previous` branch of `advise` rates every non-bomb lead with `rate` and then adjusts:

- **Do not lead into a short hand.** If an opponent has 6 cards or fewer and the lead uses exactly that many cards, and the lead is not top, it is penalised (+4 for 下家, +3 for 上家). Reason shown: "…只剩 N 张，不出 N 张的牌型，免得被他接走".
- **Singles against one card.** When an opponent holds exactly one card, prefer other shapes, and if a single must be led, lead the highest ("对手只剩 1 张，单张要从大的出").
- **Feed the partner** (送牌, below).
- **Support the partner's suit of play.** If the partner is well ahead, lean towards the type the partner last led (`partnerLead`).

Bombs are led only when the hand has nothing else.

## 顶牌: play high to block

**Idea.** Sometimes you play a high card not to win the trick cheaply but to stop the next player slipping a small card through, or to force the opponents to spend something big. The classic case: 下家 is nearly out, and whatever is on the table would let them finish or get down to nothing. You 顶 with your highest card of that shape, even on top of your own partner's play.

**In code.** `nextCanGoOut`: 下家 has 1–3 cards and exactly as many as the shape on the table. Then the bot plays its **highest** non-bomb answer rather than its cheapest, including over the partner's play when the partner's card is not already top and the partner would not be going out. Reason: "下家只剩 N 张，用大牌顶住，不让他轻松接过去".

**Not implemented.** Early and mid-game 顶牌 (for example playing an ace second in hand to draw out a joker and promote your partner's level card). Only the endgame block exists.

## 压牌 or 过牌: when to beat an opponent

**Idea.** You do not have to beat everything. Beat when it is cheap, when you need the lead, or when letting it stand is dangerous. Pass when beating costs you a shape and nothing is urgent.

**In code.** For an opponent's play, the bot takes its best-rated answer and compares it with passing. The `margin` it will pay starts at 0.3 and grows:

| Situation | Extra margin |
| --- | --- |
| An opponent has 6 cards or fewer | +1.5 |
| The bot has 8 cards or fewer | +1 |
| The shape has 5 or more cards | +0.3 |
| The play came from 下家 | +0.5 |
| An opponent has already finished | +1 |
| `mustStop`: the player who played has 3 cards or fewer, or an opponent is out and this one has 10 or fewer | +5 |

`mustStop` means "beat it at almost any cost". When the opponent has just played their last cards, the reason explains 接风: "压住这手牌抢下出牌权，不让他的对家接风".

## 让牌: leave your partner's play alone

**Idea.** If your partner's play is winning the trick, do not beat it. You would spend a card to take the lead from your own side.

**In code.** `fromPartner`: the default is to pass ("这一轮对家最大，让对家继续出牌"). Two exceptions: the 顶牌 block above, and **垫牌**: if the partner's play is small (below 10), the partner still has more than 5 cards, and playing over it removes a weak shape (improves the hand by at least one turn), the bot plays a cheap card on top ("对家出的牌小，顺势垫一手，把弱牌送走").

## 送牌 and 传牌: feed your partner

**Idea.** When your partner is close to going out, lead a small card of the shape they need so they can finish or take the lead. One card left: lead a small single. Two left: lead a small pair.

**In code.** `feed`: the partner has 1–5 cards, fewer than the bot, and the bot leads a shape with exactly that many cards, unless 下家 holds the same number (that would feed the opponent first). The bonus is large when the partner has 1–2 cards or an opponent is already out, and lower-ranked feeds are preferred. Reason: "对家只剩 N 张，出小的…送他走".

**Not implemented.** Knowing which shape the partner actually holds. The bot assumes "N cards left means an N-card shape".

## 接风: the lead passes to the partner

**Idea.** If a player goes out and nobody beats their last play, their partner leads next. So when an opponent goes out, beat that last play if you can, or their partner gets a free lead. When your own partner goes out, you get the lead for free if the opponents cannot beat it.

**In code.** The rule is in `pass` (`game.ts`). The strategy is the `mustStop` case above with `left(who) === 0`.

## 炸弹: when to bomb

**Idea.** A bomb is the surest way to take the lead, and you have few. Used early it wins a trick that did not matter; kept too long it is wasted in a lost hand. Use one to stop an opponent going out, to take the lead when your own hand is nearly finished, or once an opponent is already out and the race is on. Know the ladder before bombing a bomb: 4 < 5 < straight flush < 6+ < four jokers.

**In code.** `urgent = threat <= 8 || hand.length <= 10 || opponentOut`, where `threat` is the smallest opposing hand. When not urgent, bombs are removed from the candidates and the bot passes with "只有炸弹能压，现在用还太早，先过". When urgent, the bomb still has to clear the margin test. A straight flush is rated two turns dearer than an ordinary bomb (`rate`), so the bot spends its plain bombs first and keeps the straight flush for a bigger fight. The simpler levels hold bombs until some player has 8 cards or fewer.

## 逢人配: spend the wild card last

**Idea.** The wild heart is the most flexible card in the hand. Its best uses are turning four of a kind into five, completing a straight flush, or fixing the one gap that would otherwise cost you two turns. Using it to make an ordinary pair is a waste.

**In code.** `evaluateHand` values each wild card at 1.5 turns, more than anything but a joker bomb, so plays that spend it score badly unless they finish the hand. `fill` in `combos.ts` always uses natural cards before wild ones. `chooseReturn` never gives it away, and tribute never takes it.

## 进贡 and 还贡

**Idea.** Tribute is forced: your highest card goes. Return is a choice: give a card that helps the receiver least if they are an opponent (a lonely low single that does not pair with common cards), or one that helps if the receiver is your partner. Holding both big jokers on the paying side cancels tribute (抗贡).

**In code.** `chooseReturn` gives back the allowed card whose loss leaves the best hand: the bot's least useful low card.

**Not implemented.** Telling partner from opponent when returning, and guessing what the receiver needs.

## The three levels

| Level | Leads | Follows | Card counting | Teamwork | On purpose |
| --- | --- | --- | --- | --- | --- |
| `novice` (新手) | one of its three best-rated leads, at random | never beats partner; otherwise beats if cheap | none | none | passes a quarter of the time when it could play |
| `basic` (普通) | best-rated lead | same, without the lazy passes | none | none | plays only its own hand |
| `advanced` (进阶) | everything above | margins, `mustStop`, 顶牌 | `readTable`, `isTop` | 让牌, 垫牌, 送牌, support | the coach and 提示 always use this level |

`novice` and `basic` share the `simple` function. Keep new skills out of it unless the point is to change the easy levels.

## Known weaknesses, in order of impact

1. **No look-ahead.** Every decision is one move deep. A search over the bot's own remaining shapes ("if I lead this, can I get back in?") would cut the double-win rate, which is about 45% between equal advanced bots.
2. **No reading of players.** Passes carry information the bot ignores.
3. **Feeding and returning are blind** to what the partner or receiver holds.
4. **顶牌 exists only in the endgame.**

When you fix one of these, move its "Not implemented" note into the description and add the position as a test.
