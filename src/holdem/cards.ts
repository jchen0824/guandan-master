export type Suit = "S" | "H" | "C" | "D"

export const ACE = 14

export interface Card {
  id: number
  suit: Suit
  /** 2..14, ace is 14 */
  rank: number
}

export const SUITS: Suit[] = ["S", "H", "C", "D"]

export function newDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 2; rank <= ACE; rank++) deck.push({ id: deck.length, suit, rank })
  }
  return deck
}

export function shuffle(deck: Card[], rng: () => number): Card[] {
  const out = deck.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const LABELS: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" }
const SUIT_NAMES: Record<Suit, string> = { S: "黑桃", H: "红桃", C: "梅花", D: "方块" }

export function rankLabel(rank: number): string {
  return LABELS[rank] ?? String(rank)
}

export function suitName(suit: Suit): string {
  return SUIT_NAMES[suit]
}

export function cardName(card: Card): string {
  return `${suitName(card.suit)}${rankLabel(card.rank)}`
}

/** 1940 -> "1,940" */
export function chips(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
