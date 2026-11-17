import { chips } from "../../holdem/cards"
import { HERO, SEAT_NAMES, knockedOut, tableOver } from "../../holdem/game"
import type { HoldemState } from "../../holdem/game"
import { categoryName, describeHand } from "../../holdem/hands"

/** The seat that won the most chips this hand. Its hand names the result, and its cards are the ones marked. */
export function biggestWinner(game: HoldemState): number | null {
  const winnings = game.result?.winnings
  if (!winnings) return null
  let best: number | null = null
  winnings.forEach((won, seat) => {
    if (won > 0 && (best === null || won > winnings[best])) best = seat
  })
  return best
}

/**
 * What the table says when a hand ends: the winning hand as a title, and who won how much. When the chips
 * went to more than one player (a split pot, or side pots won by different players), every one of them is named.
 */
export function resultLine(game: HoldemState): { title: string; line: string } | null {
  const hand = handLine(game)
  if (!hand) return null
  // Who lost their last chips, and, when that ends the table for the player, the end in the title.
  const out = knockedOut(game).filter((seat) => seat !== HERO)
  const line = out.length > 0 ? `${hand.line}。${out.map((seat) => SEAT_NAMES[seat]).join("、")}输光了筹码，出局` : hand.line
  const ending = tableOver(game)
  const title = ending === "lost" ? "你出局了" : ending === "won" ? "全桌冠军" : hand.title
  return { title, line }
}

function handLine(game: HoldemState): { title: string; line: string } | null {
  const seat = biggestWinner(game)
  const result = game.result
  if (!result || seat === null) return null
  const who = SEAT_NAMES[seat]
  const shown = result.shown.find((entry) => entry.seat === seat)
  if (!shown) return { title: seat === HERO ? "你赢了" : `${who}赢了`, line: `其他人都弃牌了，${who}赢得 ${chips(result.winnings[seat])}` }
  const winners = result.winnings.flatMap((won, other) => (won > 0 ? [other] : [])).sort((a, b) => result.winnings[b] - result.winnings[a])
  const parts = winners.map((other) => {
    const hand = result.shown.find((entry) => entry.seat === other)
    return `${SEAT_NAMES[other]}${hand ? `用${describeHand(hand.value)}` : ""}，赢得 ${chips(result.winnings[other])}`
  })
  const split = result.pots.some((pot) => pot.winners.length > 1)
  return { title: categoryName(shown.value.category), line: `${split ? "平分底池：" : ""}${parts.join("；")}` }
}
