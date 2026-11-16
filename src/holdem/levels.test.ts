// Keeps the computer players' levels in order: 新手 < 普通 < 进阶. It takes about a minute, so it runs with
// `npm run test:levels` rather than every `npm test`; CI runs it in the quality job. Run it after any change
// to bot.ts, and print its numbers in the pull request.
//
// Two measures. Chips: levels play each other at one table. Poker is noisy, so each match is played twice on
// the same cards with the levels swapped between the seats ("duplicate"), pooled over sixteen deals. That
// separates 新手 from the others reliably, but 普通 and 进阶 are too close for it. Mistakes: in hundreds of
// real spots facing a bet, how often a level calls when the call loses chips or folds when it wins them,
// judged by a far more exact win rate than any level uses. That separates every level, with little noise.
import { describe, expect, it } from "vitest"
import { BOT_SKILLS, botAction } from "./bot"
import type { BotSkill } from "./bot"
import { BIG_BLIND, act, newTable, nextHand } from "./game"
import type { HoldemState } from "./game"
import { potOdds, shareOfPot } from "./odds"
import { seeded } from "./testing"

const SEEDS = Array.from({ length: 16 }, (_, index) => index + 1)
const HANDS = 200
const SPOTS = 600

/** Chips won by the three seats of `strong`, sitting in the even seats or the odd ones, over `HANDS` hands. */
function play(strong: BotSkill, weak: BotSkill, seed: number, even: boolean): number {
  // The cards come from their own random source, so both halves of a duplicate match see the same deals.
  const decide = seeded(seed * 7919 + (even ? 1 : 2))
  const theirs = (seat: number) => (seat % 2 === 0) === even
  let state = newTable(seeded(seed * 10007))
  let net = 0
  for (let hand = 0; hand < HANDS; hand++) {
    while (state.toAct !== null) state = act(state, state.toAct, botAction(state, state.toAct, decide, theirs(state.toAct) ? strong : weak))
    state.seats.forEach((seat, index) => {
      if (theirs(index)) net += (state.result?.winnings[index] ?? 0) - seat.total
    })
    state = nextHand(state, seeded(seed * 10007 + hand + 1))
  }
  return net
}

/** How much `strong` wins from `weak`, in big blinds per 100 hands per seat. */
function edge(strong: BotSkill, weak: BotSkill): number {
  const results = SEEDS.map((seed) => (play(strong, weak, seed, true) + play(strong, weak, seed, false)) / 6 / BIG_BLIND / ((HANDS * 2) / 100))
  const perHundred = results.reduce((sum, value) => sum + value, 0) / results.length
  console.log(`${strong} vs ${weak}: ${perHundred.toFixed(1)} big blinds per 100 hands, ahead on ${results.filter((value) => value > 0).length} of ${results.length} deals`)
  return perHundred
}

/** Spots after the flop where a player faces a bet, from a table where all three levels take turns. */
function spotsFacingABet(): { state: HoldemState; seat: number; share: number; need: number }[] {
  const rng = seeded(31)
  let state = newTable(rng)
  const spots: { state: HoldemState; seat: number }[] = []
  for (let hand = 0; spots.length < SPOTS && hand < 10_000; hand++) {
    while (state.toAct !== null) {
      const seat = state.toAct
      if (state.street !== "preflop" && state.currentBet > state.seats[seat].bet && hand % 2 === 0) spots.push({ state, seat })
      state = act(state, seat, botAction(state, seat, rng, BOT_SKILLS[hand % 3]))
    }
    state = nextHand(state, rng)
  }
  return spots.map((spot) => ({ state: spot.state, seat: spot.seat, share: shareOfPot(spot.state, spot.seat, seeded(99), 1500), need: potOdds(spot.state, spot.seat).need }))
}

describe.runIf(import.meta.env.VITE_LEVELS)("the computer players' levels", () => {
  it("has 普通 and 进阶 win clearly from 新手 at the same table", () => {
    expect(edge("basic", "novice")).toBeGreaterThan(8)
    expect(edge("advanced", "novice")).toBeGreaterThan(12)
  }, 300_000)

  it("has each level call or fold wrongly less often than the one below it", () => {
    const spots = spotsFacingABet()
    // A call within five points of the price is close enough that either answer is fine.
    const clear = spots.filter((spot) => Math.abs(spot.share - spot.need) >= 0.05)
    const wrong = Object.fromEntries(
      BOT_SKILLS.map((skill) => [
        skill,
        clear.filter((spot, index) => {
          const goesOn = botAction(spot.state, spot.seat, seeded(1000 + index), skill).kind !== "fold"
          return goesOn !== spot.share > spot.need
        }).length,
      ]),
    ) as Record<BotSkill, number>
    console.log(`wrong calls or folds in ${clear.length} clear spots: ${BOT_SKILLS.map((skill) => `${skill} ${wrong[skill]}`).join(", ")}`)
    expect(clear.length).toBeGreaterThan(SPOTS * 0.6)
    expect(wrong.novice).toBeGreaterThan(wrong.basic * 1.5)
    expect(wrong.basic).toBeGreaterThan(wrong.advanced * 2)
  }, 300_000)
})
