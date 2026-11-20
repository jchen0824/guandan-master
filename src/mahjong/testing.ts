// Helpers for the mahjong tests: a seeded random source, tiles from short names, and a hand with chosen tiles.
import { newMatch } from "./game"
import type { MahjongState, MatchLength } from "./game"
import { byKind, fromSeed, newTiles } from "./tiles"
import type { Kind, Tile } from "./tiles"

export const seeded = fromSeed

const SUITS = "mpsz"

/** "123m55p7z" is 一二三万, two 五筒 and 中: digits, then m 万, p 筒, s 索, or z for 东南西北白发中 as 1 to 7. */
export function kinds(names: string): Kind[] {
  const out: Kind[] = []
  let digits: number[] = []
  for (const char of names.replace(/\s/g, "")) {
    const suit = SUITS.indexOf(char)
    if (suit < 0) digits.push(Number(char))
    else {
      out.push(...digits.map((digit) => suit * 9 + digit - 1))
      digits = []
    }
  }
  return out
}

/** The same kinds as 34 counts. */
export function counts(names: string): number[] {
  const out = Array.from({ length: 34 }, () => 0)
  for (const kind of kinds(names)) out[kind]++
  return out
}

export interface Rig {
  /** Concealed tiles by seat: 13, or 14 for the dealer, whose last tile is the one it drew. */
  hands?: Record<number, string>
  /** The tiles drawn next, in order. */
  draws?: string
  /** The first 宝牌 indicator. */
  indicator?: string
  /** 岭上牌, in the order they are drawn. */
  rinshan?: string
}

/** A hand that has just been dealt, with chosen tiles. Everything not chosen is filled from the tiles left over. */
export function rig(state: MahjongState, chosen: Rig): MahjongState {
  const free = newTiles()
  const take = (names: string): Tile[] =>
    kinds(names).map((kind) => {
      const at = free.findIndex((tile) => tile.kind === kind)
      if (at < 0) throw new Error(`no tile of kind ${kind} left`)
      return free.splice(at, 1)[0]
    })
  const hands = state.players.map((_, seat) => (chosen.hands?.[seat] === undefined ? null : take(chosen.hands[seat])))
  const draws = take(chosen.draws ?? "")
  const indicator = take(chosen.indicator ?? "")
  const rinshan = take(chosen.rinshan ?? "")
  const players = state.players.map((player, seat) => {
    const size = seat === state.dealer ? 14 : 13
    const hand = hands[seat] ?? free.splice(0, size)
    if (hand.length !== size) throw new Error(`seat ${seat} needs ${size} tiles`)
    return { ...player, hand: hand.slice().sort(byKind) }
  })
  const drawn = (hands[state.dealer] ?? players[state.dealer].hand)[13]
  const dead = [...rinshan, ...free.splice(0, 4 - rinshan.length), ...indicator, ...free.splice(0, 10 - indicator.length)]
  const wall = [...free.splice(0, 69 - draws.length), ...draws.map((_, i) => draws[draws.length - 1 - i])]
  return { ...state, players, dead, wall, drawn }
}

/** A new match whose first dealer is the wanted seat. */
export function matchWithDealer(dealer: number, length: MatchLength = 1): MahjongState {
  for (let seed = 1; ; seed++) {
    const state = newMatch(fromSeed(seed), length)
    if (state.dealer === dealer) return state
  }
}
