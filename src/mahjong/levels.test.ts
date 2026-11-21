// Keeps the mahjong computer players' levels in order: 新手 < 普通 < 进阶. It takes a while, so it runs with
// `npm run test:levels` rather than every `npm test`; CI runs it in the quality job. Run it after any change to
// bot.ts, coach.ts or efficiency.ts, and print its numbers in the pull request.
//
// Two seats of one level play two of the other for many hands, then the levels swap seats on the same deals, and
// the points each level won are added up. Mahjong is noisy, so the margin asked for is small and the hands are many.
import { describe, expect, it } from "vitest"
import { botAction } from "./bot"
import type { BotSkill } from "./bot"
import { act, newMatch, nextHand, toAct } from "./game"
import { seeded } from "./testing"

const HANDS = 400

/** Points won over `HANDS` hands by the seats of `strong`, which sit in the even seats or the odd ones. */
function play(strong: BotSkill, weak: BotSkill, even: boolean): number {
  // The deals come from their own random source, so both halves see the same tiles.
  const deals = seeded(20261121)
  const moves = seeded(even ? 7 : 11)
  const level = (seat: number) => ((seat % 2 === 0) === even ? strong : weak)
  let state = newMatch(deals)
  let won = 0
  for (let hand = 0; hand < HANDS; hand++) {
    while (state.phase !== "over") {
      const seat = toAct(state)[0]
      state = act(state, seat, botAction(state, seat, moves, level(seat)))
    }
    const deltas = state.result?.deltas ?? [0, 0, 0, 0]
    won += deltas.reduce((sum, delta, seat) => sum + (level(seat) === strong ? delta : 0), 0)
    state = state.over ? newMatch(deals) : nextHand(state, deals)
  }
  return won
}

describe.skipIf(!import.meta.env.VITE_LEVELS)("the mahjong computer player levels", () => {
  for (const [strong, weak] of [
    ["basic", "novice"],
    ["advanced", "basic"],
    ["advanced", "novice"],
  ] as const) {
    it(`${strong} wins points from ${weak} over ${2 * HANDS} hands`, () => {
      const won = play(strong, weak, true) + play(strong, weak, false)
      console.log(`${strong} against ${weak}: ${won > 0 ? "+" : ""}${won} points over ${2 * HANDS} hands`)
      expect(won).toBeGreaterThan(20000)
      // About fifteen seconds on a laptop and nearer thirty on a CI runner.
    }, 120_000)
  }
})
