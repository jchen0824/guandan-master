import { ACE, BIG_JOKER, SMALL_JOKER, isWild, rankLabel, rankValue } from "./cards"
import type { Card, Suit } from "./cards"

export type ComboType =
  | "single"
  | "pair"
  | "triple"
  | "fullHouse"
  | "straight"
  | "tube"
  | "plate"
  | "bomb"
  | "straightFlush"
  | "jokerBomb"

export interface Combo {
  type: ComboType
  /** Comparison key within the type. Straights, tubes and plates use the natural top rank. */
  rank: number
  size: number
  cards: Card[]
}

interface Pattern {
  type: ComboType
  rank: number
  size: number
  need: [rank: number, count: number][]
  flush?: boolean
}

const NORMAL_RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
const MAX_BOMB = 10

const real = (n: number) => (n === 1 ? ACE : n)

function run(top: number, length: number, count: number): [number, number][] {
  const need: [number, number][] = []
  for (let n = top - length + 1; n <= top; n++) need.push([real(n), count])
  return need
}

function buildPatterns(level: number): Pattern[] {
  const out: Pattern[] = []
  const v = (rank: number) => rankValue(rank, level)
  for (const r of [...NORMAL_RANKS, SMALL_JOKER, BIG_JOKER]) {
    out.push({ type: "single", rank: v(r), size: 1, need: [[r, 1]] })
    out.push({ type: "pair", rank: v(r), size: 2, need: [[r, 2]] })
  }
  for (const r of NORMAL_RANKS) {
    out.push({ type: "triple", rank: v(r), size: 3, need: [[r, 3]] })
    for (const p of [...NORMAL_RANKS, SMALL_JOKER, BIG_JOKER]) {
      if (p !== r) out.push({ type: "fullHouse", rank: v(r), size: 5, need: [[r, 3], [p, 2]] })
    }
    for (let n = 4; n <= MAX_BOMB; n++) out.push({ type: "bomb", rank: v(r), size: n, need: [[r, n]] })
  }
  for (let top = 5; top <= ACE; top++) {
    out.push({ type: "straight", rank: top, size: 5, need: run(top, 5, 1) })
    out.push({ type: "straightFlush", rank: top, size: 5, need: run(top, 5, 1), flush: true })
  }
  for (let top = 3; top <= ACE; top++) out.push({ type: "tube", rank: top, size: 6, need: run(top, 3, 2) })
  for (let top = 2; top <= ACE; top++) out.push({ type: "plate", rank: top, size: 6, need: run(top, 2, 3) })
  out.push({ type: "jokerBomb", rank: 0, size: 4, need: [[SMALL_JOKER, 2], [BIG_JOKER, 2]] })
  return out
}

const patternCache = new Map<number, Pattern[]>()
function patternsFor(level: number): Pattern[] {
  let patterns = patternCache.get(level)
  if (!patterns) {
    patterns = buildPatterns(level)
    patternCache.set(level, patterns)
  }
  return patterns
}

const FLUSH_SUITS: Suit[] = ["S", "H", "C", "D"]

function fill(pattern: Pattern, naturals: Card[], wilds: Card[], suit?: Suit): Card[] | null {
  const picked: Card[] = []
  let missing = 0
  for (const [rank, count] of pattern.need) {
    let got = 0
    for (const card of naturals) {
      if (got === count) break
      if (card.rank === rank && (!suit || card.suit === suit)) {
        picked.push(card)
        got++
      }
    }
    if (got < count) {
      if (rank >= SMALL_JOKER) return null
      missing += count - got
      if (missing > wilds.length) return null
    }
  }
  if (picked.length === 0) {
    if (pattern.type !== "single" && pattern.type !== "pair") return null
    if (pattern.need[0][0] !== wilds[0]?.rank) return null
  }
  return picked.concat(wilds.slice(0, missing))
}

function split(cards: Card[], level: number) {
  const naturals: Card[] = []
  const wilds: Card[] = []
  for (const card of cards) (isWild(card, level) ? wilds : naturals).push(card)
  return { naturals, wilds }
}

/** Bombs outrank each other by this before rank: 4 < 5 < straight flush < 6 < ... < four jokers. */
export function bombPower(combo: Combo): number {
  if (combo.type === "jokerBomb") return 100
  if (combo.type === "straightFlush") return 6
  if (combo.type === "bomb") return combo.size >= 6 ? combo.size + 1 : combo.size
  return 0
}

