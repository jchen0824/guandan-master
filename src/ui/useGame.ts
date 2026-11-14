import { useCallback, useEffect, useState } from "react"
import { advise, chooseReturn } from "../engine/bot"
import type { Skill } from "../engine/bot"
import type { Card } from "../engine/cards"
import { describeCombo, legalPlays } from "../engine/combos"
import type { Combo } from "../engine/combos"
import { checkPlay, newMatch, parseSave, pass, play, resumeMatch, returnTribute, startNextHand, toSave } from "../engine/game"
import type { GameState, MatchSave, PlayRecord } from "../engine/game"
import { HUMAN } from "./names"

interface View {
  game: GameState
  table: (PlayRecord | null)[]
  clearNext: boolean
}

export interface Notice {
  kind: "info" | "hint" | "error"
  text: string
}

export interface Feedback {
  id: number
  agreed: boolean
  text: string
}

export interface Skills {
  opponents: Skill
  partner: Skill
}

const SKILLS_KEY = "guandan.skills"
const SAVE_KEY = "guandan.match"

function loadSave(): MatchSave | null {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY))
  } catch {
    return null
  }
}
const LEVELS: Skill[] = ["novice", "basic", "advanced"]

function loadSkills(): Skills {
  const fallback: Skills = { opponents: "basic", partner: "basic" }
  try {
    const saved = JSON.parse(localStorage.getItem(SKILLS_KEY) ?? "null")
    if (saved && LEVELS.includes(saved.opponents) && LEVELS.includes(saved.partner)) return saved
  } catch {
    return fallback
  }
  return fallback
}

const EMPTY_TABLE = [null, null, null, null]
const BOT_DELAY = 800

function fresh(game: GameState): View {
  return { game, table: EMPTY_TABLE, clearNext: false }
}

function act(view: View, player: number, combo: Combo | null): View {
  const game = combo ? play(view.game, player, combo.cards) : pass(view.game, player)
  const table = view.clearNext ? EMPTY_TABLE.slice() : view.table.slice()
  table[player] = { player, combo }
  return { game, table, clearNext: game.lastPlay === null }
}

function sameMove(a: Combo | null, b: Combo | null): boolean {
  if (!a || !b) return a === b
  return a.type === b.type && a.rank === b.rank && a.size === b.size
}

