import { ACE } from "./cards"
import type { Card } from "./cards"
import { BIG_BLIND, SEATS, legalActions } from "./game"
import type { Action, HoldemState } from "./game"
import { potOdds, shareOfPot } from "./odds"

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

/** How well the computer players play. The player picks it in 设置. */
export type BotSkill = "novice" | "basic" | "advanced"

export const BOT_SKILLS: readonly BotSkill[] = ["novice", "basic", "advanced"]

/**
 * After the flop every level weighs its win rate against the price of a call. They differ in how far they
 * trust it: `margin` is how much the win rate must beat the price before calling (a novice calls short of
 * it), `betAt` the win rate it bets with when nobody has, `bluff` how often it bets without one against two
 * or fewer players, and `raiseAt` the win rate it raises a bet with.
 */
const STYLES: Record<BotSkill, { samples: number; margin: number; betAt: number; betSize: number; probe: boolean; bluff: number; raiseAt: number }> = {
  novice: { samples: 80, margin: -0.1, betAt: 0.75, betSize: 0.5, probe: false, bluff: 0, raiseAt: 0.9 },
  basic: { samples: 120, margin: 0.04, betAt: 0.65, betSize: 0.66, probe: true, bluff: 0.1, raiseAt: 0.8 },
  advanced: { samples: 300, margin: 0.01, betAt: 0.55, betSize: 0.75, probe: true, bluff: 0.3, raiseAt: 0.7 },
}

const limpOrCheck = (state: HoldemState): Action => (legalActions(state).canCheck ? { kind: "check" } : { kind: "call" })

/** A novice plays far too many hands: it limps or calls with most of them and rarely raises. */
function noviceBeforeTheFlop(state: HoldemState, tier: number, rng: () => number): Action {
  const legal = legalActions(state)
  if (state.currentBet <= BIG_BLIND) {
    if (tier === 3 || (tier === 2 && rng() < 0.4)) return sized(state, BIG_BLIND * 3)
    if (tier >= 1 || legal.canCheck || rng() < 0.5) return limpOrCheck(state)
    return { kind: "fold" }
  }
  const price = legal.callAmount / BIG_BLIND
  if (tier >= 2 || (tier === 1 && price <= 6) || (tier === 0 && price <= 2 && rng() < 0.4)) return { kind: "call" }
  return legal.canCheck ? { kind: "check" } : { kind: "fold" }
}

/** An advanced player raises the hands it plays, steals from late position and re-raises its best hands. */
function advancedBeforeTheFlop(state: HoldemState, tier: number, late: boolean, blind: boolean, rng: () => number): Action {
  const legal = legalActions(state)
  const stay: Action = legal.canCheck ? { kind: "check" } : { kind: "fold" }
  if (state.currentBet <= BIG_BLIND) {
    if (tier >= 2 || (tier === 1 && late)) return sized(state, BIG_BLIND * 3 + (state.pot - 30))
    if (tier === 1 && !blind && rng() < 0.5) return sized(state, BIG_BLIND * 3)
    if (tier === 1 && blind) return limpOrCheck(state)
    if (tier === 0 && late && rng() < 0.3) return sized(state, BIG_BLIND * 3)
    return stay
  }
  const price = legal.callAmount / BIG_BLIND
  if (tier === 3) return state.currentBet <= BIG_BLIND * 12 ? sized(state, state.currentBet * 3) : { kind: "call" }
  if (tier === 2 && price <= 5) return rng() < 0.3 ? sized(state, state.currentBet * 3) : { kind: "call" }
  if (tier === 1 && price <= 3 && (late || blind)) return { kind: "call" }
  return stay
}

/**
 * A rule-based player: starting-hand strength and position before the flop, win rate against pot odds after
 * it. `skill` sets how well it plays; "basic" is the level the table starts at.
 */
export function botAction(state: HoldemState, seat: number, rng: () => number, skill: BotSkill = "basic"): Action {
  const legal = legalActions(state)
  const me = state.seats[seat]
  const stay: Action = legal.canCheck ? { kind: "check" } : { kind: "fold" }
  const loose = LOOSENESS[seat] ?? 0

  if (state.street === "preflop") {
    const tier = startingTier(me.hole)
    const fromButton = (seat - state.button + SEATS) % SEATS
    const late = fromButton === 0 || fromButton === 5
    const blind = fromButton === 1 || fromButton === 2
    if (skill === "novice") return noviceBeforeTheFlop(state, tier, rng)
    if (skill === "advanced") return advancedBeforeTheFlop(state, tier, late, blind, rng)
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

  const style = STYLES[skill]
  const others = state.seats.filter((other, index) => index !== seat && !other.folded).length
  const chance = shareOfPot(state, seat, rng, style.samples)
  const { need } = potOdds(state, seat)
  if (legal.callAmount === 0) {
    if (chance > style.betAt) return sized(state, state.pot * style.betSize)
    if (style.probe && chance > 0.5 && rng() < 0.5) return sized(state, state.pot * 0.5)
    if (style.bluff > 0 && others <= 2 && rng() < style.bluff + loose * 0.05) return sized(state, state.pot * 0.5)
    return { kind: "check" }
  }
  if (chance > style.raiseAt && rng() < 0.6) return sized(state, state.currentBet * 2.5 + state.pot * 0.3)
  if (chance > need + style.margin - loose * 0.03) return { kind: "call" }
  return { kind: "fold" }
}
