# Changelog

What changed in each release of 掼蛋教练. The newest release is first. Versions follow [Semantic Versioning](https://semver.org/): the middle number rises for a new feature, the last for a fix. How to cut a release is in [CONTRIBUTING.md](CONTRIBUTING.md#releases).

## [0.5.2] - 2026-11-19

### Fixed

- On a phone, the Hold'em coach's 怎么算的 dialog could open with its first lines above the screen. It now opens centred, from its title, and the long dialogs (怎么算的, 规则, 看复盘) start at the top.

## [0.5.1] - 2026-11-19

Pick the Texas Hold'em table size on the home page.

### Added

- The 德州扑克 tile on the home page has the same 6 人 / 9 人 choice as 牌桌人数 in 设置, so you can pick the table size before sitting down. If a table of the other size is waiting, the tile says it will not be kept and the button reads 开一张 9 人桌; nothing is given up until you press it.

## [0.5.0] - 2026-11-18

Texas Hold'em at a nine-seat table.

### Added

- Texas Hold'em can be played at a nine-seat table as well as a six-seat one. 设置 has a new 牌桌人数 field (6 人 or 9 人); picking the other size starts a new table after a confirm. A nine-seat table has eight computer players (甲 to 辛) and three more positions, 枪口+1, 枪口+2 and 劫位, and 规则 explains the positions at both sizes. Your table keeps its size between visits, tables saved before this release still load, and the home page shows the size of the table you will walk into.

### Fixed

- On a phone held sideways, the Hold'em coach's advice no longer covers your own line at the bottom left.
- In browser windows 621 to 739 pixels wide, the Hold'em table uses the narrow-screen layout: your label no longer runs into your cards, and the raise and call buttons show their full text.

## [0.4.0] - 2026-11-17

The Hold'em coach shows how to work out a win rate yourself, and players who run out of chips are out.

### Added

- After the flop, the Hold'em coach shows its working the way you could do it at the table: what your hand is against the board (顶对 K，踢脚 Q; 只有 A 高; a pair that is only on the board counts for nothing), which cards would help and how many are left (来一张红桃就成同花（还剩 9 张）), what the betting says about the opponents, and an estimate from the 2-and-4 rule (二四法则) next to the computer's simulated win rate. When the two differ by more than 8 points, a line says why. For a made hand it names the flushes and straights the board offers.
- On phones and narrower screens, the coach bar keeps the estimate and the decision, and 怎么算的 opens the full working.
- The working explains the 2-and-4 rule with the hand's own numbers (3 张有效牌 × 4 ≈ 12%), and 规则 has a new section, 自己估胜率, on outs, the 2-and-4 rule and the win rate a call needs.

### Changed

- A Hold'em player who runs out of chips is out (出局), as in a real game, instead of getting 2,000 again. The table plays on with fewer players, heads-up included. It ends when you are out (你出局了) or the last one left (全桌冠军), and 再开一桌 starts a new one. The home page says how many are left at your table.

## [0.3.0] - 2026-11-17

Texas Hold'em remembers your table.

### Added

- Texas Hold'em keeps the table between visits, like a 掼蛋 match: everyone's chips are saved at the end of each hand, and coming back carries on from the next hand. A hand left halfway is dealt again. 重新开始 in 设置 puts everyone back to 2,000 at hand 1.
- The home page says where you left off, for 掼蛋 and for 德州扑克, on phones too.
- At the Hold'em table your label shows how much you have put into the hand (本手已下).

### Fixed

- When all-in is the only raise you can make, Hold'em shows a single 全下 button instead of five size buttons that all showed the same amount. The raise button says 全下 whenever the size is your whole stack.
- On a phone held sideways, a large pot no longer runs into the cards on the board.

## [0.2.0] - 2026-11-17

A second game, Texas Hold'em (德州扑克), and a 3D table for 掼蛋.

### Added

- A home page to choose 掼蛋 or 德州扑克. The game you pick opens again next time; a ‹ button at the top left of either table goes back. A GitHub link to the source code is at the top right.
- Texas Hold'em: you and five computer players, no-limit, blinds 10/20, practice chips that are topped up when you run out. Side pots, split pots and the showdown follow the standard rules.
- A coach for Hold'em: on your turn it says what just happened, the win rate a call needs, your own win rate and what it would do and why. At the end of each hand it grades each of your decisions 好, 可以 or 欠妥. The 教练 switch turns it off, leaving one plain line about the table.
- Three levels for the Hold'em computer players in 设置: 新手, 普通 and 进阶.
- Raise sizes for Hold'em: minimum, half the pot, two thirds, the pot or all-in, and a slider for anything between.
- A 3D table for 掼蛋, now the default, with a 2D/3D switch in the top bar and in 设置. A bomb gets a moment of its own: a banner showing where it ranks among bombs.
- Tribute and return tribute in the 复盘 log, and a count of the wild hearts (逢人配) in the card counter.

### Changed

- The result of a 掼蛋 hand waits until you press 查看结果, so the last plays stay on the table to look at.

### Fixed

- On iPhone, every card of a play shows its rank on the 3D table; before, Safari drew the first card over the others.
- Jokers on the 3D table look the same as on the flat one.
- On a phone, the 2D/3D switch stays in the top bar, so you no longer need 设置 to get back to 3D.

## [0.1.0] - 2026-11-15

The first numbered release. It covers everything built so far.

### Added

- The full rules: every combination, the wild card (逢人配), the bomb ladder, levels, tribute and return, resisting tribute, and 接风.
- Computer players at three levels (新手, 普通, 进阶), set separately for opponents and partner.
- A coach that describes the position, gives hints and comments on each play, and can be hidden.
- A card counter (记牌器), suit filter, straight-flush finder, and manual piles that can be reordered (理牌).
- A review of the four starting hands and the play log.
- Progress saved in the browser between hands.
- Layouts for desktop, phone landscape and upright phone, with swipe to select cards.
- The version, build date and a link to the source code in the 设置 dialog.