export function useGame() {
  const [view, setView] = useState(() => fresh(newMatch()))
  const [selected, setSelected] = useState<number[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)
  const [groups, setGroups] = useState<number[][]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [flushIndex, setFlushIndex] = useState(0)
  const [skills, setSkillsState] = useState(loadSkills)
  const [offer, setOffer] = useState(loadSave)
  const [saveFailed, setSaveFailed] = useState(false)
  const { game } = view

  useEffect(() => {
    try {
      const save = toSave(game)
      if (save) localStorage.setItem(SAVE_KEY, JSON.stringify(save))
      else if (game.phase === "matchOver") localStorage.removeItem(SAVE_KEY)
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }, [game])

  useEffect(() => {
    if (offer) return
    if (game.phase === "return") {
      const pending = game.tributes.find((t) => !t.returned && t.to !== HUMAN)
      if (!pending) return
      const timer = setTimeout(() => {
        const card = chooseReturn(game.hands[pending.to], game.level)
        setView((v) => (v.game === game ? { ...v, game: returnTribute(game, pending.to, card.id) } : v))
      }, BOT_DELAY)
      return () => clearTimeout(timer)
    }
    if (game.phase === "play" && game.turn !== HUMAN) {
      const timer = setTimeout(() => {
        const skill = game.turn === 2 ? skills.partner : skills.opponents
        setView((v) => (v.game === game ? act(v, game.turn, advise(game, game.turn, skill).combo) : v))
      }, BOT_DELAY)
      return () => clearTimeout(timer)
    }
  }, [game, skills, offer])

  const setSkills = (next: Skills) => {
    setSkillsState(next)
    try {
      localStorage.setItem(SKILLS_KEY, JSON.stringify(next))
    } catch {
      return
    }
  }

  const hand = game.hands[HUMAN]
  const chosen = hand.filter((c) => selected.includes(c.id))
  const mustReturn = game.phase === "return" && game.tributes.some((t) => t.to === HUMAN && !t.returned)
  const myTurn = game.phase === "play" && game.turn === HUMAN

  const toggle = useCallback((card: Card, pressed: boolean) => {
    setSelected((ids) => (pressed ? [...ids, card.id] : ids.filter((id) => id !== card.id)))
  }, [])

  const review = (mine: Combo | null) => {
    const advice = advise(game, HUMAN)
    const agreed = sameMove(mine, advice.combo)
    const did = mine ? `你出了${describeCombo(mine, game.level)}` : "你选择不出"
    const would = advice.combo ? `出${describeCombo(advice.combo, game.level)}` : "不出"
    const text = agreed ? `${did}，和教练的想法一致。${advice.reason}` : `${did}。教练会${would}：${advice.reason}`
    setFeedback((list) => [{ id: game.log.length, agreed, text }, ...list].slice(0, 3))
  }

  const playSelected = () => {
    const check = checkPlay(game, HUMAN, chosen)
    if (!check.ok) return setNotice({ kind: "error", text: check.reason })
    review(check.combo)
    setView((v) => act(v, HUMAN, check.combo))
    setSelected([])
    setNotice(null)
  }

  const passTurn = () => {
    review(null)
    setView((v) => act(v, HUMAN, null))
    setSelected([])
    setNotice(null)
  }

  const hint = () => {
    const advice = advise(game, HUMAN)
    setSelected(advice.combo ? advice.combo.cards.map((c) => c.id) : [])
    setNotice({ kind: "hint", text: advice.combo ? advice.reason : `建议不出：${advice.reason}` })
  }

  const findFlush = () => {
    const flushes = legalPlays(hand, game.level, null).filter((c) => c.type === "straightFlush")
    if (flushes.length === 0) {
      setSelected([])
      return setNotice({ kind: "info", text: "你手里现在没有同花顺。" })
    }
    const pick = flushes[flushIndex % flushes.length]
    setFlushIndex(flushIndex + 1)
    setSelected(pick.cards.map((c) => c.id))
    setNotice({
      kind: "info",
      text: `找到 ${flushes.length} 组同花顺，这是${describeCombo(pick, game.level)}。再点一次看下一组。`,
    })
  }

  const giveBack = () => {
    if (chosen.length !== 1) return setNotice({ kind: "error", text: "请选择一张牌还贡。" })
    try {
      const next = returnTribute(game, HUMAN, chosen[0].id)
      setView((v) => ({ ...v, game: next }))
      setSelected([])
      setNotice(null)
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message })
    }
  }

  const arrange = () => {
    if (selected.length === 0) return
    setGroups((current) => [
      ...current.map((g) => g.filter((id) => !selected.includes(id))).filter((g) => g.length > 0),
      selected,
    ])
    setSelected([])
  }

  const restore = () => {
    setGroups((current) =>
      selected.length === 0
        ? []
        : current.map((g) => g.filter((id) => !selected.includes(id))).filter((g) => g.length > 0),
    )
    setSelected([])
  }

  const selectPile = (ids: number[]) => {
    setSelected((current) => (ids.every((id) => current.includes(id)) && current.length === ids.length ? [] : ids))
  }

  const inHand = new Set(hand.map((c) => c.id))
  const piles = groups.map((g) => g.filter((id) => inHand.has(id))).filter((g) => g.length > 0)
  const pileIndex = piles.findIndex((g) => g.length === selected.length && g.every((id) => selected.includes(id)))

  const movePile = (step: number) => {
    const target = pileIndex + step
    if (pileIndex < 0 || target < 0 || target >= piles.length) return
    const next = piles.slice()
    ;[next[pileIndex], next[target]] = [next[target], next[pileIndex]]
    setGroups(next)
  }

  const reset = (next: GameState) => {
    setGroups([])
    setFeedback([])
    setView(fresh(next))
    setSelected([])
    setNotice(null)
  }

  const resume = () => {
    if (offer) reset(resumeMatch(offer))
    setOffer(null)
  }

  const startOver = () => {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      setSaveFailed(true)
    }
    setOffer(null)
    reset(newMatch())
  }

  const nextHand = () => reset(game.phase === "matchOver" ? newMatch() : startNextHand(game))

  return {
    game,
    table: view.table,
    hand,
    selected,
    groups,
    feedback,
    skills,
    setSkills,
    offer,
    saveFailed,
    resume,
    startOver,
    notice,
    myTurn,
    mustReturn,
    canPass: myTurn && game.lastPlay !== null,
    toggle,
    clearSelection: () => setSelected([]),
    playSelected,
    passTurn,
    hint,
    findFlush,
    giveBack,
    arrange,
    restore,
    selectPile,
    movePile,
    canMoveLeft: pileIndex > 0,
    canMoveRight: pileIndex >= 0 && pileIndex < piles.length - 1,
    pileSelected: pileIndex >= 0,
    nextHand,
  }
}

export type Game = ReturnType<typeof useGame>
