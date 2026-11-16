import { ACE } from "./cards"
import type { Card } from "./cards"
import { BIG_BLIND, SEATS, legalActions } from "./game"
import type { Action, HoldemState } from "./game"
import { bettorsAgainst, equity, potOdds } from "./odds"

/** How good two starting cards are: 3 premium, 2 strong, 1 playable, 0 weak. */
export function startingTier(hole: Card[]): number {
  const [high, low] = hole.map((card) => card.rank).sort((a, b) => b - a)
  const suited = hole[0].suit === hole[1].suit
  if (high === low) return high >= 10 ? 3 : high >= 7 ? 2 : 1
  if (high === ACE && (low === 13 || (low === 12 && suited))) return 3
  if (high === ACE && (low === 12 || (suited && low >= 10))) return 2
  if (high === 13 && suited && low >= 11) return 2
  if (high === ACE && (suited || low >= 10)) return 1
  if (high >= 11 && low >= 10) return 1
  if (suited && high - low <= 2 && low >= 5) return 1
  return 0
}

/** Positive seats play more hands and bluff more; negative ones wait for better cards. */
const LOOSENESS = [0, 0, 1, 0, -1, 1]

/** Rounds to a multiple of 10 chips and keeps the raise inside what the rules allow. */
function sized(state: HoldemState, to: number): Action {
  const legal = legalActions(state)
  if (legal.minRaiseTo === null || legal.maxRaiseTo === null) return legal.callAmount > 0 ? { kind: "call" } : { kind: "check" }
  return { kind: "raise", to: Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, Math.round(to / 10) * 10)) }
}

/** A plain rule-based player: starting-hand strength and position before the flop, win rate against pot odds after it. */
export function botAction(state: HoldemState, seat: number, rng: () => number): Action {
  const legal = legalActions(state)
  const me = state.seats[seat]
  const stay: Action = legal.canCheck ? { kind: "check" } : { kind: "fold" }
  const loose = LOOSENESS[seat] ?? 0

  if (state.street === "preflop") {
    const tier = startingTier(me.hole)
    const fromButton = (seat - state.button + SEATS) % SEATS
    const late = fromButton === 0 || fromButton === 5
    const blind = fromButton === 1 || fromButton === 2
    const raised = state.currentBet > BIG_BLIND
    if (!raised) {
      if (tier >= 2) return sized(state, BIG_BLIND * 3 + (state.pot - 30))
      if (tier === 1 && (late || loose > 0)) return rng() < 0.35 ? sized(state, BIG_BLIND * 3) : legal.canCheck ? { kind: "check" } : { kind: "call" }
      if (tier === 1 && blind) return legal.canCheck ? { kind: "check" } : { kind: "call" }
      if (tier === 0 && late && loose > 0 && rng() < 0.2) return sized(state, BIG_BLIND * 3)
      return stay
    }
    const price = legal.callAmount / BIG_BLIND
    if (tier === 3) return state.currentBet <= BIG_BLIND * 9 ? sized(state, state.currentBet * 3) : { kind: "call" }
    if (tier === 2 && price <= 5) return { kind: "call" }
    if (tier === 1 && price <= 2.5 + loose && (late || blind)) return { kind: "call" }
    return stay
  }

  const others = state.seats.filter((other, index) => index !== seat && !other.folded).length
  const chance = equity(me.hole, state.board, others, rng, 120, bettorsAgainst(state, seat))
  const { need } = potOdds(state, seat)
  if (legal.callAmount === 0) {
    if (chance > 0.65) return sized(state, state.pot * 0.66)
    if (chance > 0.5 && rng() < 0.5) return sized(state, state.pot * 0.5)
    if (others <= 2 && rng() < 0.1 + loose * 0.05) return sized(state, state.pot * 0.5)
    return { kind: "check" }
  }
  if (chance > 0.8 && rng() < 0.6) return sized(state, state.currentBet * 2.5 + state.pot * 0.3)
  if (chance > need + 0.04 - loose * 0.03) return { kind: "call" }
  return { kind: "fold" }
}
