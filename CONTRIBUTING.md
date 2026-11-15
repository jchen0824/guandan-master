# Contributing

Thanks for helping with 掼蛋教练. 中文说明见文末。

People and coding agents follow the same rules. The technical ones (architecture, commands, what CI checks) live in [AGENTS.md](AGENTS.md); this file covers the workflow.

## Setup

You need Node.js 22.12 or newer (CI uses the version in `.nvmrc`).

```bash
npm ci
npm run dev
```

If you work with a coding agent that loads skills, also install the ui-sdk skill once on each machine. The game's own skills are already in the repo under `.agents/skills`.

```bash
npx skills add vercel-labs/ui --skill ui-sdk
```

## Workflow

1. Create a branch from `main` named `<type>/<short-name>`, for example `feat/pile-counter`.
2. Make the change with a test, and run `npm run check` until it passes.
3. Commit using the format below.
4. Open a pull request against `main` and fill in the template.

`main` is protected: nobody pushes to it directly, the `quality` and `conventional-commits` checks must pass, and the branch must be up to date. Pull requests are squash-merged, so **the pull request title becomes the commit on `main`** and must follow the same format as a commit.

Keep a pull request to one purpose. A bug fix and an unrelated refactor are two pull requests.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <summary>`.

- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Scopes**: `engine`, `bot`, `ui`, `agents` (AGENTS.md and skills), `ci`, `deps`. Leave the scope out for a repo-wide change.
- **Summary**: imperative, lower case, no trailing full stop. The whole first line is 72 characters at most.
- **Body**: say why, not what. The diff already shows what.
- Mark a breaking change with `!` after the type or scope.

| Good | Why |
| --- | --- |
| `feat(ui): add phone portrait layout` | type, scope, imperative summary |
| `fix(bot): hold bombs until an opponent is nearly out` | says what changes for the player |
| `docs: describe the save format` | no scope for a repo-wide change |

| Bad | Problem |
| --- | --- |
| `Fixed the bug.` | no type, capital letter, full stop |
| `feat(game): add timer` | `game` is not a scope |
| `update` | not a Conventional Commit |

Check a message before you commit:

```bash
npm run check:commits -- "fix(ui): keep the hand on screen"
```

CI runs the same script on the pull request title and on every commit in the pull request.

## What a good change looks like

- **Rules and bots**: add a case to `src/engine/engine.test.ts`. For a bot change, run `npm run bench` before and after and paste both results into the pull request. Read [the guandan-play skill](.agents/skills/guandan-play/SKILL.md) first so the bot plays the way a good player would.
- **Screens**: use `@ui-sdk/react` components and style them from `src/index.css`. Check the result at about 375×550, 852×300 and 1280×720. Read [the guandan-ui skill](.agents/skills/guandan-ui/SKILL.md) first.
- **Text**: everything the player reads is Chinese.
- **Rule variants**: this trainer uses a few house rules on purpose (listed in AGENTS.md). Open an issue before changing one.

## Reporting a bug

Open an issue with the hand number, what you played, what happened and what you expected. A screenshot of the 复盘 dialog helps: it shows the full play log.

## Licence

By contributing you agree that your work is released under the [MIT Licence](LICENSE).

---

## 中文说明

- 从 `main` 新建分支，改完后运行 `npm run check`，全部通过再提交。
- 不能直接推送到 `main`，请提交 Pull Request；合并方式为 squash，所以 PR 标题也要符合提交格式。
- 提交信息使用 Conventional Commits：`<类型>(<范围>): <英文摘要>`，例如 `fix(bot): hold bombs until an opponent is nearly out`。
- 玩家看到的文字一律用中文；代码、注释和提交信息用英文。
- 架构、命令和 CI 检查项见 [AGENTS.md](AGENTS.md)。
