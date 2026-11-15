import { isJoker, isWild, rankLabel, suitSymbol } from "../engine/cards"
import type { Card } from "../engine/cards"
import { cardAttributes, cardLabel } from "./cardAttributes"

function Jester() {
  return (
    <svg data-slot="card-jester" viewBox="0 0 48 56" aria-hidden="true">
      <path d="M14 26C6 22 4 14 6 8c6 4 12 8 16 16z" fill="#2d5bb8" stroke="#222" strokeWidth="0.8" />
      <path d="M34 26c8-4 10-12 8-18-6 4-12 8-16 16z" fill="#f2b01e" stroke="#222" strokeWidth="0.8" />
      <path d="M18 24c0-10 3-17 6-21 3 4 6 11 6 21z" fill="#d0312d" stroke="#222" strokeWidth="0.8" />
      <circle cx="6" cy="8" r="2.2" fill="#f6c343" stroke="#222" strokeWidth="0.7" />
      <circle cx="24" cy="3" r="2.2" fill="#f6c343" stroke="#222" strokeWidth="0.7" />
      <circle cx="42" cy="8" r="2.2" fill="#f6c343" stroke="#222" strokeWidth="0.7" />
      <rect x="13" y="23" width="22" height="4" rx="2" fill="#222" />
      <circle cx="24" cy="35" r="9" fill="#fbe6cf" stroke="#222" strokeWidth="0.8" />
      <circle cx="20.5" cy="33" r="1.1" fill="#222" />
      <circle cx="27.5" cy="33" r="1.1" fill="#222" />
      <circle cx="24" cy="36.5" r="1.7" fill="#d0312d" />
      <path d="M19.5 39q4.5 4.5 9 0" fill="none" stroke="#b3261e" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 46l4 7 4.5-6 4.5 6 4.5-6 4.5 6 4-7-4-2H15z" fill="#f2b01e" stroke="#222" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  )
}

function CardFace({ card, level }: { card: Card; level: number }) {
  if (isJoker(card)) {
    return (
      <>
        <span data-slot="card-rank">JOKER</span>
        <Jester />
      </>
    )
  }
  return (
    <>
      <span data-slot="card-rank">{rankLabel(card.rank)}</span>
      <span data-slot="card-suit">{suitSymbol(card.suit)}</span>
      <span data-slot="card-pip">{suitSymbol(card.suit)}</span>
      {isWild(card, level) ? <span data-slot="card-tag">配</span> : null}
    </>
  )
}

function CardRow({ cards, level, label }: { cards: Card[]; level: number; label: string }) {
  return (
    <ul data-slot="card-row" aria-label={label}>
      {cards.map((card) => (
        <li key={card.id} data-size="small" {...cardAttributes(card, level)}>
          <span data-slot="visually-hidden">{cardLabel(card, level)}</span>
          <span aria-hidden="true" data-slot="card-face">
            <CardFace card={card} level={level} />
          </span>
        </li>
      ))}
    </ul>
  )
}

export { CardFace, CardRow }
