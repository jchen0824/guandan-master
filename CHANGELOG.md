# Changelog

What changed in each release of 掼蛋教练. The newest release is first. Versions follow [Semantic Versioning](https://semver.org/): the middle number rises for a new feature, the last for a fix. How to cut a release is in [CONTRIBUTING.md](CONTRIBUTING.md#releases).

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
