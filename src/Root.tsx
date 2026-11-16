import { useState } from "react"
import { App } from "./App"
import { Home } from "./ui/Home"
import type { GameChoice } from "./ui/Home"
import { Holdem } from "./ui/holdem/Holdem"

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
  const go = (next: GameChoice | null) => {
    setGame(next)
    try {
      if (next) localStorage.setItem(GAME_KEY, next)
      else localStorage.removeItem(GAME_KEY)
    } catch {
      return
    }
  }
  if (game === "guandan") return <App onHome={() => go(null)} />
  if (game === "holdem") return <Holdem onHome={() => go(null)} />
  return <Home onPick={go} />
}

export { Root }
