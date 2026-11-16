import { useState } from "react"
import { bombPower } from "../engine/combos"
import type { Combo } from "../engine/combos"
import type { GameState } from "../engine/game"

type Play = { player: number; combo: Combo }

/** The newest play in the hand's log. `lastPlay` will not do: it is cleared when the play that ends the hand lands. */
function latestPlay(game: GameState): Play | null {
  for (let at = game.log.length - 1; at >= 0; at--) {
    const { player, combo } = game.log[at]
    if (combo) return { player, combo }
  }
  return null
}

/**
 * The latest bomb played since the table was first drawn, or null. A bomb already lying on the table at that
 * point does not count. It stays the answer after the trick moves on, so its moment is not cut short.
 */
export function useFreshBomb(game: GameState): Play | null {
  const last = latestPlay(game)
  const [first] = useState(last?.combo)
  const [bomb, setBomb] = useState<Play | null>(null)
  if (last && last.combo !== first && last.combo !== bomb?.combo && bombPower(last.combo) > 0) setBomb(last)
  return bomb
}
