// Helpers for the Hold'em tests: a seeded random source, cards from short names, and a table with chosen cards.
import { newDeck } from "./cards"
import type { Card, Suit } from "./cards"
import { SEATS } from "./game"
import type { HoldemState } from "./game"

export function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

const RANKS: Record<string, number> = { T: 10, J: 11, Q: 12, K: 13, A: 14 }

/** "AH" is the ace of hearts, "TS" the ten of spades. */
export function card(name: string): Card {
  const rank = RANKS[name[0]] ?? Number(name[0])
  const found = newDeck().find((c) => c.rank === rank && c.suit === (name[1] as Suit))
  if (!found) throw new Error(`no such card: ${name}`)
  return found
}

export const cards = (names: string) => names.split(" ").map(card)

/** The same table with chosen hole cards (by seat) and board. The other seats get cards that are not in use. */
export function rig(state: HoldemState, holes: Record<number, string>, board: string): HoldemState {
  const wanted = [...Object.values(holes).flatMap(cards), ...cards(board)]
  const free = newDeck().filter((c) => !wanted.some((w) => w.id === c.id))
  const seats = state.seats.map((seat, index) => ({ ...seat, hole: holes[index] ? cards(holes[index]) : free.splice(0, 2) }))
  return { ...state, seats, deck: [...cards(board), ...free] }
}

/** The same table with these stacks, for seats that have not put chips in yet. */
export function stacked(state: HoldemState, stacks: Record<number, number>): HoldemState {
  return { ...state, seats: state.seats.map((seat, index) => (stacks[index] === undefined ? seat : { ...seat, stack: stacks[index] - seat.total })) }
}

export const allSeats = Array.from({ length: SEATS }, (_, seat) => seat)
