---
name: guandan-ui
description: Use before changing anything a player sees in 掼蛋教练 - files under src/ui, src/App.tsx, src/index.css or a UI test. Says how to install or find the ui-sdk skill and adds this repo's layout, styling and testing rules.
---

# Changing the 掼蛋教练 interface

The interface is built from `@ui-sdk/react` components and styled with one plain CSS file. Two sets of rules apply: ui-sdk's own, and this repo's.

## 1. Get the ui-sdk skill, then read it

**If your agent loads skills, install it once per machine.** A new laptop does not have it yet:

```bash
npx skills add vercel-labs/ui --skill ui-sdk
```

That is the official install from the ui-sdk project ([github.com/vercel-labs/ui](https://github.com/vercel-labs/ui), docs at [ui-sdk.dev/docs](https://ui-sdk.dev/docs)). After it, the agent finds the skill as `ui-sdk` and loads it whenever it works on ui-sdk code. Update it with the same command when you upgrade `@ui-sdk/*`.

**If your agent does not load skills, or you have not installed it, read the copy that ships with the package.** It arrives with `npm ci`, needs no extra step, and always matches the version in `package-lock.json`:

```
node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md
```

If the installed skill and the packaged copy disagree, the packaged copy wins: it is the one written for the version this repo runs.

Either way, read `SKILL.md`, then only the reference it points you to:

- Composing existing components: `references/build-interface.md`
- A component ui-sdk does not ship: `references/create-component.md`
- Styling: `references/styles.md`
- Tests: `references/testing.md`

Then read the page for each component you use, for example `node_modules/@ui-sdk/react/docs/components/dialog.md`. The index is `node_modules/@ui-sdk/react/docs/llms.txt`. Do not read compiled files in `dist/`.

## 2. Rules CI enforces

Each of these fails `npm run check`, so getting them right first saves a round trip.

| Rule | Wrong | Right |
| --- | --- | --- |
| Import each component from its own entry | `import { Button } from "@ui-sdk/react"` | `import { Button } from "@ui-sdk/react/button"` |
| Never import private paths | `@ui-sdk/core/internal/...`, `@ui-sdk/react/dist/...` | a documented entry |
| Do not hand-roll a widget ui-sdk ships | `<div role="dialog">`, `role="switch"`, `role="tablist"` | `Dialog`, `Switch`, `Tabs` from `@ui-sdk/react` |
| No inline styles | `<div style={{ opacity: on ? 1 : 0.5 }}>` | `data-on={on ? "" : undefined}` and a rule in `src/index.css` |
| Change a part's element with `render` | `<Button as="a">` | the `render` prop, as the component's page shows |
| Component files export only components | a helper function exported from `Coach.tsx` | put the helper in its own `.ts` file (see `ui/situation.ts`) |
| No state set in an effect or during render | `useEffect(() => setX(derive(y)), [y])` | compute `derive(y)` during render |
| Stable keys | `key={index}` | `key={card.id}` |
| Native buttons state their type | `<button>` | `<button type="button">`, or better the ui-sdk `Button` |
| `@layer ui-sdk;` stays the first line of `src/index.css` | | |

Status text uses plain `role="status"` or `role="alert"` on a paragraph, and groups use `role="group"` with an `aria-label`; those are fine.

## 3. Rules of this repo

- **Name every control in Chinese.** Icon-only buttons and each card get an `aria-label`. Screen readers, tests and agents find controls by name.
- **All text the player reads is Chinese.**
- **State lives in `ui/useGame.ts`.** Components receive the `Game` object and call its actions. Do not call engine functions that change the game from a component.
- **Style from attributes.** Target `data-slot` and state attributes (`data-pressed`, `data-open`, `data-variant`). Card sizes come from the `--cw` custom property; change that, not individual widths.
- **One stylesheet, three layouts.** Desktop, phone landscape (`max-height: 480px`) and upright phone (`max-width: 620px`). A rule added for one layout must not leak into the others: put it inside the matching media block.
- **Dialogs render inside the top bar**, which sets `white-space: nowrap`. `[data-slot="dialog-content"]` resets that; keep the reset when you touch dialog styles.
- **Avoid ES2023 array additions** such as `toSorted` and `toReversed`: older phone browsers lack them and nothing polyfills them. `slice().sort()` is the house style.
- **Storage** goes through keys that start with `guandan.` and are listed in AGENTS.md.

## 4. Check your work

1. Add or update a test in `src/App.test.tsx`. Start the file with `// @vitest-environment jsdom`. Find controls by role and Chinese name, drive them with `fireEvent`, and move bot turns forward with fake timers as the existing tests do.
2. If the change is something a player can see or reach, add it to `e2e/game.spec.ts` as well. The simulated DOM has no layout, so only the browser tests can catch an off-screen button or an overlap.
3. Run `npm run check`, then `npm run test:e2e`.
4. Follow [the browser-qa skill](../browser-qa/SKILL.md) for a look at the real thing at about 375×550, 852×300 and 1280×720. This step is not optional for a visual change.
5. In the pull request, say which sizes you checked and anything you could not check, such as a real phone.
