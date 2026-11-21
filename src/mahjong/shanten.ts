// 向听: how many tiles a hand is from 听牌. 0 is 听牌 and -1 a finished hand.
// Every function takes the hand as 34 counts (`countKinds`) and never changes it.
import { EAST, KINDS, isYaochu } from "./tiles"
import type { Kind } from "./tiles"

/**
 * What one suit, or the honours, can give: `table[pair * 5 + sets]` is the most two-tile shapes that fit beside
 * that many finished sets and that many pairs kept as the head, or -1 when the tiles cannot give them.
 */
const tables = new Map<number, Int8Array>()

function tableFor(counts: readonly number[], from: number, length: number): Int8Array {
  const honors = from === EAST
  let key = 0
  for (let i = 0; i < length; i++) key = key * 5 + counts[from + i]
  // 5 ** 9: past every key a suit can have.
  if (honors) key += 1953125
  const known = tables.get(key)
  if (known) return known

  const left = counts.slice(from, from + length)
  const table = new Int8Array(10).fill(-1)
  const add = (by: number, ...at: number[]) => {
    for (const i of at) left[i] += by
  }
  const walk = (start: number, sets: number, partial: number, pair: number) => {
    let i = start
    while (i < length && left[i] === 0) i++
    if (i >= length) {
      const slot = pair * 5 + sets
      if (partial > table[slot]) table[slot] = partial
      return
    }
    const run = !honors && i + 2 < length
    if (sets < 4 && left[i] >= 3) {
      left[i] -= 3
      walk(i, sets + 1, partial, pair)
      left[i] += 3
    }
    if (sets < 4 && run && left[i + 1] > 0 && left[i + 2] > 0) {
      add(-1, i, i + 1, i + 2)
      walk(i, sets + 1, partial, pair)
      add(1, i, i + 1, i + 2)
    }
    if (left[i] >= 2) {
      left[i] -= 2
      if (pair === 0) walk(i, sets, partial, 1)
      walk(i, sets, partial + 1, pair)
      left[i] += 2
    }
    if (!honors && i + 1 < length && left[i + 1] > 0) {
      add(-1, i, i + 1)
      walk(i, sets, partial + 1, pair)
      add(1, i, i + 1)
    }
    if (run && left[i + 2] > 0) {
      add(-1, i, i + 2)
      walk(i, sets, partial + 1, pair)
      add(1, i, i + 2)
    }
    // Whatever is left of this kind stands alone.
    const held = left[i]
    left[i] = 0
    walk(i + 1, sets, partial, pair)
    left[i] = held
  }
  walk(0, 0, 0, 0)
  tables.set(key, table)
  return table
}

const GROUPS: readonly (readonly [number, number])[] = [
  [0, 9],
  [9, 9],
  [18, 9],
  [EAST, 7],
]

/** 向听 toward four sets and a pair. `called` is the number of sets already called or declared as a 杠. */
export function standardShanten(counts: readonly number[], called = 0): number {
  let reach = new Int8Array(10).fill(-1)
  reach[0] = 0
  for (const [from, length] of GROUPS) {
    const table = tableFor(counts, from, length)
    const next = new Int8Array(10).fill(-1)
    for (let a = 0; a < 10; a++) {
      if (reach[a] < 0) continue
      for (let b = 0; b < 10; b++) {
        if (table[b] < 0) continue
        const pair = Math.floor(a / 5) + Math.floor(b / 5)
        const sets = (a % 5) + (b % 5)
        if (pair > 1 || sets > 4) continue
        const slot = pair * 5 + sets
        next[slot] = Math.max(next[slot], reach[a] + table[b])
      }
    }
    reach = next
  }
  let best = 8
  for (let slot = 0; slot < 10; slot++) {
    const sets = (slot % 5) + called
    if (reach[slot] < 0 || sets > 4) continue
    best = Math.min(best, 8 - 2 * sets - Math.min(reach[slot], 4 - sets) - Math.floor(slot / 5))
  }
  return best
}

/** 向听 toward 七对子: seven different pairs. */
export function sevenPairsShanten(counts: readonly number[]): number {
  let pairs = 0
  let kinds = 0
  for (const count of counts) {
    if (count >= 2) pairs++
    if (count >= 1) kinds++
  }
  return 6 - pairs + Math.max(0, 7 - kinds)
}

/** 向听 toward 国士无双: one of each 幺九牌 and a second of any of them. */
export function thirteenOrphansShanten(counts: readonly number[]): number {
  let kinds = 0
  let pair = 0
  for (let kind = 0; kind < KINDS; kind++) {
    if (!isYaochu(kind) || counts[kind] === 0) continue
    kinds++
    if (counts[kind] >= 2) pair = 1
  }
  return 13 - kinds - pair
}

/** The 向听 of a hand, by whichever of the three shapes is nearest. A hand with calls can only make the first. */
export function shanten(counts: readonly number[], called = 0): number {
  const standard = standardShanten(counts, called)
  if (called > 0) return standard
  return Math.min(standard, sevenPairsShanten(counts), thirteenOrphansShanten(counts))
}

/**
 * 进张: the kinds that bring a hand of 13 tiles (fewer with calls) one step nearer. For a hand at 听牌 these are
 * the tiles it wins on. A kind the hand already holds four of is left out: there is no fifth.
 */
export function usefulKinds(counts: readonly number[], called = 0): Kind[] {
  const now = shanten(counts, called)
  const hand = counts.slice()
  const useful: Kind[] = []
  for (let kind = 0; kind < KINDS; kind++) {
    if (hand[kind] >= 4) continue
    hand[kind]++
    if (shanten(hand, called) < now) useful.push(kind)
    hand[kind]--
  }
  return useful
}

/** The tiles a hand of 13 wins on, or none when it is not 听牌. */
export function waits(counts: readonly number[], called = 0): Kind[] {
  return shanten(counts, called) === 0 ? usefulKinds(counts, called) : []
}
