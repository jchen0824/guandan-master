import { useState } from "react"
import { App } from "./App"
import { Home } from "./ui/Home"
import type { GameChoice } from "./ui/Home"
import { Holdem } from "./ui/holdem/Holdem"
import type { TableSize } from "./holdem/game"

const GAME_KEY = "guandan.game"

function savedGame(): GameChoice | null {
  try {
    const saved = localStorage.getItem(GAME_KEY)
    return saved === "guandan" || saved === "holdem" ? saved : null
  } catch {
    return null
  }
}

/** The whole app: the home page, or the game the player picked. The choice is kept, so a reload returns to the same table. */
function Root() {
  const [game, setGame] = useState<GameChoice | null>(savedGame)
  // The Hold'em table size picked on the home page. Passed to the table, so the choice holds when storage is refused.
  const [seats, setSeats] = useState<TableSize | undefined>(undefined)
  const go = (next: GameChoice | null, picked?: TableSize) => {
    setGame(next)
    setSeats(picked)
    try {
      if (next) localStorage.setItem(GAME_KEY, next)
      else localStorage.removeItem(GAME_KEY)
    } catch {
      return
    }
  }
  if (game === "guandan") return <App onHome={() => go(null)} />
  if (game === "holdem") return <Holdem onHome={() => go(null)} seats={seats} />
  return <Home onPick={go} />
}

export { Root }
