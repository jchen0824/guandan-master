import { newDeck } from "./cards"
import type { Card } from "./cards"
import { HERO, buildPots } from "./game"
import type { HoldemState } from "./game"
import { evaluate } from "./hands"

/** Every card not in `known`. */
export function unseenCards(known: Card[]): Card[] {
  const ids = new Set(known.map((card) => card.id))
  return newDeck().filter((card) => !ids.has(card.id))
}

/**
 * Deals the cards nobody has seen `samples` times: the rest of the board and two for each of `opponents`, and
 * passes each deal to `see`. The first `betting` opponents have bet on a board of three or more cards, and
 * someone who bets usually has something, so they are dealt hands that already make at least a pair.
 */
function deals(hole: Card[], board: Card[], opponents: number, rng: () => number, samples: number, betting: number, see: (full: Card[], hands: Card[][]) => void) {
  const rest = unseenCards([...hole, ...board])
  const need = 5 - board.length + opponents * 2
  const pick = () => need + Math.floor(rng() * (rest.length - need))
  for (let sample = 0; sample < samples; sample++) {
    // Only the cards this deal uses are shuffled to the front.
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (rest.length - i))
      ;[rest[i], rest[j]] = [rest[j], rest[i]]
    }
    for (let opponent = 0; board.length >= 3 && opponent < Math.min(betting, opponents); opponent++) {
      const at = 5 - board.length + opponent * 2
      for (let attempt = 0; attempt < 8 && evaluate([rest[at], rest[at + 1], ...board]).category === "highCard"; attempt++) {
        for (const slot of [at, at + 1]) {
          const other = pick()
          ;[rest[slot], rest[other]] = [rest[other], rest[slot]]
        }
      }
    }
    const full = [...board, ...rest.slice(0, 5 - board.length)]
    const hands = Array.from({ length: opponents }, (_, opponent) => rest.slice(5 - board.length + opponent * 2, 7 - board.length + opponent * 2))
    see(full, hands)
  }
}

/**
 * The chance, 0 to 1, that `hole` wins at showdown against `opponents` hands dealt at random. A tie counts as
 * a share. It deals the unknown cards `samples` times, so the answer moves by a few points from call to call.
 *
 * `betting` is how many of those opponents have bet on a board of three or more cards. Without it the answer
 * is far too rosy when facing a bet.
 */
export function equity(hole: Card[], board: Card[], opponents: number, rng: () => number, samples = 300, betting = 0): number {
  let won = 0
  deals(hole, board, opponents, rng, samples, betting, (full, hands) => {
    const mine = evaluate([...hole, ...full]).score
    let best = 0
    let level = 0
    for (const hand of hands) {
      const theirs = evaluate([...hand, ...full]).score
      if (theirs > best) {
        best = theirs
        level = 1
      } else if (theirs === best) level++
    }
    if (mine > best) won += 1
    else if (mine === best) won += 1 / (level + 1)
  })
  return won / samples
}

export interface Draws {
  /** Cards still unseen that would complete a flush or a straight. */
  outs: number
  flushDraw: boolean
  straightDraw: "open" | "gutshot" | null
  text: string | null
}

const NONE: Draws = { outs: 0, flushDraw: false, straightDraw: null, text: null }

/** What the hand is drawing to on the flop or the turn. A hand that already has a straight or better is not drawing. */
export function draws(hole: Card[], board: Card[]): Draws {
  if (board.length !== 3 && board.length !== 4) return NONE
  const now = evaluate([...hole, ...board]).category
  if (["straightFlush", "quads", "fullHouse", "flush", "straight"].includes(now)) return NONE
  let flushOuts = 0
  const straightRanks = new Set<number>()
  let outs = 0
  for (const card of unseenCards([...hole, ...board])) {
    const made = evaluate([...hole, ...board, card]).category
    const flush = made === "flush" || made === "straightFlush"
    const straight = made === "straight" || made === "straightFlush"
    if (flush) flushOuts++
    if (straight) straightRanks.add(card.rank)
    if (flush || straight) outs++
  }
  const flushDraw = flushOuts >= 8
  const straightDraw = straightRanks.size >= 2 ? "open" : straightRanks.size === 1 ? "gutshot" : null
  if (!flushDraw && !straightDraw) return NONE
  const what = flushDraw && straightDraw ? "听同花，也听顺子" : flushDraw ? "听同花" : straightDraw === "open" ? "两头听顺子" : "听卡顺"
  return { outs, flushDraw, straightDraw, text: `${what}，还有 ${outs} 张牌能帮你` }
}

/**
 * The price of a call: `need` is the share of the final pot the call pays for, which is the win rate it needs.
 * `potAfterCall` is what the caller can win, their own chips included. A caller who cannot cover the bet
 * wins from each player only as much as they put in themselves, so the rest of the pot is left out.
 */
export function potOdds(state: HoldemState, seat: number = HERO): { call: number; potAfterCall: number; need: number } {
  const me = state.seats[seat]
  const call = Math.min(state.currentBet - me.bet, me.stack)
  const mine = me.total + call
  const potAfterCall = state.seats.reduce((sum, other) => sum + Math.min(other.total, mine), 0) + call
  return { call, potAfterCall, need: call > 0 ? call / potAfterCall : 0 }
}

function bettingSeats(state: HoldemState, seat: number): Set<number> {
  const made = state.log.filter((entry) => entry.street === state.street && entry.seat !== seat && (entry.kind === "bet" || entry.kind === "raise") && !state.seats[entry.seat].folded)
  return new Set(made.map((entry) => entry.seat))
}

/** How many players still in the hand, not counting `seat`, have bet or raised on this street. Pass it to `equity()`. */
export function bettorsAgainst(state: HoldemState, seat: number = HERO): number {
  return bettingSeats(state, seat).size
}

/**
 * The win rate to set against `potOdds().need`: the share of `potAfterCall` that `seat` can expect back if it
 * calls now and the hand is shown down. It is worked out pot by pot, so a side pot is shared only among the
 * players who can win it, and nobody is paid from chips they never matched. Without side pots it is `equity()`.
 */
export function shareOfPot(state: HoldemState, seat: number, rng: () => number, samples = 300): number {
  const me = state.seats[seat]
  const { call, potAfterCall } = potOdds(state, seat)
  if (potAfterCall === 0) return 0
  const seats = state.seats.slice()
  seats[seat] = { ...me, total: me.total + call }
  const pots = buildPots(seats).filter((pot) => pot.eligible.includes(seat))
  const bettors = bettingSeats(state, seat)
  const others = state.seats.flatMap((other, index) => (index !== seat && !other.folded ? [index] : []))
  // Bettors first: `deals` gives the first `betting` opponents a hand worth betting.
  const order = [...others.filter((other) => bettors.has(other)), ...others.filter((other) => !bettors.has(other))]
  let paid = 0
  deals(me.hole, state.board, order.length, rng, samples, bettors.size, (full, hands) => {
    const score = new Map(order.map((other, at) => [other, evaluate([...hands[at], ...full]).score]))
    score.set(seat, evaluate([...me.hole, ...full]).score)
    for (const pot of pots) {
      const best = Math.max(...pot.eligible.map((other) => score.get(other) ?? 0))
      if (score.get(seat) === best) paid += pot.amount / pot.eligible.filter((other) => score.get(other) === best).length
    }
  })
  return Math.min(1, paid / samples / potAfterCall)
}
