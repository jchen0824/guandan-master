# Texas Hold'em terms used in the game

The Chinese the player reads, what it means, and where it comes from. Use these words and no others for the same idea, so the coach, the buttons and the 规则 dialog agree. All player-facing text is Chinese; code and docs are English.

## The table

| Chinese | English | Where |
| --- | --- | --- |
| 德州扑克 | Texas Hold'em | home page, top bar |
| 牌桌教练 | the app's name on the home page and the Hold'em top bar | `ui/Home.tsx`, `Holdem.tsx` |
| 你 甲 乙 丙 丁 戊 | the player and the five computer players | `SEAT_NAMES` |
| 筹码 | chips; always practice chips (练习筹码) | seat labels, rules |
| 盲注 10/20 | the blinds | top bar |
| 第 N 手 | hand number N | top bar |
| 底池 | the pot; split pots are 平分底池 | table, coach |
| 公共牌 | the board | table (accessible name) |
| 手牌 | a player's own two cards | table (accessible name) |
| 庄 | the dealer button badge | seat labels |

## Positions (`positionName`)

| Chinese | English |
| --- | --- |
| 庄位 | button |
| 小盲 | small blind |
| 大盲 | big blind |
| 枪口 | under the gun, first to act before the flop |
| 中位 | middle position |
| 关位 | cutoff, the seat before the button |
| 后位 | late position (the button or 关位), in 设置 describing 进阶; the coach says 后面行动 |

## Streets

翻牌前 (before the flop), 翻牌 (the flop, three board cards), 转牌 (the turn), 河牌 (the river), 摊牌 (the showdown).

## Actions and sizes

| Chinese | English | Notes |
| --- | --- | --- |
| 弃牌 | fold | |
| 过牌 | check | |
| 跟注 N | call N | |
| 下注 N | bet N | when nobody has bet on the street |
| 加注到 N | raise to N | always the total, never the raise amount |
| 全下 | all-in | |
| 最小 / 半池 / 三分之二 / 满池 | minimum raise / half the pot / two thirds of the pot / the pot | the size buttons |
| 下一手 | next hand | |

## Hands (`categoryName`, `describeHand`)

同花顺, 四条, 葫芦, 同花, 顺子, 三条, 两对, 一对, 高牌, strongest first. `describeHand` adds the ranks a player would say: 一对 9, 两对 K 和 9, 葫芦 Q 带 5, 顺子 到 A, A 高的红桃同花. Suits are 黑桃, 红桃, 梅花, 方块; ranks are 2–10, J, Q, K, A.

## The coach's words

| Chinese | Meaning |
| --- | --- |
| 胜率 | win rate: the chance to win, from `shareOfPot` |
| 跟注要有的胜率 | the win rate a call needs: the price, `potOdds().need` |
| 底池赔率 | pot odds (home page skill tag) |
| 起手牌 | starting hand |
| 顶尖的起手牌 / 一手好牌 / 能玩的牌 / 比较弱的牌 | starting-hand tiers 3 to 0 |
| 位置 | position |
| 听同花 / 两头听顺子 / 听卡顺 | flush draw / open-ended straight draw / gutshot |
| 还有 N 张牌能帮你 | N outs |
| 中了还能再赢一笔 | implied odds: hitting the draw can win more later |
| 刚好够 | the win rate just covers the price |
| 偷盲 | stealing the blinds (设置, describing 进阶) |
| 诈唬 | bluff (设置) |
| 拿价值 | betting for value (设置) |
| 好 / 可以 / 欠妥 | the three grades of a decision in the review |
| 复盘 | the review of a hand (看复盘) |
| 新手 / 普通 / 进阶 | the computer player levels |
