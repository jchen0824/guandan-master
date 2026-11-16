import { BIG_JOKER, isJoker, isWild, rankLabel } from "../engine/cards"
import type { Card, Suit } from "../engine/cards"

const PIPS: Record<Suit, string> = {
  S: "M12 2.5c2.6 3.4 8.5 6.6 8.5 11.2 0 2.5-1.9 4.3-4.3 4.3-1.3 0-2.4-.5-3.2-1.4.2 1.9.9 3.4 2.2 4.9H8.8c1.3-1.5 2-3 2.2-4.9-.8.9-1.9 1.4-3.2 1.4-2.4 0-4.3-1.8-4.3-4.3C3.5 9.1 9.4 5.9 12 2.5z",
  H: "M12 21s-7.5-4.6-9.6-9.3C.9 8.3 2.9 4.5 6.6 4.5c2.1 0 3.9 1.1 5.4 3 1.5-1.9 3.3-3 5.4-3 3.7 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21z",
  C: "M12 2.5a4.4 4.4 0 0 1 3.7 6.8 4.4 4.4 0 1 1-2.9 7.1c.2 1.9.9 3.4 2.2 5.1H9c1.3-1.7 2-3.2 2.2-5.1a4.4 4.4 0 1 1-2.9-7.1A4.4 4.4 0 0 1 12 2.5z",
  D: "M12 2.2 19.6 12 12 21.8 4.4 12z",
  J: "M12 2.6l2.8 6 6.6.8-4.9 4.5 1.3 6.5L12 17.2 6.2 20.4l1.3-6.5L2.6 9.4l6.6-.8z",
}

function Pip({ suit, slot }: { suit: Suit; slot: string }) {
  return (
    <svg data-slot={slot} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PIPS[suit]} />
    </svg>
  )
}

/** The card face of the 3D table: a condensed rank, drawn suit marks, and a badge on the wild card. */
function CardFace3D({ card, level }: { card: Card; level: number }) {
  if (isJoker(card)) {
    return (
      <>
        <span data-slot="face-rank" data-joker-name="">
          {card.rank === BIG_JOKER ? "大王" : "小王"}
        </span>
        <Pip suit="J" slot="face-pip" />
      </>
    )
  }
  return (
    <>
      <span data-slot="face-index">
        <span data-slot="face-rank">{rankLabel(card.rank)}</span>
        <Pip suit={card.suit} slot="face-suit" />
      </span>
      <Pip suit={card.suit} slot="face-pip" />
      {isWild(card, level) ? <span data-slot="face-tag">配</span> : null}
    </>
  )
}

export { CardFace3D }
