import { ACE, rankLabel, suitName } from "./cards"
import type { Card } from "./cards"

export type HandCategory = "straightFlush" | "quads" | "fullHouse" | "flush" | "straight" | "trips" | "twoPair" | "pair" | "highCard"

/** Strongest first. */
export const CATEGORIES: HandCategory[] = ["straightFlush", "quads", "fullHouse", "flush", "straight", "trips", "twoPair", "pair", "highCard"]

export interface HandValue {
  category: HandCategory
  /** Orders any two hands: the higher score wins, equal scores tie. */
  score: number
  /** The best five cards, most significant first. */
  cards: Card[]
}

const NAMES: Record<HandCategory, string> = {
  straightFlush: "同花顺",
  quads: "四条",
  fullHouse: "葫芦",
  flush: "同花",
  straight: "顺子",
  trips: "三条",
  twoPair: "两对",
  pair: "一对",
  highCard: "高牌",
}

export function categoryName(category: HandCategory): string {
  return NAMES[category]
}

const byRank = (a: Card, b: Card) => b.rank - a.rank

/** The five cards of the highest straight in `cards`, highest first, or null. The ace also plays low, under the 2. */
function straightIn(cards: Card[]): Card[] | null {
  const top = new Map<number, Card>()
  for (const card of cards) if (!top.has(card.rank)) top.set(card.rank, card)
  const ace = top.get(ACE)
  for (let high = ACE; high >= 5; high--) {
    const run: Card[] = []
    for (let rank = high; rank > high - 5; rank--) {
      const card = rank === 1 ? ace : top.get(rank)
      if (!card) break
      run.push(card)
    }
    if (run.length === 5) return run
  }
  return null
}

function value(category: HandCategory, cards: Card[]): HandValue {
  // In the lowest straight the ace counts as 1, so it must not outrank a six-high straight.
  const wheel = (category === "straight" || category === "straightFlush") && cards[0].rank === 5
  let score = CATEGORIES.length - 1 - CATEGORIES.indexOf(category)
  for (const card of cards) score = score * 15 + (wheel && card.rank === ACE ? 1 : card.rank)
  return { category, score, cards }
}

/** The best five-card hand from five, six or seven cards. */
export function evaluate(cards: Card[]): HandValue {
  const sorted = cards.slice().sort(byRank)
  const groups = new Map<number, Card[]>()
  for (const card of sorted) groups.set(card.rank, [...(groups.get(card.rank) ?? []), card])
  // Larger groups first, then higher ranks.
  const ranked = [...groups.values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank)
  const rest = (used: Card[], count: number) => sorted.filter((card) => !used.includes(card)).slice(0, count)

  const suited = (["S", "H", "C", "D"] as const).map((suit) => sorted.filter((card) => card.suit === suit)).find((group) => group.length >= 5)
  if (suited) {
    const run = straightIn(suited)
    if (run) return value("straightFlush", run)
  }
  if (ranked[0].length === 4) return value("quads", [...ranked[0], ...rest(ranked[0], 1)])
  if (ranked[0].length === 3 && ranked[1]?.length >= 2) return value("fullHouse", [...ranked[0], ...ranked[1].slice(0, 2)])
  if (suited) return value("flush", suited.slice(0, 5))
  const run = straightIn(sorted)
  if (run) return value("straight", run)
  if (ranked[0].length === 3) return value("trips", [...ranked[0], ...rest(ranked[0], 2)])
  if (ranked[0].length === 2 && ranked[1]?.length === 2) {
    const pairs = [...ranked[0], ...ranked[1]]
    return value("twoPair", [...pairs, ...rest(pairs, 1)])
  }
  if (ranked[0].length === 2) return value("pair", [...ranked[0], ...rest(ranked[0], 3)])
  return value("highCard", sorted.slice(0, 5))
}

/** A hand in words a player would use: "A 高的红桃同花", "三条 K", "一对 9". */
export function describeHand({ category, cards }: HandValue): string {
  const first = rankLabel(cards[0].rank)
  switch (category) {
    case "straightFlush":
      return `${suitName(cards[0].suit)}同花顺 到 ${first}`
    case "quads":
      return `四条 ${first}`
    case "fullHouse":
      return `葫芦 ${first} 带 ${rankLabel(cards[3].rank)}`
    case "flush":
      return `${first} 高的${suitName(cards[0].suit)}同花`
    case "straight":
      return `顺子 到 ${first}`
    case "trips":
      return `三条 ${first}`
    case "twoPair":
      return `两对 ${first} 和 ${rankLabel(cards[2].rank)}`
    case "pair":
      return `一对 ${first}`
    default:
      return `高牌 ${first}`
  }
}
