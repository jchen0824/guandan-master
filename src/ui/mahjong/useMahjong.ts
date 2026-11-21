import { useEffect, useState } from "react"
import { botAction } from "../../mahjong/bot"
import { HERO, act, legalActions, newMatch, nextHand, resumeMatch, toAct, toSave } from "../../mahjong/game"
import type { Action, MahjongState, MatchLength } from "../../mahjong/game"
import { savedLength, savedMatch, startOver, writeMatch } from "./storage"

/** The pause before a computer player discards, and the shorter one before it answers a discard. */
const BOT_DELAY = 800
const CALL_DELAY = 300

const random = () => Math.random()

/** The table to open with: the hand being played when the player left, or a new match. */
function opening(): MahjongState {
  const save = savedMatch()
  if (save) {
    try {
      return resumeMatch(save)
    } catch {
      return newMatch(random, savedLength())
    }
  }
  return newMatch(random, savedLength())
}

/** The move the table makes without the player, if any: a computer player's, or the player's own discard after 立直. */
function nextMove(game: MahjongState): { delay: number; move: () => MahjongState } | null {
  const waiting = toAct(game)
  const bot = waiting.find((seat) => seat !== HERO)
  if (bot !== undefined) return { delay: game.phase === "call" ? CALL_DELAY : BOT_DELAY, move: () => act(game, bot, botAction(game, bot, random)) }
  const legal = waiting.includes(HERO) ? legalActions(game, HERO) : []
  const only = legal.length === 1 && legal[0].type === "discard" ? legal[0] : null
  return only && game.players[HERO].riichi > 0 ? { delay: BOT_DELAY, move: () => act(game, HERO, only) } : null
}

/** The mahjong table as the screen needs it: the hand, what the player may do, and the computer players moving on a timer. */
export function useMahjong() {
  const [game, setGame] = useState<MahjongState>(opening)

  useEffect(() => {
    const next = nextMove(game)
    if (!next) return
    const timer = setTimeout(() => setGame((now) => (now === game ? next.move() : now)), next.delay)
    return () => clearTimeout(timer)
  }, [game])

  // Saved after every move and every deal, so leaving mid-hand and coming back carries on with the same tiles.
  useEffect(() => writeMatch(toSave(game)), [game])

  const choose = (action: Action) =>
    setGame((now) => {
      try {
        return act(now, HERO, action)
      } catch {
        return now
      }
    })

  const deal = () => setGame((now) => (now.result && !now.over ? nextHand(now, random) : now))

  /** A new match of this length, everyone back to 25,000 points. */
  const restart = (length: MatchLength) => {
    startOver(length)
    setGame(newMatch(random, length))
  }

  return { game, legal: legalActions(game, HERO), choose, deal, restart }
}
