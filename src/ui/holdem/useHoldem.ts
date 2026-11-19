import { useEffect, useState } from "react"
import { BOT_SKILLS, botAction } from "../../holdem/bot"
import type { BotSkill } from "../../holdem/bot"
import { advise, gradeChoice } from "../../holdem/coach"
import type { Advice, Grade } from "../../holdem/coach"
import { HERO, act, describeAction, newTable, nextHand, resumeTable, tableOver, tableSize, toTableSave } from "../../holdem/game"
import type { Action, HoldemState, Street, TableSize } from "../../holdem/game"
import { savedSize, savedTable, startOver, writeTable } from "./storage"

const BOT_DELAY = 800
const SKILL_KEY = "guandan.holdem.skill"

function savedSkill(): BotSkill {
  try {
    const saved = localStorage.getItem(SKILL_KEY)
    return BOT_SKILLS.find((skill) => skill === saved) ?? "basic"
  } catch {
    return "basic"
  }
}

/** One choice the player made in this hand, with the coach's grade for it. */
export interface Decision {
  street: Street
  did: string
  grade: Grade
}

interface View {
  game: HoldemState
  /** Set when it is the player's turn. */
  advice: Advice | null
  decisions: Decision[]
  /** Why the last action was refused. */
  notice: string | null
}

const random = () => Math.random()

/**
 * The table to open with: the hand being played when the player left, the hand after the last one played, or a new
 * table. `seats` is the size picked on the home page; a saved table of another size is not resumed. It comes from the
 * page, not storage, which a browser may refuse.
 */
function opening(seats?: TableSize): HoldemState {
  const save = savedTable()
  if (save && (seats === undefined || save.stacks.length === seats)) return resumeTable(save, random)
  return newTable(random, seats ?? savedSize())
}

function look(game: HoldemState, decisions: Decision[]): View {
  return { game, advice: game.toAct === HERO ? advise(game, random) : null, decisions, notice: null }
}

/**
 * The Hold'em table as the screen needs it: the hand, the coach's advice, and the computer players moving on a timer.
 * `seats` is the table size picked on the home page, if the player came from there.
 */
export function useHoldem(seats?: TableSize) {
  const [view, setView] = useState<View>(() => look(opening(seats), []))
  const [skill, setSkillState] = useState<BotSkill>(savedSkill)
  const { game } = view

  useEffect(() => {
    const seat = game.toAct
    if (seat === null || seat === HERO) return
    const timer = setTimeout(() => {
      setView((now) => (now.game === game ? look(act(game, seat, botAction(game, seat, random, skill)), now.decisions) : now))
    }, BOT_DELAY)
    return () => clearTimeout(timer)
  }, [game, skill])

  // Saved after every move and every deal, so leaving mid-hand and coming back carries on with the same cards, never
  // a new deal. The coach's grades for the hand are not saved.
  useEffect(() => writeTable(toTableSave(game)), [game])

  /** The computer players' level. It takes effect from their next move. */
  const setSkill = (next: BotSkill) => {
    setSkillState(next)
    try {
      localStorage.setItem(SKILL_KEY, next)
    } catch {
      return
    }
  }

  const choose = (action: Action) =>
    setView((now) => {
      if (now.game.toAct !== HERO || !now.advice) return now
      try {
        const next = act(now.game, HERO, action)
        const did = describeAction(next.log[now.game.log.length])
        return look(next, [...now.decisions, { street: now.game.street, did, grade: gradeChoice(now.advice, action) }])
      } catch (error) {
        return { ...now, notice: error instanceof Error ? error.message : String(error) }
      }
    })

  const deal = () => setView((now) => (now.game.result && !tableOver(now.game) ? look(nextHand(now.game, random), []) : now))

  /** A new table of `size` seats, everyone back to 2,000 chips from hand 1: from 设置, or once the table has ended. */
  const restart = (size: TableSize) => {
    startOver(size)
    setView(look(newTable(random, size), []))
  }

  return { ...view, size: tableSize(game), skill, setSkill, choose, deal, restart }
}