export function beats(play: Combo, previous: Combo): boolean {
  const mine = bombPower(play)
  const theirs = bombPower(previous)
  if (mine > 0 || theirs > 0) return mine !== theirs ? mine > theirs : play.rank > previous.rank
  return play.type === previous.type && play.rank > previous.rank
}

function strength(combo: Combo): number {
  return bombPower(combo) * 100 + combo.rank
}

/** Every way these exact cards can be read as one combination, strongest first. */
export function classify(cards: Card[], level: number): Combo[] {
  if (cards.length === 0) return []
  const { naturals, wilds } = split(cards, level)
  const best = new Map<ComboType, Combo>()
  for (const pattern of patternsFor(level)) {
    if (pattern.size !== cards.length) continue
    for (const suit of pattern.flush ? FLUSH_SUITS : [undefined]) {
      const picked = fill(pattern, naturals, wilds, suit)
      if (!picked || picked.length !== cards.length) continue
      if (picked.filter((c) => !isWild(c, level)).length !== naturals.length) continue
      const current = best.get(pattern.type)
      if (!current || pattern.rank > current.rank) {
        best.set(pattern.type, { type: pattern.type, rank: pattern.rank, size: pattern.size, cards })
      }
    }
  }
  return [...best.values()].sort((a, b) => strength(b) - strength(a))
}

/** The reading of these cards to use: one that beats `previous`, or the strongest when leading. */
export function readPlay(cards: Card[], level: number, previous: Combo | null): Combo | null {
  const readings = classify(cards, level)
  if (!previous) return readings[0] ?? null
  return readings.find((combo) => beats(combo, previous)) ?? null
}

/** Every distinct play available from a hand, optionally limited to those beating `previous`. */
export function legalPlays(hand: Card[], level: number, previous: Combo | null): Combo[] {
  const { naturals, wilds } = split(hand, level)
  const out: Combo[] = []
  const seen = new Set<string>()
  for (const pattern of patternsFor(level)) {
    if (pattern.size > hand.length) continue
    const candidate = { type: pattern.type, rank: pattern.rank, size: pattern.size }
    if (previous && !beats({ ...candidate, cards: [] }, previous)) continue
    for (const suit of pattern.flush ? FLUSH_SUITS : [undefined]) {
      const picked = fill(pattern, naturals, wilds, suit)
      if (!picked) continue
      if (pattern.type === "straight" && classify(picked, level)[0].type === "straightFlush") continue
      const key = `${pattern.type}:${picked.map((c) => c.id).sort((a, b) => a - b).join(",")}`
      if (seen.has(key)) continue
      let rank = pattern.rank
      if (picked.length > naturals.length || picked.some((c) => isWild(c, level))) {
        rank = classify(picked, level).find((r) => r.type === pattern.type)?.rank ?? rank
      }
      if (previous && !beats({ ...candidate, rank, cards: [] }, previous)) continue
      seen.add(key)
      out.push({ ...candidate, rank, cards: picked })
    }
  }
  return out
}

const TYPE_NAMES: Record<ComboType, string> = {
  single: "单张",
  pair: "对子",
  triple: "三张",
  fullHouse: "三带二",
  straight: "顺子",
  tube: "三连对",
  plate: "钢板",
  bomb: "炸弹",
  straightFlush: "同花顺",
  jokerBomb: "四大天王",
}

export function comboTypeName(type: ComboType): string {
  return TYPE_NAMES[type]
}

function runLabel(top: number, length: number): string {
  const ranks: string[] = []
  for (let n = top - length + 1; n <= top; n++) ranks.push(rankLabel(real(n)))
  return ranks.join("-")
}

function valueLabel(value: number, level: number): string {
  return rankLabel(value === 15 ? level : value)
}

export function describeCombo(combo: Combo, level: number): string {
  switch (combo.type) {
    case "jokerBomb":
      return "四大天王"
    case "bomb":
      return `${combo.size}张${valueLabel(combo.rank, level)}炸弹`
    case "straightFlush":
      return `同花顺 ${runLabel(combo.rank, 5)}`
    case "straight":
      return `顺子 ${runLabel(combo.rank, 5)}`
    case "tube":
      return `三连对 ${runLabel(combo.rank, 3)}`
    case "plate":
      return `钢板 ${runLabel(combo.rank, 2)}`
    case "fullHouse":
      return `三张${valueLabel(combo.rank, level)}带一对`
    case "single":
      return `单张${valueLabel(combo.rank, level)}`
    case "pair":
      return `对${valueLabel(combo.rank, level)}`
    default:
      return `三张${valueLabel(combo.rank, level)}`
  }
}
