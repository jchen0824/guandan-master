import { BIG_JOKER, SMALL_JOKER, isWild, rankLabel } from "../engine/cards"
import type { Card } from "../engine/cards"
import type { GameState } from "../engine/game"
import { HUMAN } from "./names"

export interface TrackerCell {
  key: string
  label: string
  /** What the cell counts, for the tooltip and screen readers. */
  name: string
  left: number
  kind?: "joker" | "wild"
}

const WILD = -1

/**
 * Cards the player has not seen: not in their hand and not yet played.
 * The two wild hearts (逢人配) get a cell of their own, so the level-rank cell counts only the other six.
 */
export function unseen(game: GameState): TrackerCell[] {
  const gone = new Map<number, number>()
  const count = (card: Card) => {
    const key = isWild(card, game.level) ? WILD : card.rank
    gone.set(key, (gone.get(key) ?? 0) + 1)
  }
  game.hands[HUMAN].forEach(count)
  game.log.forEach((record) => record.combo?.cards.forEach(count))
  const left = (key: number, total: number) => total - (gone.get(key) ?? 0)

  const level = rankLabel(game.level)
  const cells: TrackerCell[] = [
    { key: "big", label: "大", name: "大王", left: left(BIG_JOKER, 2), kind: "joker" },
    { key: "small", label: "小", name: "小王", left: left(SMALL_JOKER, 2), kind: "joker" },
    { key: "wild", label: `♥${level}`, name: `逢人配（红桃${level}）`, left: left(WILD, 2), kind: "wild" },
    { key: "level", label: level, name: `级牌${level}（不含红桃）`, left: left(game.level, 6) },
  ]
  for (let rank = 14; rank >= 2; rank--) {
    if (rank !== game.level) cells.push({ key: String(rank), label: rankLabel(rank), name: rankLabel(rank), left: left(rank, 8) })
  }
  return cells
}
