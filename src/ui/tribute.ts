import { cardShort } from "../engine/cards"
import type { GameState } from "../engine/game"
import { SEAT_NAMES } from "./names"

/** One sentence per tribute for this hand, or the reason there was none. Empty on the first hand. */
export function tributeLines(game: GameState): string[] {
  if (game.handNumber === 1) return []
  if (game.tributeResisted) return ["抗贡：输家持有两张大王，本局不进贡。"]
  return game.tributes.map((t) => {
    const paid = `${SEAT_NAMES[t.from]}向${SEAT_NAMES[t.to]}进贡 ${cardShort(t.card)}`
    return t.returned ? `${paid}，${SEAT_NAMES[t.to]}还贡 ${cardShort(t.returned)}。` : `${paid}，等待还贡。`
  })
}
