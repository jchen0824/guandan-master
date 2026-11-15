# Guandan Coach (掼蛋教练)

[简体中文](README.md) | **English**

[![CI](https://github.com/jchen0824/guandan-master/actions/workflows/ci.yml/badge.svg)](https://github.com/jchen0824/guandan-master/actions/workflows/ci.yml)

A browser game for learning Guandan (掼蛋), the Chinese four-player climbing card game: you play with three computer players while a coach explains what is going on.

Play it: https://guandan-iota.vercel.app

The game itself is in Chinese.

## Features

- The full rules: every combination, the wild card (逢人配), the bomb ladder, levels, tribute and return, resisting tribute, and the partner taking the lead when a player goes out (接风). Three failed attempts at level A send a team back to 2
- Computer players at three levels (novice, basic, advanced), set separately for opponents and partner
- A coach that describes the position, gives hints and comments on each play, and can be hidden
- A card counter, suit filter, straight-flush finder, and manual piles you can reorder (理牌)
- A review of all four starting hands and the play log after each hand
- Progress is saved in the browser. No account, no server
- Works in desktop and phone browsers, upright or landscape

The computer players and the coach are rule-based programs. No large language model is involved.

## Run it locally

You need Node.js 22.12 or newer.

```bash
npm ci
npm run dev
```

## Other commands

```bash
npm run check   # run this before you commit: lint, conventions, tests, build, bundle size
npm test        # rules engine and game screen tests
npm run bench   # the three bot levels playing each other
npm run build   # production build
```

## Layout

- `src/engine`: rules, game flow and bots, with no UI dependency
- `src/ui`, `src/App.tsx`: the interface, built with React and `@ui-sdk/react`
- `.agents/skills`: Guandan rules, play skills and UI conventions written for coding agents

## Versions

The current version is shown in the game under 设置 → 关于. What changed in each release is in [CHANGELOG.md](CHANGELOG.md).

## Contributing

Issues and pull requests are welcome. The workflow and commit format are in [CONTRIBUTING.md](CONTRIBUTING.md); the architecture and what CI checks are in [AGENTS.md](AGENTS.md). `main` is protected, so every change lands through a pull request.

## Licence

[MIT](LICENSE)
