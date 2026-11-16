import { cardName, rankLabel } from "../../holdem/cards"
import type { Card } from "../../holdem/cards"
import { SUIT_PATHS } from "../pips"

/** One face-up card: the rank and suit in the corner and a large suit mark. Its size comes from the `--cw` it sits in. */
function PlayingCard({ card, mark }: { card: Card; mark?: "used" | "unused" }) {
  const red = card.suit === "H" || card.suit === "D"
  return (
    <span data-slot="playing-card" data-red={red ? "" : undefined} data-mark={mark}>
      <span data-slot="visually-hidden">{cardName(card)}</span>
      <span aria-hidden="true" data-slot="pc-rank">
        {rankLabel(card.rank)}
      </span>
      <svg aria-hidden="true" data-slot="pc-suit" viewBox="0 0 24 24">
        <path d={SUIT_PATHS[card.suit]} />
      </svg>
      <svg aria-hidden="true" data-slot="pc-pip" viewBox="0 0 24 24">
        <path d={SUIT_PATHS[card.suit]} />
      </svg>
    </span>
  )
}

export { PlayingCard }
