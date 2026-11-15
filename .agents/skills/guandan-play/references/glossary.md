# Glossary

Use these exact Chinese terms in anything the player reads. The same thing must not be called two names in two places. "In code" is the identifier to search for.

## People and seats

| Chinese | Meaning | In code |
| --- | --- | --- |
| 你 | The human player | seat `0`, `HUMAN` |
| 下家 | Next to play after you; an opponent | seat `1` |
| 对家 | Your partner, sitting opposite | seat `2`, `partnerOf` |
| 上家 | Plays just before you; an opponent | seat `3` |
| 头游 / 二游 / 三游 / 末游 | First, second, third, last to finish | `result.order`, `PLACE_NAMES` |
| 双下 | Both partners finish first and second; worth 3 levels | `gain === 3` |

## Cards

| Chinese | Meaning | In code |
| --- | --- | --- |
| 级牌 | Card of the rank being played; ranks above A | `rankValue(...) === 15` |
| 逢人配 | The heart level card; wild for anything but a joker | `isWild` |
| 大王 / 小王 | Big joker / small joker | rank `17` / `16` |
| 打几 | Which level a hand is played at ("本局打7") | `state.level` |

## Shapes

| Chinese | Meaning | In code |
| --- | --- | --- |
| 牌型 | A legal shape | `ComboType` |
| 单张 / 对子 / 三张 | Single / pair / triple | `single` / `pair` / `triple` |
| 三带二 | Full house | `fullHouse` |
| 顺子 | Straight of exactly five | `straight` |
| 三连对 | Three consecutive pairs | `tube` |
| 钢板 | Two consecutive triples | `plate` |
| 炸弹 | Four or more of a rank | `bomb` |
| 同花顺 | Straight flush; a bomb | `straightFlush` |
| 四大天王 | All four jokers; the top bomb | `jokerBomb` |

## Actions

| Chinese | Meaning | In code |
| --- | --- | --- |
| 出牌 | Play cards | `play` |
| 不出 / 过牌 | Pass | `pass` |
| 首出 / 首引 | Lead a trick | `lastPlay === null` |
| 压 / 压牌 | Beat the play on the table | `beats` |
| 接风 | Partner leads after a player goes out unbeaten | in `pass` |
| 进贡 / 还贡 | Pay tribute / return a card | `tributes`, `returnTribute` |
| 抗贡 | Cancel tribute by holding both big jokers | `tributeResisted` |
| 升级 | Move up levels | `gain` |
| 过A | Win the match at level A | `matchWinner` |
| 提示 | The hint button | `hint` in `useGame.ts`, calls `advise` |
| 理牌 | Group selected cards into a pile and reorder piles | `arrange`, `groups`, `ui/columns.ts` |
| 记牌器 | The card counter panel; 逢人配 has its own cell | `ui/Tracker.tsx`, `ui/unseen.ts` |
| 复盘 | Review the tribute, the play log and the four starting hands | `LogDialog`, `Review`, `ui/PlayLog.tsx` |

## Play skills

Explained in [strategy.md](strategy.md).

| Chinese | Meaning | In code |
| --- | --- | --- |
| 手数 | Number of turns a hand needs | `evaluateHand` |
| 组牌 / 拆牌 | Plan the hand into shapes / break a shape | `evaluateHand`, `margin` |
| 牌权 | Having the lead | |
| 回手牌 | A card sure to win the lead back | `isTop` |
| 算牌 / 记牌 | Count the cards that have gone | `readTable`, `unseen` |
| 顶牌 | Play high to block the next player | `nextCanGoOut`, `highest` |
| 让牌 | Leave partner's winning play alone | `fromPartner` |
| 垫牌 | Drop a weak card on partner's small play | `cheap` |
| 送牌 / 传牌 | Lead a small shape the partner can finish on | `feed` |
| 主攻 / 助攻 | The partner racing to go out / the one supporting | `support` |

## Levels of bot

| Chinese | In code |
| --- | --- |
| 新手 | `novice` |
| 普通 | `basic` |
| 进阶 | `advanced` |
