/**
 * A tile kind, 0 to 33: 0-8 are 一万 to 九万, 9-17 一筒 to 九筒, 18-26 一索 to 九索,
 * 27-30 the winds 东 南 西 北, 31-33 the dragons 白 发 中.
 */
export type Kind = number

/** One of the 136 tiles. Four tiles share each kind; `id >> 2` is the kind. */
export interface Tile {
  id: number
  kind: Kind
}

export const KINDS = 34
export const EAST = 27
export const WHITE = 31
export const GREEN = 32
export const RED = 33

export const isHonor = (kind: Kind) => kind >= EAST
/** 0 万, 1 筒, 2 索. Only for a kind that is not an honour. */
export const suitOf = (kind: Kind) => Math.floor(kind / 9)
/** 0 for 一 to 8 for 九. Only for a kind that is not an honour. */
export const indexOf = (kind: Kind) => kind % 9
export const isTerminal = (kind: Kind) => !isHonor(kind) && (indexOf(kind) === 0 || indexOf(kind) === 8)
/** 幺九牌: a 一, a 九 or an honour. */
export const isYaochu = (kind: Kind) => isHonor(kind) || isTerminal(kind)
export const isDragon = (kind: Kind) => kind >= WHITE

export function newTiles(): Tile[] {
  return Array.from({ length: KINDS * 4 }, (_, id) => ({ id, kind: id >> 2 }))
}

/** A repeatable random source from one number, so a deal can be saved as that number. */
export function fromSeed(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 4294967296
  }
}

export function shuffle(tiles: Tile[], rng: () => number): Tile[] {
  const out = tiles.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** How many tiles of each kind, as an array of 34 numbers. */
export function countKinds(tiles: readonly Tile[]): number[] {
  const counts = Array.from({ length: KINDS }, () => 0)
  for (const tile of tiles) counts[tile.kind]++
  return counts
}

export const byKind = (a: Tile, b: Tile) => a.kind - b.kind || a.id - b.id

/** The 宝牌 an indicator points at: the next number in its suit, the next wind, or the next dragon, wrapping round. */
export function doraOf(indicator: Kind): Kind {
  if (!isHonor(indicator)) return suitOf(indicator) * 9 + ((indexOf(indicator) + 1) % 9)
  if (!isDragon(indicator)) return EAST + ((indicator - EAST + 1) % 4)
  return WHITE + ((indicator - WHITE + 1) % 3)
}

const NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"]
const SUIT_NAMES = ["万", "筒", "索"]
const HONOR_NAMES = ["东", "南", "西", "北", "白", "发", "中"]
export const WIND_NAMES = ["东", "南", "西", "北"]

/** 三万, 七筒, 东, 发. */
export function kindName(kind: Kind): string {
  return isHonor(kind) ? HONOR_NAMES[kind - EAST] : `${NUMERALS[indexOf(kind)]}${SUIT_NAMES[suitOf(kind)]}`
}

/** 25000 -> "25,000" */
export function points(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
