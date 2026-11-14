import { isJoker, isWild } from "../engine/cards"
import type { Card } from "../engine/cards"

export function cardAttributes(card: Card, level: number) {
  return {
    "data-card": "",
    "data-suit": card.suit,
    "data-red": card.suit === "H" || card.suit === "D" || card.rank === 17 ? "" : undefined,
    "data-wild": isWild(card, level) ? "" : undefined,
    "data-joker": isJoker(card) ? "" : undefined,
  }
}
