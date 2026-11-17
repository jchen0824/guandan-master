// How a player reads a hand at the table, without a computer: what they hold against the board, which cards
// would help, what the betting says about the opponents, and a win rate from the 2-and-4 rule. The coach
// shows this so the player learns to work the number out, not only to read it.
import { rankLabel, suitName } from "./cards"
import type { Card } from "./cards"
import { HERO, SEAT_NAMES } from "./game"
import type { HoldemState } from "./game"
import { categoryName, describeHand, evaluate } from "./hands"
import { bettorsAgainst, unseenCards } from "./odds"

/** How strong a hand usually is after the flop, as a player would group it. */
export const Strength = {
  /** High card, or a pair that is only on the board. */
  Nothing: 0,
  /** A pair below the top card of the board. */
  WeakPair: 1,
  TopPair: 2,
  /** A pocket pair above every board card. */
  Overpair: 3,
  TwoPair: 4,
  Trips: 5,
  /** A straight or better. */
  Strong: 6,
} as const
export type Strength = (typeof Strength)[keyof typeof Strength]

export interface HandRead {
  /** 你的牌, in a player's words. */
  text: string
  strength: Strength
  /** The short name of what the hand is, used to say what an out makes it: 顶对, 两对, 同花. */
  makes: string
}

const ranksDown = (cards: Card[]) => [...new Set(cards.map((card) => card.rank))].sort((a, b) => b - a)

/** The pair a hand uses, and whether it comes from the player's own cards, for a one-pair hand. */
function readPair(hole: Card[], board: Card[], rank: number): HandRead {
  const boardRanks = ranksDown(board)
  const label = rankLabel(rank)
  const pocket = hole[0].rank === rank && hole[1].rank === rank
  if (pocket) {
    if (rank > boardRanks[0]) return { text: `超对 ${label}：你的一对比公共牌都大`, strength: Strength.Overpair, makes: "超对" }
    return { text: `一对 ${label}：口袋对子，但公共牌上有比它大的牌`, strength: Strength.WeakPair, makes: "一对" }
  }
  const mine = hole.find((card) => card.rank === rank)
  if (!mine) {
    const high = Math.max(...hole.map((card) => card.rank))
    return { text: `只有 ${rankLabel(high)} 高：这对 ${label} 在公共牌上，大家都有`, strength: Strength.Nothing, makes: "高牌" }
  }
  const kicker = hole.find((card) => card !== mine)?.rank ?? 0
  if (rank === boardRanks[0]) {
    const strong = kicker >= 12
    return { text: `顶对 ${label}，踢脚 ${rankLabel(kicker)}${strong ? "，踢脚不错" : "，踢脚偏小"}`, strength: Strength.TopPair, makes: "顶对" }
  }
  const bottom = rank === boardRanks[boardRanks.length - 1]
  return { text: `${bottom ? "底对" : "中对"} ${label}：公共牌上有比它大的牌`, strength: Strength.WeakPair, makes: bottom ? "底对" : "中对" }
}

/** What the player holds against the board. Only after the flop. */
export function readHand(hole: Card[], board: Card[]): HandRead {
  const value = evaluate([...hole, ...board])
  const usesHole = value.cards.some((card) => hole.includes(card))
  const name = categoryName(value.category)
  if (value.category === "highCard") {
    return { text: `只有 ${rankLabel(Math.max(...hole.map((card) => card.rank)))} 高，还没成牌`, strength: Strength.Nothing, makes: "高牌" }
  }
  const high = rankLabel(Math.max(...hole.map((card) => card.rank)))
  // A hand only counts as the player's when one of their own cards is part of it, not only a kicker.
  const onBoard = { text: `只有 ${high} 高：公共牌上的${name}大家都有`, strength: Strength.Nothing, makes: "高牌" }
  if (!usesHole) return { text: `${describeHand(value)}：这手牌全在公共牌上，大家都有`, strength: Strength.Nothing, makes: name }
  const holds = (rank: number) => hole.some((card) => card.rank === rank)
  if (value.category === "pair") return readPair(hole, board, value.cards[0].rank)
  if (value.category === "twoPair") {
    // A pair on the board is everyone's, so the hand is only as good as the player's own pair.
    const pairs = [value.cards[0].rank, value.cards[2].rank]
    const own = pairs.filter((rank) => hole.some((card) => card.rank === rank))
    if (own.length === 0) return onBoard
    if (own.length === 1) return readPair(hole, board, own[0])
    return { text: `两对 ${rankLabel(pairs[0])} 和 ${rankLabel(pairs[1])}，两对都用上了你的牌`, strength: Strength.TwoPair, makes: "两对" }
  }
  if ((value.category === "trips" || value.category === "quads") && !holds(value.cards[0].rank)) return onBoard
  if (value.category === "trips") {
    const pocket = hole[0].rank === hole[1].rank
    return { text: pocket ? `暗三条 ${rankLabel(value.cards[0].rank)}：口袋对子中了第三张，很强` : `三条 ${rankLabel(value.cards[0].rank)}`, strength: Strength.Trips, makes: "三条" }
  }
  return { text: `${describeHand(value)}，很强`, strength: Strength.Strong, makes: name }
}

