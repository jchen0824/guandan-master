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
| No inline styles | `<div style={{ opacity: on ? 1 : 0.5 }}>` | `data-on={on ? "" : undefined}` and a rule in `src/index.css`. The one exception is `place()` from `ui/place.ts` on the 3D table (section 4) |
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

## 4. The 3D table

The player can switch between the 3D table (`data-view="3d"`, the default) and the flat table (`data-view="2d"`). They share the hand, buttons, tools, top bar, dialogs and all game state, so a change to any of those shows on both. Check both.

- **Where it lives.** `ui/Table3D.tsx` renders the scene; every rule for it is in the last block of `src/index.css`, scoped to `[data-view="3d"]`. A rule for the 3D table always starts with that selector, so it cannot change the flat table.
- **How it is drawn.** CSS 3D transforms only. `[data-slot="scene"]` sets the perspective, `[data-slot="world"]` is the tilted table, and everything on it is placed with `translate3d` from numbers in custom properties (`--zx`, `--fx`, `--cx`, …) listed at the top of the block. Lengths are multiples of `--u`, one design pixel. To move something, change its number; do not add a transform somewhere else.
- **Placing repeated things.** A card needs its index and its group's size to work out where it goes. Pass them with `place({ i, n })` from `ui/place.ts`, which sets `--i` and `--n` and nothing else, and do the arithmetic in CSS. This is the only allowed inline `style`, and each use has a lint suppression with that reason.
- **What flattens the scene.** Any element between `world` and a card must have `transform-style: preserve-3d` and must not have `overflow`, `opacity`, `filter` or `clip-path`. If cards suddenly lie flat or vanish, look for one of those first. Safari also needs the group to have `transform: translateZ(0)`.
- **Few layers.** Every element with a 3D transform is a layer the browser must sort by depth, and Safari stops sorting when there are too many. The tabletop, each fan and each play are therefore one flat surface each: their parts (felt, glow, shades, a bomb's flash and rings; the card backs; the cards of a play) are placed with 2D transforms and painted in source order. Something that lies flat on the table goes into `[data-slot="tabletop"]`, not into a new 3D layer. A flat surface needs a real width and height that hold everything in it, or Chrome sorts it under the table and cuts off what sticks out.
- **Labels must not overlap.** Seat labels, combination tags, 不出 marks, the turn note and the coach's line all float over the scene. After moving any of them, play a hand at each screen size: `layoutProblems()` reports two labels that overlap, and the browser tests run it through a whole hand. On phones the table is pinned to the screen, so a position that is clear with one hand is clear with every hand.
- **Check both engines by eye.** Chrome and Safari disagree about 3D in ways no layout probe can see. A Playwright WebKit screenshot paints 3D flat, so record a video of the page in WebKit and look at a frame (AGENTS.md says how).
- **Labels.** Seat labels and combination tags counter-rotate to face the camera. Seat labels are in a second `world` layer drawn after the table so a fan can never cover them.
- **Three camera setups.** Desktop, phone landscape and upright phone each set their own numbers in a media block; a short upright phone gets a flatter camera. Keep a change inside the block for the layout it is for.
- **Readable cards come first.** On phones the plays on the felt are propped up and enlarged, because a card lying flat at that size cannot be read. Do not trade that away for realism.

## 5. Check your work

1. Add or update a test in `src/App.test.tsx`. Start the file with `// @vitest-environment jsdom`. Find controls by role and Chinese name, drive them with `fireEvent`, and move bot turns forward with fake timers as the existing tests do.
2. If the change is something a player can see or reach, add it to `e2e/game.spec.ts` as well. The simulated DOM has no layout, so only the browser tests can catch an off-screen button or an overlap.
3. Run `npm run check`, then `npm run test:e2e`.
4. Follow [the browser-qa skill](../browser-qa/SKILL.md) for a look at the real thing at about 375×550, 852×300 and 1280×720. This step is not optional for a visual change.
5. In the pull request, say which sizes you checked and anything you could not check, such as a real phone.
