import { useEffect, useState } from "react"
import { BOT_SKILLS, botAction } from "../../holdem/bot"
import type { BotSkill } from "../../holdem/bot"
import { advise, gradeChoice } from "../../holdem/coach"
import type { Advice, Grade } from "../../holdem/coach"
import { HERO, act, describeAction, newTable, nextHand, parseTableSave, resumeTable, toTableSave } from "../../holdem/game"
import type { Action, HoldemState, Street } from "../../holdem/game"

const BOT_DELAY = 800
const SKILL_KEY = "guandan.holdem.skill"
export const TABLE_KEY = "guandan.holdem.table"

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

/** The table to open with: the hand after the last one played, or a new table when nothing was saved. */
function opening(): HoldemState {
  try {
    const save = parseTableSave(localStorage.getItem(TABLE_KEY))
    if (save) return resumeTable(save, random)
  } catch {
    return newTable(random)
  }
  return newTable(random)
}

function look(game: HoldemState, decisions: Decision[]): View {
  return { game, advice: game.toAct === HERO ? advise(game, random) : null, decisions, notice: null }
}

/** The Hold'em table as the screen needs it: the hand, the coach's advice, and the computer players moving on a timer. */
export function useHoldem() {
  const [view, setView] = useState<View>(() => look(opening(), []))
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

  // Every hand that ends is saved, as on the 掼蛋 table, so the next visit carries on from the next hand.
  useEffect(() => {
    const save = toTableSave(game)
    if (!save) return
    try {
      localStorage.setItem(TABLE_KEY, JSON.stringify(save))
    } catch {
      return
    }
  }, [game])

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

  const deal = () => setView((now) => (now.game.result ? look(nextHand(now.game, random), []) : now))

  /** Everyone back to 2,000 chips, from hand 1. */
  const restart = () => {
    try {
      localStorage.removeItem(TABLE_KEY)
    } catch {
      // Storage is optional: the table still starts over.
    }
    setView(look(newTable(random), []))
  }

  return { ...view, skill, setSkill, choose, deal, restart }
}
