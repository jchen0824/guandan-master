# 掼蛋教练 verification map

The maintained list of what a player can do, and how to prove each in Mobile Safari with [verify.mjs](../verify.mjs). Read [the skill](../SKILL.md) first for launch, doctor and cleanup.

## Baseline preconditions

- `V launch` printed `ready`, and `V doctor` exits 0.
- Every recipe starts with its own `V open … --fresh`, so recipes do not depend on each other.
- Never drive a simulator another session is using; pick one with `VERIFY_DEVICE`.

## Driving conventions

- `V` is `node .agents/skills/verify/verify.mjs`, run from the repo root.
- Press buttons by the name a player reads. `V press "?"` lists the names on screen.
- After a press that passes the turn, the computer players need up to a few seconds. Take a proof and read `state.myTurn`.

## Proof and skip reporting

- Take a proof before and after the action. Name it `<feature>-<step>`.
- A proof counts when it prints `layout problems: none` and `script errors: none`, and you looked at the PNG.
- Report an entry point you could not reach with the command that failed and what it printed. A proof through one entry point does not cover another.

## Features

- [Home page](./home.md): the three tiles, the Hold'em table size, entering and leaving a game.
- [掼蛋 hand](./guandan-hand.md): the 2D and 3D tables, 提示, playing and passing, the coach.
- [德州扑克 hand](./holdem-hand.md): the coach's advice, calling, folding, raising, the next hand.
- [日本麻将 hand](./mahjong-hand.md): discarding, answering a discard, the result of a hand, coming back mid-hand.
- [日本麻将 coach](./mahjong-coach.md): the advice, its working, defending against a 立直, turning it off.