/** The weakest hand an out has to make: one that usually wins against a single opponent. */
const TARGET: Record<Strength, Strength | null> = {
  [Strength.Nothing]: Strength.TopPair,
  [Strength.WeakPair]: Strength.TwoPair,
  [Strength.TopPair]: Strength.TwoPair,
  [Strength.Overpair]: Strength.TwoPair,
  [Strength.TwoPair]: Strength.Trips,
  [Strength.Trips]: Strength.Strong,
  [Strength.Strong]: null,
}

export interface Outs {
  count: number
  /** 能帮你的牌, in a player's words, or null when no card clearly helps. */
  text: string | null
}

/** The unseen cards that would lift the hand to one that usually wins, grouped by what they make. */
export function countOuts(hole: Card[], board: Card[]): Outs {
  if (board.length < 3 || board.length > 4) return { count: 0, text: null }
  const target = TARGET[readHand(hole, board).strength]
  if (target === null) return { count: 0, text: null }
  const groups = new Map<string, Card[]>()
  for (const card of unseenCards([...hole, ...board])) {
    const after = readHand(hole, [...board, card])
    if (after.strength < target) continue
    groups.set(after.makes, [...(groups.get(after.makes) ?? []), card])
  }
  const count = [...groups.values()].reduce((sum, cards) => sum + cards.length, 0)
  if (count === 0) return { count: 0, text: null }
  const parts = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([makes, cards]) => {
      // One card has to come, so say which, then how many of them are unseen: "4 张 4" read as four 4s on the board.
      const ranks = ranksDown(cards)
      const which =
        ranks.length === 1 ? ` ${rankLabel(ranks[0])} `
        : cards.every((card) => card.suit === cards[0].suit) ? suitName(cards[0].suit)
        : ranks.length <= 3 ? ` ${ranks.map(rankLabel).join(" 或 ")} `
        : null
      return which === null ? `另有 ${cards.length} 张牌能成${makes}` : `来一张${which}就成${makes}（还剩 ${cards.length} 张）`
    })
  return { count, text: parts.join("；") }
}

/** The 2-and-4 rule: outs times 4 with two cards to come, times 2 with one. */
export function ruleOfThumb(outs: number, board: Card[]): { times: number; percent: number } {
  const times = board.length === 3 ? 4 : 2
  return { times, percent: Math.min(100, outs * times) }
}

/** What the betting says about the opponents, for the player to act. */
export function readOpponents(state: HoldemState, strength: Strength): string {
  const bettors = bettorsAgainst(state, HERO)
  const left = state.seats.filter((seat, index) => index !== HERO && !seat.folded).length
  if (bettors > 0) {
    const who = state.log
      .filter((entry) => entry.street === state.street && entry.seat !== HERO && (entry.kind === "bet" || entry.kind === "raise") && !state.seats[entry.seat].folded)
      .map((entry) => SEAT_NAMES[entry.seat])
    const names = [...new Set(who)].join("、")
    const where = strength <= Strength.WeakPair ? "你现在多半落后" : strength === Strength.TopPair ? "顶对常常领先，但会输给两对、三条" : strength === Strength.Overpair ? "超对多半领先，但会输给两对、三条" : "你的牌通常比他强"
    return `${names}下注了，下注的人通常至少有一对；${where}`
  }
  const many = left >= 3 ? "，人越多，越可能有人牌比你好" : ""
  return `还没人下注，还有 ${left} 个对手${many}`
}
