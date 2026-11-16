import { isJoker, isWild, rankLabel } from "../engine/cards"
import type { Card, Suit } from "../engine/cards"
import { Jester } from "./CardFace"
import { SUIT_PATHS } from "./pips"

/** A joker has no suit mark: it shows the jester. */
const PIPS: Partial<Record<Suit, string>> = SUIT_PATHS

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
          JOKER
        </span>
        <Jester />
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
