export type Suit = "S" | "H" | "C" | "D" | "J"

export const SMALL_JOKER = 16
export const BIG_JOKER = 17
export const ACE = 14

export interface Card {
  id: number
  suit: Suit
  /** 2..14 (A = 14), 16 small joker, 17 big joker */
  rank: number
}

const SUITS: Suit[] = ["S", "H", "C", "D"]

export function buildDeck(): Card[] {
  const deck: Card[] = []
  let id = 0
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (let rank = 2; rank <= ACE; rank++) deck.push({ id: id++, suit, rank })
    }
    deck.push({ id: id++, suit: "J", rank: SMALL_JOKER })
    deck.push({ id: id++, suit: "J", rank: BIG_JOKER })
  }
  return deck
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function isJoker(card: Card): boolean {
  return card.rank >= SMALL_JOKER
}

export function isWild(card: Card, level: number): boolean {
  return card.suit === "H" && card.rank === level
}

/** Strength of a rank outside straights: the level rank sits between A and the jokers. */
export function rankValue(rank: number, level: number): number {
  return rank === level ? 15 : rank
}

export function cardValue(card: Card, level: number): number {
  return rankValue(card.rank, level)
}

export function sortHand(cards: Card[], level: number): Card[] {
  return cards.slice().sort((a, b) => {
    const diff = cardValue(b, level) - cardValue(a, level)
    if (diff !== 0) return diff
    if (a.suit !== b.suit) return a.suit < b.suit ? -1 : 1
    return a.id - b.id
  })
}

const RANK_LABELS: Record<number, string> = {
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
  16: "小王",
  17: "大王",
}

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank)
}

const SUIT_SYMBOLS: Record<Suit, string> = { S: "♠", H: "♥", C: "♣", D: "♦", J: "" }
const SUIT_NAMES: Record<Suit, string> = {
  S: "黑桃",
  H: "红桃",
  C: "梅花",
  D: "方块",
  J: "",
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit]
}

export function cardName(card: Card): string {
  return isJoker(card) ? rankLabel(card.rank) : `${SUIT_NAMES[card.suit]}${rankLabel(card.rank)}`
}

export function cardShort(card: Card): string {
  if (isJoker(card)) return rankLabel(card.rank)
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`
}
