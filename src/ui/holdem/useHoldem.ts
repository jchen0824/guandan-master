import { useEffect, useState } from "react"
import { BOT_SKILLS, botAction } from "../../holdem/bot"
import type { BotSkill } from "../../holdem/bot"
import { advise, gradeChoice } from "../../holdem/coach"
import type { Advice, Grade } from "../../holdem/coach"
import { HERO, act, describeAction, newTable, nextHand } from "../../holdem/game"
import type { Action, HoldemState, Street } from "../../holdem/game"

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

function look(game: HoldemState, decisions: Decision[]): View {
  return { game, advice: game.toAct === HERO ? advise(game, random) : null, decisions, notice: null }
}

/** The Hold'em table as the screen needs it: the hand, the coach's advice, and the computer players moving on a timer. */
export function useHoldem() {
  const [view, setView] = useState<View>(() => look(newTable(random), []))
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

  return { ...view, skill, setSkill, choose, deal }
}
