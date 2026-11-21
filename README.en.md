# Guandan Coach (掼蛋教练)

[简体中文](README.md) | **English**

[![CI](https://github.com/jchen0824/guandan-master/actions/workflows/ci.yml/badge.svg)](https://github.com/jchen0824/guandan-master/actions/workflows/ci.yml)

Guandan Coach is a single-player card practice game for people who have just started. The home page offers Guandan (掼蛋), the four-player Chinese card game, Texas Hold'em and riichi mahjong. You play in the browser against computer players, and a coach gives hints and comments on each move.

Play it: https://guandan-playground.vercel.app

The game itself is in Chinese.

## Features

- The full rules of Guandan: every combination, the wild card (逢人配), the bomb ladder, levels, tribute and return, resisting tribute, and the partner taking the lead when a player goes out (接风). Three failed attempts at level A send a team back to 2
- Computer players at three levels (novice, basic, advanced), set separately for opponents and partner
- A coach that describes the position, gives hints and comments on each play, and can be hidden
- A card counter, suit filter, straight-flush finder, and manual piles you can reorder (理牌)
- A review of all four starting hands and the play log after each hand
- Progress is saved in the browser. No account, no server
- Works in desktop and phone browsers, upright or landscape
- A switch between a 2D (flat) and a 3D table
- Texas Hold'em: a six-seat or nine-seat no-limit table, picked on the home page or in 设置, with 10/20 blinds and practice chips. The nine-seat table adds three positions: 枪口+1, 枪口+2 and 劫位 (the hijack). The coach shows your win rate, the pot odds and its advice. After the flop it also shows the working a player can do at the table: what you hold, which cards would help, and the 2-and-4 rule estimate. It grades each of your decisions when the hand ends. It can be turned off, and the computer players have three levels. A player who runs out of chips is out, as in a real game, and the table ends when you are out or the last one left. The table is saved in the browser after every move, so coming back carries on where you left: a hand left halfway resumes with the same cards, not a new deal; 设置 has a button to start over
- Riichi mahjong: four players, 136 tiles, 25,000 points each, one round (东风战) or two (半庄战), picked in 设置. Calls, 立直, 振听, 役 and the points in 符 and 番 follow the rules, and the end of each hand lists the winner's 役 and every seat's change in points. The tile faces are a standard public-domain set. The match is saved after every move, so coming back carries on where you left. A coach says which tile to discard and why: how far the hand is from 听牌, how many tiles would help, and which tiles are safe when someone has declared 立直. It can be turned off, and the computer players have three levels

The computer players and the coach are rule-based programs. No large language model is involved.

## Run it locally

You need Node.js 22.12 or newer.

```bash
npm ci
npm run dev
```

## Other commands

```bash
npm run check              # run this before you commit: lint, conventions, tests, build, bundle size
npm run test:e2e           # also run this after changing the screen: browser tests at four desktop and phone sizes
npm run test:e2e:install   # once, before the first browser test run: downloads Chromium and WebKit
npm run screenshots:accept -- <run-id>   # after a CI screenshot comparison fails on purpose: save that run's new pictures as the baselines
npm test                   # rules engine and game screen tests
npm run bench              # the three bot levels playing each other
npm run test:levels        # Texas Hold'em: the three computer player levels play each other, to catch a level that got weaker
npm run build              # production build
```

`npm run check` does not include the browser tests. CI runs both, so after a change to the screen, run both before you commit.

## Layout

- `src/engine`: Guandan rules, game flow and bots, with no UI dependency
- `src/holdem`: Texas Hold'em rules, win-rate estimates, bots and coach, with no UI dependency
- `src/mahjong`: riichi mahjong rules, 向听, 役 and scoring, and a computer player, with no UI dependency
- `src/ui`, `src/App.tsx`, `src/Root.tsx`: the interface, built with React and `@ui-sdk/react`
- `.agents/skills`: Guandan and Texas Hold'em rules, play skills and UI conventions written for coding agents

## Versions

The current version is shown in the game under 设置 → 关于. What changed in each release is in [CHANGELOG.md](CHANGELOG.md).

## Contributing

Issues and pull requests are welcome. The workflow and commit format are in [CONTRIBUTING.md](CONTRIBUTING.md); the architecture and what CI checks are in [AGENTS.md](AGENTS.md). `main` is protected, so every change lands through a pull request.

## Licence

[MIT](LICENSE)
